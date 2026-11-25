import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SITE_TEMPLATE = readFileSync(join(ROOT, 'js/site-template.js'), 'utf8');
const CHROME_PATH =
  process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH ||
  (existsSync('/usr/local/bin/google-chrome')
    ? '/usr/local/bin/google-chrome'
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');

function contentType(pathname) {
  if (pathname.endsWith('.css')) return 'text/css';
  if (pathname.endsWith('.js')) return 'application/javascript';
  if (pathname.endsWith('.woff2')) return 'font/woff2';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.webp')) return 'image/webp';
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

test('multi-state disruption guides use 23-state footer copy while keeping Medicare TPMO intact', () => {
  const sandbox = {
    document: {
      readyState: 'loading',
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      body: { getAttribute() { return ''; } }
    },
    location: { pathname: '/', search: '' },
    window: {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SITE_TEMPLATE, sandbox, { filename: 'site-template.js' });
  const chrome = sandbox.LHISiteChrome;

  assert.equal(chrome.isMultiStateFooterPage('/blog/braven-health-new-jersey-medicare-exit-2027.html'), true);
  assert.equal(chrome.isMultiStateFooterPage('/blog/wellmark-iowa-medicare-advantage-exit-2027.html'), true);
  assert.equal(chrome.isMultiStateFooterPage('/blog/baylor-scott-white-humana-texas-2027.html'), true);
  assert.equal(chrome.isMultiStateFooterPage('/blog/bjc-healthcare-washu-aetna-anthem-st-louis-2027.html'), true);
  assert.equal(chrome.isMultiStateFooterPage('/blog/providence-swedish-kadlec-unitedhealthcare-washington-2027.html'), true);
  assert.equal(chrome.isMultiStateFooterPage('/medigap-birthday-anniversary-rules-2027/'), true);
  assert.equal(chrome.isMultiStateFooterPage('/health-insurance-texas/'), true);

  // Florida / Lakeland pages stay Florida-local
  assert.equal(chrome.isMultiStateFooterPage('/blog/orlando-health-watson-clinic-insurance-2026.html'), false);
  assert.equal(chrome.isMultiStateFooterPage('/blog/health-first-exiting-polk-county-medicare-2027.html'), false);
  assert.equal(chrome.isMultiStateFooterPage('/medicare-broker-lakeland-fl/'), false);

  // Critical compliance check: Medicare disruption guides still render TPMO disclaimer
  assert.equal(chrome.shouldShowTpmoDisclaimer('/blog/braven-health-new-jersey-medicare-exit-2027.html'), true);
  assert.equal(chrome.shouldShowTpmoDisclaimer('/blog/wellmark-iowa-medicare-advantage-exit-2027.html'), true);
});

test('lead-hero trust strip renders David photo, 5.0 26 reviews, and geo-matched SMS CTA without shifting form', async () => {
  const server = await startStaticServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH
  });
  try {
    const cases = [
      {
        path: '/blog/orlando-health-watson-clinic-insurance-2026.html',
        expectSmsMatch: /Watson%20Clinic/i,
        forbidSmsMatch: /New%20Jersey/i,
        expectCredMatch: /FL Agent #W371813/
      },
      {
        path: '/blog/braven-health-new-jersey-medicare-exit-2027.html',
        expectSmsMatch: /New%20Jersey/i,
        forbidSmsMatch: /Lakeland/i,
        expectCredMatch: /Licensed in 23 States/
      },
      {
        path: '/blog/baylor-scott-white-humana-texas-2027.html',
        expectSmsMatch: /Texas/i,
        forbidSmsMatch: /Lakeland/i,
        expectCredMatch: /Licensed in 23 States/
      }
    ];

    for (const item of cases) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.route('**/js/site-template.js*', (route) => route.abort());
      await page.goto(`${server.baseUrl}${item.path}`, { waitUntil: 'networkidle' });

      const strip = page.locator('.lhi-lead-hero__card .lhi-lead-hero__trust').first();
      await strip.waitFor({ state: 'visible', timeout: 5000 });
      const text = await strip.textContent();
      assert.match(text, /David Huff/);
      assert.match(text, item.expectCredMatch);
      assert.match(text, /5\.0.*26 Google reviews/);

      const photoSrc = await strip.locator('img.lhi-lead-hero__trust-photo').getAttribute('src');
      assert.equal(photoSrc, '/assets/images/david-huff-blue-polo-480.jpg');

      const smsBtn = strip.locator('a[data-lhi-sms-cta="lead_hero_trust_sms"]');
      const smsHref = await smsBtn.getAttribute('href');
      assert.match(smsHref, /^sms:\+18636403102\?body=/);
      assert.match(smsHref, item.expectSmsMatch);
      assert.doesNotMatch(smsHref, item.forbidSmsMatch);

      // Ensure trust strip sits below the form and never pushes mobile Name field down
      const formBox = await page.locator('.lhi-lead-hero__card form').first().boundingBox();
      const stripBox = await strip.boundingBox();
      assert.ok(formBox && stripBox && stripBox.y >= formBox.y + formBox.height - 2, `${item.path}: trust strip sits below form`);
      await page.close();
    }

    // Homepage skips duplicate trust strip (already has portrait hero beside form)
    const home = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await home.route('**/js/site-template.js*', (route) => route.abort());
    await home.goto(`${server.baseUrl}/index.html`, { waitUntil: 'networkidle' });
    assert.equal(await home.locator('.lhi-lead-hero__trust').count(), 0);
    await home.close();
  } finally {
    await browser.close();
    await server.close();
  }
});
