import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

const PAGES = [
  { path: '/index.html', label: 'homepage' },
  { path: '/davenport-health-insurance/index.html', label: 'city page' },
  { path: '/carriers/ambetter-aca-2026/index.html', label: 'carrier page' },
  { path: '/health-insurance-texas/index.html', label: 'state page' },
  { path: '/blog/orlando-health-watson-clinic-insurance-2026.html', label: 'Watson blog' }
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

test('H1 is visible above lead form on mobile for representative templates', async () => {
  const server = await startStaticServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
  });
  try {
    for (const { path, label } of PAGES) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.route('**/js/site-template.js*', (route) => route.abort());
      await page.goto(`${server.baseUrl}${path}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
      const h1Box = await page
        .locator('.answer-hero h1, section.hero h1, .lhi-hero-shell h1, main h1, h1')
        .first()
        .boundingBox();
      const nameField = await page.locator('.lhi-lead-hero label[for*="full_name"], .lhi-lead-hero input[name="full_name"]').first().boundingBox();
      const formBox = await page.locator('.lhi-lead-hero__card, .lhi-lead-hero form').first().boundingBox();
      assert.ok(h1Box, `${label}: h1 has layout box`);
      if (formBox) {
        assert.ok(h1Box.y < formBox.y, `${label}: h1 appears above lead form on mobile`);
      }
      if (nameField) {
        assert.ok(nameField.y < 844 * 2, `${label}: lead form Name field starts within ~2 mobile viewports`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
});
