#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = resolve('/workspace');
const OUT = '/cursor/stores/self/media/post-321-audit';
const CHROME = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome';

const SHOTS = [
  { url: '/plans/index.html', file: 'plans-hero-top-390.png', width: 390, height: 844 },
  { url: '/medicare/index.html', file: 'medicare-hero-top-390.png', width: 390, height: 844 },
  { url: '/aca-health-insurance-lakeland-fl/index.html', file: 'aca-lakeland-hero-top-390.png', width: 390, height: 844 },
  { url: '/blog/turning-65-medicare-checklist-florida.html', file: 'blog-turning-65-lead-heading-390.png', width: 390, height: 844 },
  { url: '/blog/turning-65-medicare-checklist-florida.html', file: 'turning-65-h1-clearance-1280.png', width: 1280, height: 800 },
  { url: '/plans/index.html', file: 'sticky-quote-scroll-390.png', width: 390, height: 844, afterQuoteScroll: true }
];

function contentType(pathname) {
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8';
  if (pathname.endsWith('.js')) return 'application/javascript; charset=utf-8';
  return 'text/html; charset=utf-8';
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
const browser = await chromium.launch({ headless: true, executablePath: CHROME });

for (const shot of SHOTS) {
  const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
  await page.goto(`${server.baseUrl}${shot.url}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  if (shot.afterQuoteScroll) {
    await page.evaluate(() => {
      const bar = document.getElementById('lhi-lead-sticky-bar');
      if (bar) bar.classList.add('is-visible');
      document.body.classList.add('lhi-lead-sticky-active');
      const link = document.querySelector('[data-lhi-sticky-quote]');
      if (link) link.click();
    });
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: join(OUT, shot.file), fullPage: false });
  console.log('saved', shot.file);
  await page.close();
}

await browser.close();
await server.close();
