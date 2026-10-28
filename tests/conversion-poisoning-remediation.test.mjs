import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const CHROME_PATH =
  process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH ||
  (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/local/bin/google-chrome');

function contentTypeFor(filePath) {
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.woff2')) return 'font/woff2';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.ico')) return 'image/x-icon';
  return 'text/html; charset=utf-8';
}

function resolveLocalRepoFile(pathname) {
  let clean = decodeURIComponent(pathname || '/');
  if (clean.startsWith('/.netlify/images')) {
    return null;
  }
  if (clean.endsWith('/')) {
    clean += 'index.html';
  }
  let candidate = join(ROOT, clean.replace(/^\//, ''));
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    candidate = join(candidate, 'index.html');
  } else if (!existsSync(candidate) && existsSync(`${candidate}.html`)) {
    candidate = `${candidate}.html`;
  }
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }
  return null;
}

const MOCK_GTAG_JS = `
(function () {
  window.__mockGtagProcessed = window.__mockGtagProcessed || [];
  function sendCollect(eventName, extraParams) {
    var qs = new URLSearchParams();
    qs.set('v', '2');
    qs.set('tid', 'G-W45RMKHXV0');
    qs.set('en', String(eventName || ''));
    if (extraParams && typeof extraParams === 'object') {
      if (extraParams.form_id) qs.set('ep.form_id', String(extraParams.form_id));
      if (extraParams.event_id) qs.set('ep.event_id', String(extraParams.event_id));
      if (extraParams.page_location) qs.set('dl', String(extraParams.page_location));
    }
    var url = 'https://region1.google-analytics.com/g/collect?' + qs.toString();
    try {
      navigator.sendBeacon(url);
    } catch (e) {
      fetch(url, { method: 'POST', keepalive: true }).catch(function () {});
    }
  }

  function handleEntry(entry) {
    if (!entry) return;
    var isArgs = Object.prototype.toString.call(entry) === '[object Arguments]' || Array.isArray(entry);
    if (!isArgs && typeof entry === 'object' && entry.event) {
      return;
    }
    var cmd = entry[0];
    var name = entry[1];
    var params = entry[2] || {};
    if (cmd !== 'event' || !name) return;
    window.__mockGtagProcessed.push({ name: String(name), params: params });
    sendCollect(name, params);

    /* Simulate legacy remote G-W45RMKHXV0 __ogt_event_create rules (tag_ids 25, 26, 27) */
    var path = String(window.location.pathname || '/');
    if (name === 'page_view' && path.indexOf('/blog') === 0) {
      try { window.gtag('event', 'ads_conversion_Blog_Views_1', { send_to: 'G-W45RMKHXV0' }); } catch (e) {}
      try {
        navigator.sendBeacon('https://region1.google-analytics.com/g/collect?v=2&tid=G-W45RMKHXV0&en=ads_conversion_Blog_Views_1');
      } catch (e) {}
      try {
        fetch('https://region1.google-analytics.com/g/collect?v=2&tid=G-W45RMKHXV0', {
          method: 'POST',
          body: 'en=page_view&dl=' + encodeURIComponent(window.location.href) + '\\nen=ads_conversion_Blog_Views_1&dl=' + encodeURIComponent(window.location.href)
        }).catch(function () {});
      } catch (e) {}
    }
    if (name === 'page_view' && path.indexOf('/thanks.html') === 0) {
      try { window.gtag('event', 'ads_conversion_Request_quote_1', { send_to: 'G-W45RMKHXV0' }); } catch (e) {}
      try {
        navigator.sendBeacon('https://region1.google-analytics.com/g/collect?v=2&tid=G-W45RMKHXV0&en=ads_conversion_Request_quote_1');
      } catch (e) {}
    }
    if (name === 'form_submit') {
      try { window.gtag('event', 'ads_conversion_Form_1', { send_to: 'G-W45RMKHXV0' }); } catch (e) {}
      try {
        navigator.sendBeacon('https://region1.google-analytics.com/g/collect?v=2&tid=G-W45RMKHXV0&en=ads_conversion_Form_1');
      } catch (e) {}
    }
  }

  window.dataLayer = window.dataLayer || [];
  var existing = window.dataLayer.slice();
  var origPush = window.dataLayer.push.bind(window.dataLayer);
  window.dataLayer.push = function () {
    var res = origPush.apply(window.dataLayer, arguments);
    for (var i = 0; i < arguments.length; i += 1) {
      handleEntry(arguments[i]);
    }
    return res;
  };
  existing.forEach(handleEntry);
})();
`;

const MOCK_FBEVENTS_JS = `
(function () {
  window.__mockMetaCalls = window.__mockMetaCalls || [];
  function recordCall(argsLike) {
    var args = Array.prototype.slice.call(argsLike);
    window.__mockMetaCalls.push(args);
    var cmd = String(args[0] || '');
    if (cmd === 'track' || cmd === 'trackCustom') {
      var ev = String(args[1] || '');
      fetch('https://www.facebook.com/tr/?id=1480756087079484&ev=' + encodeURIComponent(ev)).catch(function () {});
    } else if (cmd === 'trackSingle' || cmd === 'trackSingleCustom') {
      var pixelId = String(args[1] || '');
      var evName = String(args[2] || '');
      var opts = args[4] || {};
      var eid = opts && opts.eventID ? '&eid=' + encodeURIComponent(String(opts.eventID)) : '';
      fetch('https://www.facebook.com/tr/?id=' + encodeURIComponent(pixelId) + '&ev=' + encodeURIComponent(evName) + eid).catch(function () {});
    }
  }
  var stub = window.fbq;
  var queued = (stub && Array.isArray(stub.queue)) ? stub.queue.slice() : [];
  var realFbq = function () {
    recordCall(arguments);
  };
  realFbq.loaded = true;
  realFbq.version = '2.0';
  realFbq.queue = [];
  realFbq.push = realFbq;
  window.fbq = realFbq;
  window._fbq = realFbq;
  queued.forEach(recordCall);
})();
`;

async function attachProductionHarness(page, options = {}) {
  const gaEvents = [];
  const metaBeacons = [];
  const leadApiRequests = [];
  let leadApiResponder =
    options.leadApiResponder ||
    (() => ({
      status: 200,
      body: { ok: true, forms: true, event_id: '11111111-2222-4333-a444-555555555555' }
    }));

  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());

    if (url.hostname === 'lakelandhealthinsurance.com') {
      if (url.pathname === '/api/lead') {
        let parsed = {};
        try {
          parsed = JSON.parse(req.postData() || '{}');
        } catch {
          parsed = {};
        }
        leadApiRequests.push(parsed);
        const reply = leadApiResponder(parsed, leadApiRequests.length);
        await route.fulfill({
          status: reply.status,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify(reply.body)
        });
        return;
      }

      if (options.holdThanksNavigation && url.pathname === '/thanks.html') {
        await route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: '<!doctype html><html><head><title>Thank You</title></head><body><h1>Request received</h1></body></html>'
        });
        return;
      }

      const filePath = resolveLocalRepoFile(url.pathname);
      if (filePath) {
        await route.fulfill({
          status: 200,
          contentType: contentTypeFor(filePath),
          body: readFileSync(filePath)
        });
        return;
      }

      await route.fulfill({ status: 204, body: '' });
      return;
    }

    if (url.hostname === 'www.googletagmanager.com' && url.pathname.startsWith('/gtag/js')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: MOCK_GTAG_JS
      });
      return;
    }

    if (url.hostname === 'www.googletagmanager.com' && url.pathname.startsWith('/gtm.js')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: '/* gtm stub */'
      });
      return;
    }

    if (url.hostname.includes('google-analytics.com') && url.pathname.includes('/g/collect')) {
      const enQuery = url.searchParams.get('en');
      if (enQuery) {
        gaEvents.push({
          en: enQuery,
          form_id: url.searchParams.get('ep.form_id') || '',
          event_id: url.searchParams.get('ep.event_id') || '',
          dl: url.searchParams.get('dl') || ''
        });
      }
      const postBody = req.postData() || '';
      if (postBody) {
        for (const line of postBody.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const params = new URLSearchParams(trimmed);
          const lineEn = params.get('en');
          if (lineEn) {
            gaEvents.push({
              en: lineEn,
              form_id: params.get('ep.form_id') || '',
              event_id: params.get('ep.event_id') || '',
              dl: params.get('dl') || ''
            });
          }
        }
      }
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    if (url.hostname === 'connect.facebook.net' && url.pathname.endsWith('/fbevents.js')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: MOCK_FBEVENTS_JS
      });
      return;
    }

    if (url.hostname === 'www.facebook.com' && url.pathname.startsWith('/tr')) {
      metaBeacons.push({
        id: url.searchParams.get('id') || '',
        ev: url.searchParams.get('ev') || '',
        eid: url.searchParams.get('eid') || ''
      });
      await route.fulfill({ status: 200, body: '' });
      return;
    }

    await route.fulfill({ status: 204, body: '' });
  });

  return {
    gaEvents,
    metaBeacons,
    leadApiRequests,
    setLeadApiResponder(fn) {
      leadApiResponder = fn;
    }
  };
}

test('zero pageview conversion poisoning or Meta Lead fires on initial page load (including /blog and direct /thanks.html)', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  try {
    const routesToCheck = [
      '/blog/watson-clinic-humana-2027.html',
      '/get-help/',
      '/medicare/',
      '/winter-haven-health-insurance/',
      '/thanks.html'
    ];

    for (const routePath of routesToCheck) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const harness = await attachProductionHarness(page);

      await page.goto(`https://lakelandhealthinsurance.com${routePath}`, { waitUntil: 'load' });
      // Trigger deferred analytics loader (scroll / timer) without interacting with any form field
      await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
      await page.waitForFunction(() => Array.isArray(window.__mockGtagProcessed) && window.__mockGtagProcessed.length > 0, null, {
        timeout: 5000
      });
      await page.waitForTimeout(200);

      const poisoned = harness.gaEvents.filter((e) =>
        [
          'ads_conversion_Blog_Views_1',
          'ads_conversion_Form_1',
          'ads_conversion_Request_quote_1',
          'generate_lead'
        ].includes(e.en)
      );
      assert.equal(
        poisoned.length,
        0,
        `${routePath} must emit zero conversion events on page load, got ${JSON.stringify(poisoned)}`
      );

      const pageViews = harness.gaEvents.filter((e) => e.en === 'page_view');
      assert.ok(pageViews.length >= 1, `${routePath} still delivers clean GA4 page_view telemetry`);

      const metaLeadsOnLoad = harness.metaBeacons.filter((m) => m.ev === 'Lead');
      assert.equal(
        metaLeadsOnLoad.length,
        0,
        `${routePath} must never fire Meta Pixel Lead on page load, got ${JSON.stringify(metaLeadsOnLoad)}`
      );

      const legacyMetaPixels = harness.metaBeacons.filter((m) => m.id === '1632323408448392');
      assert.equal(legacyMetaPixels.length, 0, `${routePath} must never reference retired Meta dataset 1632323408448392`);

      await context.close();
    }
  } finally {
    await browser.close();
  }
});

test('Step-1 micro-commitment card is above the fold on 390x844 mobile, fires form_start once per session, and passes FL ZIP context into Step 2', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  try {
    // 1. Check above-the-fold Step-1 positioning across /get-help/, Medicare, Watson Clinic, and Polk city landers
    const aboveFoldRoutes = [
      { path: '/get-help/', zipSelector: '#zipCode', continueSelector: '#step1ContinueButton' },
      { path: '/medicare/', zipSelector: '[data-lhi-step1-intake] [data-step1-zip]', continueSelector: '[data-lhi-step1-intake] [data-step1-continue]' },
      { path: '/blog/watson-clinic-humana-2027.html', zipSelector: '[data-lhi-step1-intake] [data-step1-zip]', continueSelector: '[data-lhi-step1-intake] [data-step1-continue]' },
      { path: '/blog/orlando-health-watson-clinic-2027-plan.html', zipSelector: '[data-lhi-step1-intake] [data-step1-zip]', continueSelector: '[data-lhi-step1-intake] [data-step1-continue]' },
      { path: '/winter-haven-health-insurance/', zipSelector: '[data-lhi-step1-intake] [data-step1-zip]', continueSelector: '[data-lhi-step1-intake] [data-step1-continue]' }
    ];

    for (const item of aboveFoldRoutes) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await attachProductionHarness(page);
      await page.goto(`https://lakelandhealthinsurance.com${item.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      const zipBox = await page.locator(item.zipSelector).first().boundingBox();
      const btnBox = await page.locator(item.continueSelector).first().boundingBox();
      assert.ok(zipBox, `${item.path}: Step-1 ZIP input renders`);
      assert.ok(btnBox, `${item.path}: Step-1 Continue button renders`);
      assert.ok(
        zipBox.y >= 0 && zipBox.y + zipBox.height <= 844,
        `${item.path}: Step-1 ZIP input must sit above 844px mobile fold (got bottom=${Math.round(zipBox.y + zipBox.height)})`
      );
      assert.ok(
        btnBox.y >= 0 && btnBox.y + btnBox.height <= 844,
        `${item.path}: Step-1 Continue button must sit above 844px mobile fold (got bottom=${Math.round(btnBox.y + btnBox.height)})`
      );
      await context.close();
    }

    // 2. Verify /get-help/ Step 1 -> Step 2 flow, FL state derivation, and once-per-session form_start dedupe
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const harness = await attachProductionHarness(page);
      await page.goto('https://lakelandhealthinsurance.com/get-help/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      await page.fill('#zipCode', '33805');
      await page.check('#intentOptions input[data-intent="medicare"]');
      await page.click('#step1ContinueButton');
      await page.waitForTimeout(250);

      const step2Active = await page.locator('.form-step[data-step="2"]:not([hidden])').count();
      assert.equal(step2Active, 1, '/get-help/ advances to Step 2 after 5-digit FL ZIP + coverage type');

      const derivedState = await page.evaluate(() => ({
        coverage_state: document.getElementById('coverageStateInput')?.value || '',
        state: document.getElementById('stateInput')?.value || '',
        summary: document.getElementById('step2SummaryText')?.textContent || ''
      }));
      assert.equal(derivedState.coverage_state, 'FL');
      assert.equal(derivedState.state, 'FL');
      assert.match(derivedState.summary, /33805/);

      // Interact repeatedly with Step 2 inputs and ensure form_start still fired ONLY ONCE
      await page.fill('#fullName', 'Jane Polk');
      await page.fill('#phone', '8635550199');
      await page.waitForTimeout(300);

      const formStarts = harness.gaEvents.filter((e) => e.en === 'form_start');
      assert.equal(formStarts.length, 1, `form_start must fire exactly once per session, got ${JSON.stringify(formStarts)}`);
      assert.equal(formStarts[0].form_id, 'leadForm');
      assert.match(formStarts[0].dl, /^https:\/\/lakelandhealthinsurance\.com\/get-help\//);

      await context.close();
    }

    // 3. Verify Polk city lander Step 1 cross-lane routing into /get-help/ Step 2 with pre-filled ZIP + FL state + no duplicate form_start
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const harness = await attachProductionHarness(page);
      await page.goto('https://lakelandhealthinsurance.com/winter-haven-health-insurance/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      await page.fill('#winterHavenStep1Zip', '33880');
      await page.selectOption('#winterHavenStep1Intent', 'medicare');
      await Promise.all([
        page.waitForURL((u) => u.pathname === '/get-help/'),
        page.click('[data-lhi-step1-intake] [data-step1-continue]')
      ]);
      await page.waitForTimeout(350);

      const routedState = await page.evaluate(() => ({
        url: window.location.href,
        step2Active: Boolean(document.querySelector('.form-step[data-step="2"]:not([hidden])')),
        zip: document.getElementById('zipCode')?.value || '',
        inquiry: document.querySelector('#intentOptions input[name="inquiry_type"]:checked')?.value || '',
        state: document.getElementById('stateInput')?.value || ''
      }));
      assert.equal(routedState.step2Active, true, 'Routing from lander Step 1 opens /get-help/ directly at Step 2');
      assert.equal(routedState.zip, '33880');
      assert.equal(routedState.inquiry, 'Medicare');
      assert.equal(routedState.state, 'FL');

      // Focusing Step 2 on /get-help/ in the same session must NOT emit a second form_start
      await page.fill('#fullName', 'Winter Haven Resident');
      await page.waitForTimeout(250);
      const sessionFormStarts = harness.gaEvents.filter((e) => e.en === 'form_start');
      assert.equal(sessionFormStarts.length, 1, 'form_start remains once per session across lander -> /get-help/ handoff');

      const ctaClicks = harness.gaEvents.filter((e) => e.en === 'medicare_cta_click');
      assert.ok(ctaClicks.length >= 1, 'Step-1 handoff to /get-help/ records medicare_cta_click');

      await context.close();
    }
  } finally {
    await browser.close();
  }
});

test('medicare_cta_click fires on /get-help/ plan-review CTAs across Medicare, Watson Clinic, and Polk County city landers', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  try {
    const ctaCases = [
      { path: '/medicare/', selector: 'a[href*="/get-help/"][data-medicare-cta="start_review_hero"]' },
      { path: '/blog/watson-clinic-humana-2027.html', selector: 'a[href*="/get-help/"][data-medicare-cta="request_review_hero"]' },
      { path: '/winter-haven-health-insurance/', selector: 'main a[href*="/get-help/"], header .cta-group a[href*="/get-help/"]' }
    ];

    for (const item of ctaCases) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const harness = await attachProductionHarness(page);
      await page.goto(`https://lakelandhealthinsurance.com${item.path}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
      await page.waitForTimeout(350);

      // Prevent navigation unload race so we cleanly capture the beacon
      await page.evaluate((sel) => {
        const link = document.querySelector(sel);
        if (link) {
          link.addEventListener('click', (ev) => ev.preventDefault(), { once: true });
        }
      }, item.selector);

      await page.locator(item.selector).first().click();
      await page.waitForTimeout(250);

      const ctaEvents = harness.gaEvents.filter((e) => e.en === 'medicare_cta_click');
      assert.ok(
        ctaEvents.length >= 1,
        `${item.path} (${item.selector}) must fire medicare_cta_click, got ${JSON.stringify(harness.gaEvents)}`
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }
});

test('generate_lead, ads_conversion_Request_quote_1, and Meta Lead (1480756087079484) fire strictly on verified 200 OK /api/lead submission', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const verifiedEventId = '11111111-2222-4333-a444-555555555555';

    // Start with a 500 error from /api/lead to prove failed submissions emit ZERO conversions
    const harness = await attachProductionHarness(page, {
      holdThanksNavigation: true,
      leadApiResponder: () => ({
        status: 500,
        body: { ok: false, forms: false, error: 'upstream_failure' }
      })
    });

    await page.goto('https://lakelandhealthinsurance.com/blog/watson-clinic-humana-2027.html', {
      waitUntil: 'networkidle'
    });
    await page.waitForTimeout(350);

    // Complete Step 1 -> Step 2 inline on Watson Clinic lander (which also initializes Meta Pixel 1480756087079484)
    await page.fill('#watsonHumanaStep1Zip', '33805');
    await page.click('[data-lhi-step1-intake] [data-step1-continue]');
    await page.fill('#blog_watson_clinic_humana_2027_full_name', 'David Test Lead');
    await page.fill('#blog_watson_clinic_humana_2027_phone', '8635550144');
    await page.check('#blog_watson_clinic_humana_2027_consent');

    await page.click('#blog_watson_clinic_humana_2027Form button[type="submit"]');
    await page.waitForTimeout(450);

    assert.equal(harness.leadApiRequests.length, 1, 'First submission hit /api/lead');
    assert.equal(harness.leadApiRequests[0].zip_code, '33805');
    assert.equal(harness.leadApiRequests[0].state, 'FL');
    assert.equal(harness.leadApiRequests[0].coverage_state, 'FL');

    assert.equal(
      harness.gaEvents.filter((e) => e.en === 'generate_lead' || e.en === 'ads_conversion_Request_quote_1').length,
      0,
      'Non-200 /api/lead response must NOT fire generate_lead or ads_conversion_Request_quote_1'
    );
    assert.equal(
      harness.metaBeacons.filter((m) => m.ev === 'Lead').length,
      0,
      'Non-200 /api/lead response must NOT fire Meta Pixel Lead'
    );

    // Now switch /api/lead to return a verified 200 OK receipt and submit cleanly
    harness.setLeadApiResponder(() => ({
      status: 200,
      body: {
        ok: true,
        forms: true,
        event_id: verifiedEventId
      }
    }));

    await page.goto('https://lakelandhealthinsurance.com/blog/watson-clinic-humana-2027.html', {
      waitUntil: 'networkidle'
    });
    await page.waitForTimeout(350);
    await page.fill('#watsonHumanaStep1Zip', '33805');
    await page.click('[data-lhi-step1-intake] [data-step1-continue]');
    await page.fill('#blog_watson_clinic_humana_2027_full_name', 'David Test Lead');
    await page.fill('#blog_watson_clinic_humana_2027_phone', '8635550144');
    await page.check('#blog_watson_clinic_humana_2027_consent');

    await page.click('#blog_watson_clinic_humana_2027Form button[type="submit"]');
    await page.waitForTimeout(500);

    const generateLeads = harness.gaEvents.filter((e) => e.en === 'generate_lead');
    const requestQuotes = harness.gaEvents.filter((e) => e.en === 'ads_conversion_Request_quote_1');
    const metaLeads = harness.metaBeacons.filter((m) => m.ev === 'Lead');

    assert.equal(generateLeads.length, 1, `generate_lead fires once on 200 OK, got ${JSON.stringify(generateLeads)}`);
    assert.equal(generateLeads[0].event_id, verifiedEventId);

    assert.equal(
      requestQuotes.length,
      1,
      `ads_conversion_Request_quote_1 fires once on 200 OK, got ${JSON.stringify(requestQuotes)}`
    );
    assert.equal(requestQuotes[0].event_id, verifiedEventId);

    assert.equal(metaLeads.length, 1, `Meta Pixel Lead fires once on 200 OK, got ${JSON.stringify(metaLeads)}`);
    assert.equal(metaLeads[0].id, '1480756087079484', 'Meta Lead uses active dataset 1480756087079484');
    assert.equal(metaLeads[0].eid, verifiedEventId, 'Meta Lead carries matching verified eventID');

    await context.close();
  } finally {
    await browser.close();
  }
});
