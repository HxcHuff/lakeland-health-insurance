#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const OUT = process.env.HERO_SCREENSHOT_DIR || '/cursor/stores/self/media/sitewide-hero-fix';
const PAGES = [
  { url: '/', name: 'homepage' },
  { url: '/blog/', name: 'blog-index' },
  { url: '/medicare/', name: 'medicare' },
  { url: '/davenport-health-insurance/', name: 'city-davenport' },
  { url: '/blog/orlando-health-watson-clinic-insurance-2026.html', name: 'watson-blog' },
  { url: '/blog/turning-65-medicare-checklist-florida.html', name: 'turning-65' }
];
const VIEWPORTS = [
  { w: 390, h: 844, tag: '390' },
  { w: 1280, h: 900, tag: '1280' }
];

function contentType(pathname) {
  if (pathname.endsWith('.css')) return 'text/css';
  if (pathname.endsWith('.js')) return 'application/javascript';
  return 'text/html';
}

function startServer() {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        const body = readFileSync(join(ROOT, pathname.replace(/^\//, '')));
        res.writeHead(200, { 'Content-Type': contentType(pathname) });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('missing');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolvePromise({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r()))
      });
    });
  });
}

mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const { url, name } of PAGES) {
    let rel = url.replace(/^\//, '') || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    for (const { w, h, tag } of VIEWPORTS) {
      try {
        const beforeHtml = execSync(`git show origin/main:${rel}`, { cwd: ROOT, encoding: 'utf8' });
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        await page.setContent(beforeHtml, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(150);
        await page.screenshot({ path: join(OUT, `before-${name}-${tag}.png`) });
        await page.close();
      } catch {
        /* main may lack file */
      }
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(`${server.baseUrl}${url}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      const afterPath = join(OUT, `after-${name}-${tag}.png`);
      await page.screenshot({ path: afterPath });
      if (tag === '390') {
        const mobileAliases = {
          homepage: 'mobile-form-order-home-390.png',
          medicare: 'mobile-form-order-medicare-390.png',
          'city-davenport': 'mobile-form-order-city-davenport-390.png',
          'watson-blog': 'mobile-form-order-watson-blog-390.png'
        };
        if (mobileAliases[name]) {
          writeFileSync(join(OUT, mobileAliases[name]), readFileSync(afterPath));
        }
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`Screenshots saved under ${OUT}`);
