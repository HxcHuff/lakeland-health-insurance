import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

function startStaticServer() {
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const filePath = join(ROOT, pathname.replace(/^\//, ''));
      const body = readFileSync(filePath);
      const type = filePath.endsWith('.css') ? 'text/css' : filePath.endsWith('.js') ? 'application/javascript' : 'text/html';
      response.writeHead(200, { 'Content-Type': type });
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

function parseRgb(color) {
  const match = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return match ? match.slice(1, 4).map(Number) : null;
}

test('hub hero matches homepage gray stack on mobile @390', async () => {
  const server = await startStaticServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/js/site-template.js*', (route) => route.abort());
    await page.goto(`${server.baseUrl}/plans/index.html`, { waitUntil: 'networkidle' });
    const shellBg = await page.locator('.lhi-hero-shell').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    const shellRgb = parseRgb(shellBg);
    assert.ok(shellRgb && shellRgb.every((v) => v > 240), `shell background should be light gray, got ${shellBg}`);
    const h1Color = await page.locator('.lhi-hero-shell h1').first().evaluate((el) => getComputedStyle(el).color);
    const h1Rgb = parseRgb(h1Color);
    assert.ok(h1Rgb && h1Rgb[2] > 50 && h1Rgb[0] < 80, `h1 should be navy on gray, got ${h1Color}`);
    const formCard = page.locator('.lhi-hero-grid-lead .lhi-lead-hero__card').first();
    const formBox = await formCard.boundingBox();
    const h1Box = await page.locator('.lhi-hero-shell h1').first().boundingBox();
    assert.ok(formBox && h1Box, 'hero copy and form card render');
    assert.ok(formBox.y < h1Box.y + h1Box.height + 320, 'form stays in first mobile screen after headline');
    await page.close();
  } finally {
    await browser.close();
    await server.close();
  }
});

test('gray hero shell hides low-contrast inline lead form title', async () => {
  const css = readFileSync(join(ROOT, 'css/lead-hero.css'), 'utf8');
  assert.match(
    css,
    /body\.lhi-page-hero:not\(\.home-page\) \.lhi-hero-shell \.lhi-lead-hero__intro[\s\S]*display:\s*none !important/s,
  );
});
