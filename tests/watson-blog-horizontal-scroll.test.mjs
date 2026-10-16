import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

const WATSON_BLOG_PAGES = [
  '/blog/orlando-health-watson-clinic-insurance-2026.html',
  '/blog/orlando-health-watson-clinic-doctors-network-2026.html',
  '/blog/watson-clinic-urgent-care.html',
  '/blog/change-florida-blue-myblue-pcp-watson-clinic.html'
];

function contentType(pathname) {
  if (pathname.endsWith('.css')) return 'text/css';
  if (pathname.endsWith('.js')) return 'application/javascript';
  if (pathname.endsWith('.woff2')) return 'font/woff2';
  return 'text/html';
}

function startStaticServer() {
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const filePath = join(ROOT, pathname.replace(/^\//, ''));
      const body = readFileSync(filePath);
      response.writeHead(200, { 'Content-Type': contentType(pathname) });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('not found');
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolvePromise({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r()))
      });
    });
  });
}

test('Watson lead-hero blog posts do not scroll horizontally at 1280px', async () => {
  const server = await startStaticServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
  });
  try {
    for (const path of WATSON_BLOG_PAGES) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(`${server.baseUrl}${path}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(
        scrollWidth <= 1280,
        `${path}: document scrollWidth ${scrollWidth} exceeds viewport 1280`
      );
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
});
