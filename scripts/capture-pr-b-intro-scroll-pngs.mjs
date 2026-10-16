#!/usr/bin/env node
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { readdirSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = '/cursor/stores/self/media/sitewide-b';
const PIN = '20261016-sitewide-b10';

const REQUIRED = [
  { url: '/blog/orlando-health-lakeland-quality-approval-2026.html', name: 'orlando-health-lakeland-quality-approval-2026' },
  { url: '/blog/florida-aca-enrollment-and-benefits-2026.html', name: 'florida-aca-enrollment-and-benefits-2026' },
  { url: '/blog/orlando-health-watson-clinic-doctors-network-2026.html', name: 'orlando-health-watson-clinic-doctors-network-2026' }
];

const posts = readdirSync(join(ROOT, 'blog')).filter((f) => f.endsWith('.html') && f !== 'index.html');
const used = new Set(REQUIRED.map((r) => r.name));
const randomSix = [];
for (let i = 0; randomSix.length < 6 && i < posts.length * 2; i += 1) {
  const name = posts[(i * 11 + 7) % posts.length].replace(/\.html$/, '');
  if (used.has(name) || randomSix.some((r) => r.name === `random-${name}`)) continue;
  randomSix.push({ url: `/blog/${name}.html`, name: `random-${name}` });
}

const routes = [...REQUIRED, ...randomSix];

function contentType(pathname) {
  if (pathname.endsWith('.css')) return 'text/css';
  if (pathname.endsWith('.js')) return 'application/javascript';
  return 'text/html';
}

const server = await new Promise((resolvePromise) => {
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
    resolvePromise({ baseUrl: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) });
  });
});

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});

try {
  for (const { url, name } of routes) {
    for (const { w, h, tag } of [
      { w: 1280, h: 800, tag: '1280' },
      { w: 390, h: 844, tag: '390' }
    ]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(`${server.baseUrl}${url}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => {
        try {
          for (let i = localStorage.length - 1; i >= 0; i -= 1) {
            const k = localStorage.key(i);
            if (k && k.startsWith('lhi-seasonal-banner-aep-')) localStorage.removeItem(k);
          }
        } catch {
          /* ignore */
        }
      });
      await page.addScriptTag({ url: `${server.baseUrl}/js/lead-hero.js?v=${PIN}` });
      await page.waitForTimeout(150);
      if (!(await page.evaluate(() => Boolean(window.LHISiteChrome)))) {
        await page.addScriptTag({ url: `${server.baseUrl}/js/site-template.js?v=20261021-hscroll-fix` });
        await page.waitForTimeout(400);
      }
      await page.evaluate(() => {
        const intro = document.querySelector('.lhi-post-body-intro');
        if (intro) {
          const top = intro.getBoundingClientRect().top + window.pageYOffset - 72;
          window.scrollTo(0, Math.max(0, top));
        }
      });
      await page.waitForTimeout(250);
      const outPath = join(OUT, `${name}-intro-${tag}.png`);
      await page.screenshot({ path: outPath });
      console.log('saved', outPath);
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
