#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = resolve('/workspace');
const OUT = '/cursor/stores/self/media/sitewide-hero-fix';

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
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${server.baseUrl}/medicare/`, { waitUntil: 'networkidle' });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(250);
await page.screenshot({ path: join(OUT, 'medicare-hero-top-390.png'), fullPage: false });

const hero = page.locator('section.medicare-hero');
const box = await hero.boundingBox();
if (box) {
  await page.screenshot({
    path: join(OUT, 'medicare-hero-full-390.png'),
    clip: { x: 0, y: Math.max(0, box.y), width: 390, height: Math.min(box.height, 2000) }
  });
}

const metrics = await page.evaluate(() => {
  const h1 = document.querySelector('.medicare-hero h1');
  const form = document.querySelector('.medicare-hero form.sitelink-lead-form');
  const name = document.querySelector('#medicareLeadName');
  const h1Rect = h1?.getBoundingClientRect();
  const formRect = form?.getBoundingClientRect();
  const nameRect = name?.getBoundingClientRect();
  return {
    h1Top: h1Rect?.top,
    formTop: formRect?.top,
    nameTop: nameRect?.top,
    viewport: 844
  };
});
console.log(JSON.stringify(metrics, null, 2));

await browser.close();
await server.close();
