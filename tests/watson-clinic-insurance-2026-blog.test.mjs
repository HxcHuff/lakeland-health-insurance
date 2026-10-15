import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PAGE = 'blog/orlando-health-watson-clinic-insurance-2026.html';
const PAGE_URL = '/blog/orlando-health-watson-clinic-insurance-2026.html';

function source() {
  return readFileSync(join(ROOT, PAGE), 'utf8');
}

function extractJsonLd(html, type) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/g)].map(
    (m) => m[1]
  );
  for (const block of blocks) {
    const data = JSON.parse(block);
    if (data['@type'] === type) return data;
  }
  return null;
}

function extractVisibleFaq(html) {
  const faqSection = html.match(/<section class="card">\s*<h2>FAQ<\/h2>([\s\S]*?)<\/section>/i);
  assert.ok(faqSection, 'FAQ section exists');
  const chunk = faqSection[1];
  const pairs = [];
  for (const m of chunk.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)) {
    pairs.push({
      name: m[1].replace(/\s+/g, ' ').trim(),
      text: m[2].replace(/\s+/g, ' ').trim()
    });
  }
  return pairs;
}

test('Watson blog schema headline matches visible H1', () => {
  const html = source();
  const posting = extractJsonLd(html, 'BlogPosting');
  assert.ok(posting?.headline);
  const h1Html = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '';
  const h1Text = h1Html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.equal(h1Text, 'Orlando Health and Watson Clinic Insurance Guide');
  assert.equal(posting.headline, h1Text);
});

test('Watson FAQPage JSON-LD matches visible FAQ copy', () => {
  const html = source();
  const faq = extractJsonLd(html, 'FAQPage');
  const visible = extractVisibleFaq(html);
  assert.ok(faq?.mainEntity?.length);
  assert.equal(faq.mainEntity.length, visible.length);
  for (let i = 0; i < visible.length; i += 1) {
    assert.equal(faq.mainEntity[i].name, visible[i].name);
    assert.equal(faq.mainEntity[i].acceptedAnswer.text, visible[i].text);
  }
});

test('Watson blog keeps #318 internal links', () => {
  const html = source();
  assert.match(
    html,
    /href="\/local-health-insurance-answers\/lakeland-regional-unitedhealthcare-2027\/"/
  );
  assert.match(html, /href="\/retiring-and-medicare-lakeland-fl\/"/);
});

const FULL_SHIP =
  'We do not offer every plan available in your area. Currently we represent 8 organizations which offer 65 products in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local State Health Insurance Program (SHIP) to get information on all of your options.';

test('Watson blog keeps static bottom TPMO (SHIP) for no-JS compliance', () => {
  const html = source();
  assert.match(html, /class="site-page-disclosures"/, 'static bottom disclosure block');
  assert.ok(html.includes(FULL_SHIP), 'SHIP TPMO in static HTML');
  assert.doesNotMatch(html, /class="tpmo-cta-disclaimer"/, 'no inline TPMO near CTAs');
  assert.match(html, /site-template\.js/, 'shared chrome skips footer TPMO when static block exists');
});

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

test('Watson H1 is visible in first mobile viewport', async () => {
  const server = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${server.baseUrl}${PAGE_URL}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    const h1Box = await page.locator('h1').first().boundingBox();
    assert.ok(h1Box, 'h1 has layout box');
    assert.ok(h1Box.y >= 0, 'h1 top is not above viewport');
    assert.ok(h1Box.y + h1Box.height <= 844, 'h1 fits within 390x844 viewport height');
  } finally {
    await browser.close();
    await server.close();
  }
});
