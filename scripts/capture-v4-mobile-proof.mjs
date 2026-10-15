#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const OUT = '/cursor/stores/self/media/sitewide-hero-fix';
const SHOTS = [
  { url: '/medicare/', file: 'v4-medicare-390.png' },
  { url: '/blog/orlando-health-watson-clinic-insurance-2026.html', file: 'v4-watson-390.png' },
  { url: '/aca-health-insurance-lakeland-fl/', file: 'v4-aca-lakeland-390.png' },
  { url: '/blog/turning-65-medicare-checklist-florida.html', file: 'v4-turning-65-390.png' }
];

function contentType(pathname) {
  if (pathname.endsWith('.css')) return 'text/css';
  if (pathname.endsWith('.js')) return 'application/javascript';
  if (pathname.endsWith('.woff2')) return 'font/woff2';
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
  for (const { url, file } of SHOTS) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    });
    await page.goto(`${server.baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { state: 'visible' });
    await page.evaluate(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
    await page.waitForTimeout(300);
    const scrollY = await page.evaluate(() => window.scrollY);
    const h1Text = await page.locator('h1').first().innerText();
    console.log(file, 'scrollY=', scrollY, 'h1=', h1Text.slice(0, 40));
    await page.screenshot({ path: join(OUT, file), fullPage: false });
    await page.close();
    console.log('saved', file);
  }
} finally {
  await browser.close();
  await server.close();
}
