import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const BANNER_KEY = 'lhi-seasonal-banner-aep-2026-v1';
const CHROME_PATH = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome';

function startStaticServer() {
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const filePath = join(ROOT, pathname.replace(/^\//, ''));
      const body = readFileSync(filePath);
      const type = filePath.endsWith('.css')
        ? 'text/css'
        : filePath.endsWith('.js')
          ? 'application/javascript'
          : 'text/html';
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

async function chromeBottom(page) {
  return page.evaluate(() => {
    let bottom = 0;
    for (const sel of ['.top-strip', 'header', '.seasonal-banner']) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.height > 0) bottom = Math.max(bottom, r.bottom);
    }
    return Math.round(bottom);
  });
}

async function assertHomepageClearance(page, label) {
  const headerBottom = await chromeBottom(page);
  const h1Box = await page.locator('body.home-page .lhi-hero-shell h1').first().boundingBox();
  const formBox = await page
    .locator('body.home-page .lhi-hero-grid-lead .lhi-lead-hero__card')
    .first()
    .boundingBox();
  assert.ok(h1Box, `${label}: homepage H1 renders`);
  assert.ok(formBox, `${label}: homepage lead form renders`);
  assert.ok(
    h1Box.y >= headerBottom - 2,
    `${label}: H1 top ${h1Box.y} should be below chrome bottom ${headerBottom}`
  );
  assert.ok(
    formBox.y >= headerBottom - 2,
    `${label}: form top ${formBox.y} should be below chrome bottom ${headerBottom}`
  );
}

async function loadHomepage(page, baseUrl, { bannerDismissed }) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.evaluate(
    ({ key, dismissed }) => {
      try {
        if (dismissed) localStorage.setItem(key, 'dismissed');
        else localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      window.scrollTo(0, 0);
    },
    { key: BANNER_KEY, dismissed: bannerDismissed }
  );
  await page.addScriptTag({ url: `${baseUrl}/js/site-template.js?v=20261017-tpmo-10-74` });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
}

test('homepage hero CSS keeps header offset (no sitewide gray clamp override)', () => {
  const css = readFileSync(join(ROOT, 'css/lead-hero.css'), 'utf8');
  assert.match(css, /body\.home-page \.lhi-hero-shell[\s\S]*padding-top: calc\(var\(--lhi-site-header-height/);
  assert.doesNotMatch(
    css,
    /body\.lhi-page-hero \.lhi-hero-shell\s*\{\s*padding-top: clamp\(1\.25rem, 3vw, 2rem\)/s
  );
});

for (const viewport of [
  { width: 1280, height: 800, name: '1280x800' },
  { width: 1000, height: 600, name: '1000x600' }
]) {
  for (const bannerMode of ['shown', 'dismissed']) {
    test(`homepage H1 and form clear fixed header @${viewport.name} banner ${bannerMode}`, async () => {
      const server = await startStaticServer();
      const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
      try {
        const page = await browser.newPage({ viewport });
        await page.route('**/*', (route) => {
          const u = route.request().url();
          if (/google-analytics|googletagmanager|facebook\.com\/tr|doubleclick/i.test(u)) {
            return route.abort();
          }
          return route.continue();
        });
        await loadHomepage(page, server.baseUrl, { bannerDismissed: bannerMode === 'dismissed' });
        await assertHomepageClearance(page, `${viewport.name}/${bannerMode}`);
      } finally {
        await browser.close();
        await server.close();
      }
    });
  }
}
