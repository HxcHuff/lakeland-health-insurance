#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = resolve('/workspace');
const OUT = '/cursor/stores/self/media/sitewide-hero-fix';
const SHOTS = [
  { url: '/aca-health-insurance-lakeland-fl/', file: 'v5-aca-lakeland-390.png' },
  { url: '/blog/turning-65-medicare-checklist-florida.html', file: 'v5-turning-65-390.png' },
  { url: '/losing-coverage/', file: 'v5-losing-coverage-390.png' },
  { url: '/medicare-broker-lakeland-fl/', file: 'v5-medicare-broker-390.png' }
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

try {
  for (const { url, file } of SHOTS) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/js/site-template.js*', (route) => route.abort());
    await page.goto(`${server.baseUrl}${url}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { state: 'visible' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, file), fullPage: false });
    await page.close();
    console.log('saved', file);
  }
} finally {
  await browser.close();
  await server.close();
}
