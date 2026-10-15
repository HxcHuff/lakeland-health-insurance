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

function isNavyish(rgb) {
  if (!rgb) return false;
  const [r, g, b] = rgb;
  return r < 80 && g < 80 && b > 100;
}

test('hub hero copy reads as one navy band on mobile @390', async () => {
  const server = await startStaticServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/js/site-template.js*', (route) => route.abort());
    await page.goto(`${server.baseUrl}/plans/index.html`, { waitUntil: 'networkidle' });
    const eyebrow = page.locator('.lhi-hero-shell .eyebrow').first();
    const h1 = page.locator('.lhi-hero-shell h1').first();
    const lede = page.locator('.lhi-hero-shell p.lhi-hero-lede').first();
    const eyebrowBox = await eyebrow.boundingBox();
    const h1Box = await h1.boundingBox();
    const ledeBox = await lede.boundingBox();
    assert.ok(eyebrowBox && h1Box && ledeBox, 'hero copy nodes have layout');
    const gapEyebrowH1 = h1Box.y - (eyebrowBox.y + eyebrowBox.height);
    const gapH1Lede = ledeBox.y - (h1Box.y + h1Box.height);
    assert.ok(gapEyebrowH1 < 2, `eyebrow/h1 gap ${gapEyebrowH1}px`);
    assert.ok(gapH1Lede < 2, `h1/lede gap ${gapH1Lede}px`);
    const padLeft = await eyebrow.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
    assert.ok(padLeft >= 16, 'hero band has inner horizontal padding');
    const radius = await eyebrow.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    assert.notEqual(radius, '0px', 'hero band uses rounded corners');
    const h1Styles = await h1.evaluate((el) => {
      const style = getComputedStyle(el);
      return { backgroundImage: style.backgroundImage, backgroundColor: style.backgroundColor };
    });
    const h1HasBand = String(h1Styles.backgroundImage).includes('gradient') || isNavyish(parseRgb(h1Styles.backgroundColor));
    assert.ok(h1HasBand, `h1 keeps navy band background, got ${JSON.stringify(h1Styles)}`);
    await page.close();
  } finally {
    await browser.close();
    await server.close();
  }
});

test('inline blog lead form title meets contrast on hero background', async () => {
  const css = readFileSync(join(ROOT, 'css/lead-hero.css'), 'utf8');
  assert.match(
    css,
    /section\.hero:has\(\.lhi-lead-hero\) \.lhi-lead-hero__intro \.lhi-lead-hero__title[\s\S]*color:\s*#fff/s,
  );
});
