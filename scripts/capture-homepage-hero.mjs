#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = resolve('/workspace');
const OUT = '/cursor/stores/self/media/sitewide-hero-fix';
const VIEWS = [
  { w: 1280, h: 800, file: 'homepage-hero-top-1280.png' },
  { w: 1440, h: 900, file: 'homepage-hero-top-1440.png' },
  { w: 390, h: 844, file: 'homepage-hero-top-390.png' }
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
const browser = await chromium.launch({ headless: true });

for (const { w, h, file } of VIEWS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${server.baseUrl}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('header .nav-links') && document.querySelector('header .brand-name'), { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const metrics = await page.evaluate(() => {
    const h1 = document.querySelector('.home-hero h1');
    const form = document.querySelector('.home-hero .lhi-lead-hero__card');
    const name = document.querySelector('#siteLead_full_name');
    const grid = document.querySelector('.home-hero-grid');
    const h1Style = h1 ? getComputedStyle(h1) : null;
    const gridStyle = grid ? getComputedStyle(grid) : null;
    return {
      h1Top: h1?.getBoundingClientRect().top,
      h1MaxWidth: h1Style?.maxWidth,
      h1LineHeight: h1Style?.lineHeight,
      gridDisplay: gridStyle?.display,
      gridCols: gridStyle?.gridTemplateColumns,
      formTop: form?.getBoundingClientRect().top,
      nameTop: name?.getBoundingClientRect().top,
      docWidth: document.documentElement.scrollWidth
    };
  });
  console.log(file, JSON.stringify(metrics));
  await page.screenshot({ path: join(OUT, file), fullPage: false });
  await page.close();
}

await browser.close();
await server.close();
