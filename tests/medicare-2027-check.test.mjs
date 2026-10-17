import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const HTML = readFileSync(resolve(ROOT, 'medicare-2027-check/index.html'), 'utf8');
const HEADERS = readFileSync(resolve(ROOT, '_headers'), 'utf8');
const SITEMAP = readFileSync(resolve(ROOT, 'sitemap.xml'), 'utf8');

const V2_SMS_SNIPPET =
  'By checking this box, I give my prior express consent for Lakeland Health Insurance (David Huff, licensed insurance agent) to send text messages about this request to the mobile number I entered above.';
const META_DESCRIPTION =
  'Request help checking whether your doctors appear in 2027 Medicare plan directories during Annual Enrollment (October 15 to December 7). A local Lakeland agent will review your options.';

test('medicare-2027-check is a noindex demand-gen route excluded from sitemap and Meta audience', () => {
  assert.match(HTML, /<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(HTML, /<link rel="canonical"/);
  assert.doesNotMatch(HTML, /meta-audience-eligible/i);
  assert.doesNotMatch(SITEMAP, /medicare-2027-check/);
  assert.match(HEADERS, /\/medicare-2027-check\/\n\s+X-Robots-Tag: noindex, nofollow/);
});

test('medicare-2027-check mobile-first hero and four-field get-help v2 form', () => {
  assert.match(HTML, /Is your doctor still in your 2027 Medicare plan\?/);
  assert.match(HTML, new RegExp(META_DESCRIPTION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(HTML, /property="og:description" content="[^"]*Annual Enrollment \(October 15 to December 7\)/);
  assert.match(HTML, /name="twitter:description" content="[^"]*Annual Enrollment \(October 15 to December 7\)/);
  assert.match(
    HTML,
    /A local Lakeland agent will check your doctors for you\. A review is not enrollment or a network guarantee\./
  );
  assert.match(HTML, /data-page-key="medicare-2027-check"/);
  assert.doesNotMatch(HTML, /paid-landing-page/);
  assert.match(HTML, /class="cta-button m27-submit-style m27-mobile-jump" href="#medicare2027CheckForm">Check my doctors<\/a>/);
  assert.doesNotMatch(HTML, /m27-mobile-jump[^>]*data-funnel/);
  const form = HTML.match(/<form[^>]*data-sitelink-lead-form[\s\S]*?<\/form>/);
  assert.ok(form, 'get-help sitelink form is present');
  const markup = form[0];
  assert.match(markup, /name="get-help"/);
  assert.match(markup, /name="consent_text_version" value="get-help-2026-09-29-v2"/);
  assert.match(markup, /name="consent_page" value="\/medicare-2027-check\/"/);
  assert.match(markup, /name="source_page_key" value="medicare-2027-check"/);
  assert.match(markup, /name="content_name" value="first_party_lead"/);
  assert.match(markup, /name="line_of_business" value="medicare"/);
  assert.match(markup, /name="_subject" value="New Lead: Medicare 2027 doctor check"/);
  assert.match(markup, /name="full_name"/);
  assert.match(markup, /name="phone"[^>]*required/);
  assert.match(markup, /name="zip_code"/);
  assert.match(markup, /name="providers"/);
  assert.match(markup, /name="consent_request" value="yes"/);
  assert.match(markup, new RegExp(V2_SMS_SNIPPET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(
    markup.indexOf('name="consent_request"') < markup.indexOf('Check my doctors'),
    'consent block must appear before submit button (get-help order)'
  );
  assert.match(markup, /class="cta-button m27-submit" type="submit">Check my doctors<\/button>/);
  assert.doesNotMatch(markup, /name="email"/);
  assert.doesNotMatch(markup, /preferred_contact_method/);
  assert.doesNotMatch(markup, /name="consent_email"/);
  assert.doesNotMatch(markup, /<input type="hidden" name="consent_call"/);
  assert.doesNotMatch(markup, /<input type="hidden" name="consent_sms"/);
  assert.match(markup, /type="checkbox" name="consent_call"/);
  assert.match(markup, /type="checkbox" name="consent_sms"/);
  assert.doesNotMatch(markup, /lp-medicare-lead/);
  assert.match(markup, /data-sitelink-inline-thank-you/);
});

test('medicare-2027-check avoids site-template.css (layout isolated to page styles)', () => {
  assert.doesNotMatch(HTML, /site-template\.css/);
});

test('medicare-2027-check trust bullets and TPMO disclosure ids', () => {
  assert.match(HTML, /Local Lakeland agent/);
  assert.match(HTML, /Compares plans from multiple carriers/);
  assert.match(HTML, /Help comparing 2027 plans for your doctors and prescriptions/);
  assert.match(HTML, /id="medicareTpmoDisclaimer"/);
  assert.match(HTML, /id="floridaTpmoInventoryNote"/);
  assert.match(HTML, /id="medicareGenericTpmoDisclaimer"/);
  assert.match(HTML, /id="outOfStateMedicareNote"/);
  assert.match(HTML, /Licensed Insurance Agent #W371813/);
  assert.match(HTML, /get-help-intake\.js\?v=20261016-pr345-get-help-intake/);
  assert.doesNotMatch(HTML, /\/lp\//);
});

test('medicare-2027-check sitelink submit succeeds when call consent is checked', async () => {
  const server = createServer((request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      if (pathname === '/api/lead') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ ok: true, forms: true, event_id: 'lhi_test_event_001' }));
        return;
      }
      if (pathname.endsWith('/')) pathname += 'index.html';
      const body = readFileSync(join(ROOT, pathname.replace(/^\//, '')));
      const type = pathname.endsWith('.js') ? 'application/javascript' : 'text/html';
      response.writeHead(200, { 'Content-Type': type });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('not found');
    }
  });
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const { port } = server.address();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://127.0.0.1:${port}/medicare-2027-check/`, { waitUntil: 'networkidle' });
    await page.addScriptTag({ url: `http://127.0.0.1:${port}/js/funnel.js?v=20261016-pr345-funnel` });
    await page.waitForFunction(() => {
      const form = document.getElementById('medicare2027CheckForm');
      return Boolean(form && form.__lhiSitelinkLeadWired);
    });
    await page.fill('#medicare2027Name', 'Jane');
    await page.fill('#medicare2027Phone', '8635551212');
    await page.fill('#medicare2027Zip', '33805');
    await page.check('input[name="consent_request"]');
    await page.check('input[name="consent_call"]');
    await page.click('.cta-button.m27-submit');
    await page.waitForSelector('.m27-thanks', { timeout: 8000 });
    const thanks = await page.locator('.m27-thanks').textContent();
    assert.match(String(thanks || ''), /Thanks/i);
    assert.doesNotMatch(String(thanks || ''), /Select at least one contact channel/i);
  } finally {
    await browser.close();
    await new Promise((resolvePromise) => server.close(() => resolvePromise()));
  }
});

test('medicare-2027-check mobile jump CTA and submit positions at 390x844 and 1280x800', async () => {
  const server = createServer((request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const body = readFileSync(join(ROOT, pathname.replace(/^\//, '')));
      const type = pathname.endsWith('.js') ? 'application/javascript' : pathname.endsWith('.css') ? 'text/css' : 'text/html';
      response.writeHead(200, { 'Content-Type': type });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('not found');
    }
  });
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const { port } = server.address();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://127.0.0.1:${port}/medicare-2027-check/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 0));
    const mobile = await page.evaluate(() => {
      const hero = document.querySelector('.m27-hero-stack');
      const form = document.querySelector('.m27-form');
      const jump = document.querySelector('.m27-mobile-jump');
      const button = document.querySelector('button.cta-button.m27-submit');
      const consent = document.querySelector('.m27-consent span');
      const jumpRect = jump.getBoundingClientRect();
      const submitRect = button.getBoundingClientRect();
      return {
        gapHeroForm: form.getBoundingClientRect().top - hero.getBoundingClientRect().bottom,
        jumpTop: jumpRect.top,
        jumpBottom: jumpRect.bottom,
        jumpDisplay: getComputedStyle(jump).display,
        submitTop: submitRect.top,
        submitBottom: submitRect.bottom,
        consentFontPx: parseFloat(getComputedStyle(consent).fontSize)
      };
    });
    assert.equal(mobile.jumpDisplay, 'inline-flex', 'mobile jump CTA should be visible at 390px');
    assert.ok(mobile.jumpBottom <= 844, `jump CTA bottom ${mobile.jumpBottom}px should stay on first screen`);
    assert.ok(mobile.gapHeroForm <= 12, `form should start directly under hero stack (gap ${mobile.gapHeroForm}px)`);
    assert.ok(mobile.consentFontPx >= 13, `consent copy should be at least 13px (got ${mobile.consentFontPx}px)`);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const desktop = await page.evaluate(() => {
      const jump = document.querySelector('.m27-mobile-jump');
      const button = document.querySelector('button.cta-button.m27-submit');
      const jumpRect = jump.getBoundingClientRect();
      const submitRect = button.getBoundingClientRect();
      return {
        jumpDisplay: getComputedStyle(jump).display,
        jumpTop: jumpRect.top,
        jumpBottom: jumpRect.bottom,
        submitTop: submitRect.top,
        submitBottom: submitRect.bottom
      };
    });
    assert.equal(desktop.jumpDisplay, 'none', 'mobile jump CTA should be hidden above 640px');
    assert.ok(desktop.submitBottom <= 800, `submit bottom ${desktop.submitBottom}px should stay within 1280x800 first screen`);
  } finally {
    await browser.close();
    await new Promise((resolvePromise) => server.close(() => resolvePromise()));
  }
});

test('medicare-2027-check out-of-state Medicare note stays hidden until state is known and unlicensed', async () => {
  const server = createServer((request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const body = readFileSync(join(ROOT, pathname.replace(/^\//, '')));
      const type = pathname.endsWith('.js') ? 'application/javascript' : 'text/html';
      response.writeHead(200, { 'Content-Type': type });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('not found');
    }
  });
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const { port } = server.address();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
  });
  try {
    const page = await browser.newPage();
    const noteVisible = async () =>
      page.evaluate(() => {
        const note = document.getElementById('outOfStateMedicareNote');
        return Boolean(note && !note.hidden && getComputedStyle(note).display !== 'none');
      });

    await page.goto(`http://127.0.0.1:${port}/medicare-2027-check/`, { waitUntil: 'networkidle' });
    assert.equal(await noteVisible(), false, 'default load without state should hide out-of-state note');

    await page.goto(`http://127.0.0.1:${port}/medicare-2027-check/?state=NY`, { waitUntil: 'networkidle' });
    assert.equal(await noteVisible(), true, 'unlicensed state should show out-of-state note');

    await page.goto(`http://127.0.0.1:${port}/medicare-2027-check/?state=TX`, { waitUntil: 'networkidle' });
    assert.equal(await noteVisible(), false, 'licensed TX should hide out-of-state note');

    await page.goto(`http://127.0.0.1:${port}/medicare-2027-check/?state=FL`, { waitUntil: 'networkidle' });
    assert.equal(await noteVisible(), false, 'FL should hide out-of-state note');
  } finally {
    await browser.close();
    await new Promise((resolvePromise) => server.close(() => resolvePromise()));
  }
});

test('medicare-2027-check H1 offset and gold submit styles at 390x844', async () => {
  const server = createServer((request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const body = readFileSync(join(ROOT, pathname.replace(/^\//, '')));
      const type = pathname.endsWith('.css') ? 'text/css' : 'text/html';
      response.writeHead(200, { 'Content-Type': type });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('not found');
    }
  });
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const { port } = server.address();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://127.0.0.1:${port}/medicare-2027-check/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 0));
    const metrics = await page.evaluate(() => {
      const h1 = document.querySelector('.m27-title');
      const disc = document.querySelector('.site-page-disclosures');
      const button = document.querySelector('button.cta-button.m27-submit');
      const computed = getComputedStyle(button);
      return {
        h1Top: h1.getBoundingClientRect().top,
        discWidth: disc.getBoundingClientRect().width,
        backgroundColor: computed.backgroundColor,
        color: computed.color,
        borderRadius: computed.borderRadius,
        fontWeight: computed.fontWeight
      };
    });
    assert.ok(Math.abs(metrics.h1Top - 63.03125) < 1.5, `H1 top ${metrics.h1Top}px should match pre-site-template layout (~63px)`);
    assert.ok(Math.abs(metrics.discWidth - 358) < 1.5, `disclosure width ${metrics.discWidth}px should stay 358px at 390 viewport`);
    assert.equal(metrics.backgroundColor, 'rgb(212, 168, 67)', 'gold background (#D4A843)');
    assert.equal(metrics.color, 'rgb(15, 26, 46)', 'navy-deep text (#0F1A2E)');
    assert.match(metrics.borderRadius, /100px|50%/);
    assert.match(metrics.fontWeight, /600|700/);
  } finally {
    await browser.close();
    await new Promise((resolvePromise) => server.close(() => resolvePromise()));
  }
});
