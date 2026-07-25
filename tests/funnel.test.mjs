/*
 * funnel.js test harness.
 *
 * Loads js/funnel.js inside a Node vm sandbox with stubbed window/document,
 * flips __LHI_TEST=true so the IIFE attaches its private helpers to
 * window.LHI._t, then asserts behavior of the pure helpers.
 *
 * Run: node --test tests/funnel.test.mjs
 *
 * Why vm + the test surface (not extracted helper modules): funnel.js is
 * shipped as a single static IIFE loaded by <script src>; there is no
 * build step, no module graph, and no bundler. Refactoring the helpers
 * out would change the production loading surface for no behavior gain.
 * The __LHI_TEST gate is ~12 lines and only activates in this harness.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FUNNEL_SRC = readFileSync(resolve(__dirname, '../js/funnel.js'), 'utf8');
const ANALYTICS_SRC = readFileSync(resolve(__dirname, '../js/analytics.js'), 'utf8');
const THANKS_SRC = readFileSync(resolve(__dirname, '../thanks.html'), 'utf8');

function makeSessionStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
    _dump: () => Object.fromEntries(store)
  };
}

/* Build a sandbox that mimics the browser globals funnel.js touches.
   __LHI_IS_PROD=false silences gtag/Supabase fire paths so loading
   the script has no side-effects beyond attaching window.LHI. */
function loadFunnel({ pathname = '/', forms = [], fetchImpl } = {}) {
  const dataLayer = [];
  const sessionStorage = makeSessionStorage();
  const otherElements = [];
  class TestFormData {
    constructor(form) {
      this.entries = Object.entries(form._fields || {});
    }
    get(name) {
      const found = this.entries.find(([key]) => key === name);
      return found ? found[1] : null;
    }
    forEach(cb) {
      this.entries.forEach(([key, value]) => cb(value, key));
    }
  }
  const sandbox = {
    __LHI_TEST: true,
    __LHI_IS_PROD: false,
    crypto: globalThis.crypto,
    TextEncoder: globalThis.TextEncoder,
    navigator: { userAgent: 'node-test', sendBeacon: undefined },
    document: {
      cookie: '',
      referrer: '',
      querySelectorAll: () => [],
      addEventListener: () => {},
      readyState: 'complete'
    },
    location: { pathname, search: '', href: 'http://localhost' + pathname },
    URLSearchParams: globalThis.URLSearchParams,
    Promise: globalThis.Promise,
    Date: globalThis.Date,
    Math: globalThis.Math,
    JSON: globalThis.JSON,
    Object: globalThis.Object,
    String: globalThis.String,
    RegExp: globalThis.RegExp,
    Array: globalThis.Array,
    Uint8Array: globalThis.Uint8Array,
    Blob: globalThis.Blob,
    FormData: TestFormData,
    Error: globalThis.Error,
    fetch: fetchImpl || (() => Promise.resolve({ ok: true })),
    setTimeout: () => 0,
    dataLayer,
    sessionStorage
  };
  sandbox.document.querySelectorAll = (selector) => {
    if (selector === 'form[data-funnel-track], form[data-funnel-step]') return forms;
    return otherElements.filter((el) => el._matches && el._matches(selector));
  };
  /* funnel.js IIFE call: (function(w,d){...})(window||this, document).
     We pass the sandbox itself as `window`, and sandbox.document as `document`. */
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(FUNNEL_SRC, sandbox, { filename: 'funnel.js' });
  sandbox.__addElement = (el) => otherElements.push(el);
  return sandbox;
}

function makeFunnelForm({
  eventName = 'Lead',
  contentName = 'test_lead_form',
  action = '/thanks.html',
  fields = {}
} = {}) {
  const listeners = {};
  return {
    _fields: fields,
    __submitted: false,
    getAttribute(name) {
      if (name === 'data-funnel-event') return eventName;
      if (name === 'data-funnel-name') return contentName;
      if (name === 'data-funnel-step') return null;
      if (name === 'action') return action;
      return null;
    },
    hasAttribute(name) {
      return name === 'data-funnel-track';
    },
    addEventListener(type, cb) {
      listeners[type] = cb;
    },
    submit() {
      this.__submitted = true;
    },
    dispatchSubmit(event = {}) {
      listeners.submit(Object.assign({
        preventDefault() {},
        stopImmediatePropagation() {}
      }, event));
    }
  };
}

function makeAnchor({ href, text = 'CTA', analyticsLabel = null, ariaLabel = null } = {}) {
  const listeners = {};
  return {
    href,
    textContent: text,
    getAttribute(name) {
      if (name === 'href') return href;
      if (name === 'data-funnel-cta') return null;
      if (name === 'data-analytics-label') return analyticsLabel;
      if (name === 'aria-label') return ariaLabel;
      return null;
    },
    addEventListener(type, cb) {
      listeners[type] = cb;
    },
    click() {
      if (listeners.click) listeners.click();
    },
    _matches(selector) {
      return selector.split(',').some((raw) => {
        const s = raw.trim();
        if (s === '[data-funnel-booking]') return false;
        if (s === 'a[href^="tel:"]') return href.startsWith('tel:');
        if (s === 'a[href*="calendly.com"]') return href.includes('calendly.com');
        if (s === 'a[href*="m.me/"]') return href.includes('m.me/');
        if (s === 'a[href*="messenger.com"]') return href.includes('messenger.com');
        if (s === 'a[href*="healthsherpa.com"]') return href.includes('healthsherpa.com');
        if (s === 'a[href*="healthcare.gov"]') return href.includes('healthcare.gov');
        if (s === 'a[href*="/find-plans"]') return href.includes('/find-plans');
        if (s === 'a[href*="/search-engine-from-zip"]') return href.includes('/search-engine-from-zip');
        return false;
      });
    }
  };
}

function loadAnalytics({ pathname = '/', telLabel = 'Call David' } = {}) {
  const listeners = {};
  const dataLayer = [];
  const telLink = {
    getAttribute(name) {
      if (name === 'data-analytics-label') return null;
      if (name === 'aria-label') return telLabel;
      return null;
    },
    textContent: telLabel
  };
  const sandbox = {
    console: { info: () => {} },
    localStorage: makeSessionStorage(),
    dataLayer,
    location: {
      hostname: 'localhost',
      pathname,
      search: '',
      href: 'http://localhost' + pathname
    },
    document: {
      addEventListener(type, cb) { listeners[type] = cb; },
      createElement: () => ({ async: false, src: '' }),
      head: { appendChild: () => {} },
      readyState: 'loading'
    },
    window: null,
    Date,
    Object,
    setTimeout: () => 0,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(ANALYTICS_SRC, sandbox, { filename: 'analytics.js' });
  return {
    sandbox,
    dataLayer,
    clickTel() {
      listeners.click({
        target: {
          closest(selector) {
            return selector === 'a[href^="tel:"]' ? telLink : null;
          }
        }
      });
    }
  };
}

function runThanksHeadScript(sessionStorage) {
  const match = THANKS_SRC.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'thanks.html head script found');
  const dataLayer = [];
  const sandbox = {
    dataLayer,
    sessionStorage,
    window: null,
    Date,
    JSON,
    Object
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(match[1], sandbox, { filename: 'thanks-head-script.js' });
  return { sandbox, dataLayer };
}

test('exposes test surface only when __LHI_TEST=true', () => {
  const w = loadFunnel();
  assert.ok(w.LHI, 'LHI public API attached');
  assert.ok(w.LHI._t, '_t test surface attached when gate is set');
  assert.equal(typeof w.LHI._t.normPhone, 'function');
  assert.equal(typeof w.LHI._t.sha256, 'function');
  assert.equal(typeof w.LHI._t.pageType, 'function');
});

test('test surface is gated — absent when __LHI_TEST is unset', () => {
  /* Re-load without the flag and confirm _t never attaches. Guards against
     someone removing the gate and silently leaking helpers to prod. */
  const dataLayer = [];
  const sandbox = {
    __LHI_IS_PROD: false,
    crypto: globalThis.crypto,
    TextEncoder: globalThis.TextEncoder,
    navigator: { userAgent: 'node-test' },
    document: { cookie: '', referrer: '', querySelectorAll: () => [], addEventListener: () => {}, readyState: 'complete' },
    location: { pathname: '/', search: '', href: 'http://localhost/' },
    URLSearchParams: globalThis.URLSearchParams,
    Promise, Date, Math, JSON, Object, String, RegExp, Array, Uint8Array, Blob,
    fetch: () => Promise.resolve({ ok: true }),
    setTimeout: () => 0,
    dataLayer
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(FUNNEL_SRC, sandbox, { filename: 'funnel.js' });
  assert.equal(sandbox.LHI._t, undefined, '_t must not leak when __LHI_TEST is unset');
});

test('normPhone — strips formatting, prepends US country code for 10-digit', () => {
  const { normPhone } = loadFunnel().LHI._t;
  assert.equal(normPhone('(863) 640-3102'), '18636403102');
  assert.equal(normPhone('863-640-3102'), '18636403102');
  assert.equal(normPhone('863.640.3102'), '18636403102');
  assert.equal(normPhone('+1 863 640 3102'), '18636403102');
  assert.equal(normPhone('1-863-640-3102'), '18636403102');
  assert.equal(normPhone('18636403102'), '18636403102');
});

test('normPhone — null/empty/garbage returns null', () => {
  const { normPhone } = loadFunnel().LHI._t;
  assert.equal(normPhone(null), null);
  assert.equal(normPhone(undefined), null);
  assert.equal(normPhone(''), null);
  assert.equal(normPhone('abc'), null);
  assert.equal(normPhone('   '), null);
});

test('normPhone — short or international-length strings pass through digits-only', () => {
  /* Documents current behavior: only 10-digit gets the leading 1. Other
     lengths pass through as-is. If we ever tighten this (e.g. reject
     non-US), update both this test and the caller in fireGoogleAdsLead. */
  const { normPhone } = loadFunnel().LHI._t;
  assert.equal(normPhone('5551234'), '5551234');
  assert.equal(normPhone('+44 20 7946 0958'), '442079460958');
});

test('sha256 — known vector lower-case hex', async () => {
  const { sha256 } = loadFunnel().LHI._t;
  /* sha256('hello') = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824 */
  const out = await sha256('hello');
  assert.equal(out, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
});

test('sha256 — trims and lowercases input (Google Enhanced Conversions contract)', async () => {
  /* Google's Enhanced Conversions specs trim+lowercase before hashing.
     Mismatches fail silently and reduce match rate. Lock this in. */
  const { sha256 } = loadFunnel().LHI._t;
  const a = await sha256('  HELLO@Example.COM  ');
  const b = await sha256('hello@example.com');
  assert.equal(a, b);
});

test('sha256 — null/empty resolves to null (does not hash falsy)', async () => {
  const { sha256 } = loadFunnel().LHI._t;
  assert.equal(await sha256(null), null);
  assert.equal(await sha256(undefined), null);
  assert.equal(await sha256(''), null);
});

test('pageType — known landing-page paths', () => {
  for (const [path, expected] of [
    ['/lp/aca/', 'lp_aca'],
    ['/lp/medicare/', 'lp_medicare'],
    ['/lp/gap/', 'coverage_change'],
    ['/carriers/aetna/', 'carrier_lp'],
    ['/blog/aca-vs-medicare/', 'blog'],
    ['/aca-subsidy-estimator/', 'estimator'],
    ['/get-help/', 'get_help'],
    ['/health-protector-guard/', 'guard_lp'],
    ['/aca-health-insurance-lakeland-fl/', 'local_seo_aca'],
    ['/medicare-broker-lakeland/', 'local_seo_medicare'],
    ['/medicare-broker-lakeland/index.html', 'local_seo_medicare'],
    ['/medicare/east-polk/', 'local_seo_medicare'],
    ['/medicare/', 'lp_medicare'],
    ['/life-insurance-dime/', 'dime_method'],
    ['/lost-job-health-insurance/', 'coverage_change'],
    ['/blog/lost-job-health-insurance-lakeland.html', 'coverage_change'],
    ['/blog/orlando-health-watson-clinic-insurance-2026.html', 'provider_network'],
    ['/blog/turning-65-medicare-checklist-florida.html', 'turning_65'],
    ['/blog/college-student-health-insurance-lakeland.html', 'aging_off_26'],
    ['/coverage-change-checkup/', 'coverage_change'],
    ['/turning-65-medicare-countdown/', 'turning_65'],
    ['/provider-prescription-check/', 'provider_network'],
    ['/aging-off-26/', 'aging_off_26'],
    ['/self-employed-income-checkup/', 'self_employed'],
    ['/employer-offboarding/', 'employer_offboarding'],
    ['/client-review/', 'client_review'],
    ['/post-enrollment-checkup/', 'post_enrollment'],
    ['/download-free-guide/', 'guide_optin'],
    ['/newsletter/', 'newsletter'],
    ['/calendly-book.html', 'booking'],
    ['/calendly-book/', 'booking'],
    ['/thanks', 'conversion'],
    ['/thanks.html', 'conversion'],
    ['/thanks/', 'conversion'],
    ['/', 'home'],
    ['/index.html', 'home'],
    ['/about/', 'site'],
    ['/contact/', 'site']
  ]) {
    const w = loadFunnel({ pathname: path });
    assert.equal(w.LHI._t.pageType(), expected, `pageType(${path}) → ${expected}`);
  }
});

test('pageType — case-insensitive', () => {
  const w = loadFunnel({ pathname: '/LP/Medicare/' });
  assert.equal(w.LHI._t.pageType(), 'lp_medicare');
});

test('leadValueFor — known type returns its mapped value', () => {
  const { leadValueFor, LEAD_VALUE_BY_PAGE_TYPE } = loadFunnel().LHI._t;
  /* All defaults are 0 today. When values are tuned, these assertions
     still pass because they read from the same map. The point of this
     test is to lock the lookup CONTRACT, not the dollar amounts. */
  for (const key of Object.keys(LEAD_VALUE_BY_PAGE_TYPE)) {
    assert.equal(leadValueFor(key), LEAD_VALUE_BY_PAGE_TYPE[key], `leadValueFor(${key})`);
  }
});

test('leadValueFor — unknown type falls back to default', () => {
  const { leadValueFor, LEAD_VALUE_BY_PAGE_TYPE } = loadFunnel().LHI._t;
  assert.equal(leadValueFor('does_not_exist'), LEAD_VALUE_BY_PAGE_TYPE['default']);
  assert.equal(leadValueFor(undefined), LEAD_VALUE_BY_PAGE_TYPE['default']);
  assert.equal(leadValueFor(''), LEAD_VALUE_BY_PAGE_TYPE['default']);
});

test('LEAD_CONVERSION_SEND_TO — has the expected Google Ads format', () => {
  const { LEAD_CONVERSION_SEND_TO } = loadFunnel().LHI._t;
  /* AW-<account>/<label>. Catches accidental edits that break gtag dispatch. */
  assert.match(LEAD_CONVERSION_SEND_TO, /^AW-\d+\/[A-Za-z0-9_-]+$/);
});

test('phone clicks fire canonical phone_call_click', () => {
  const { dataLayer, clickTel } = loadAnalytics({ telLabel: 'Call 863-640-3102' });

  clickTel();

  assert.ok(dataLayer.some((entry) => entry.event === 'phone_call_click'), 'canonical phone_call_click event fired');
});

test('legacy phone_call remains supported through shared helper', () => {
  const { sandbox, dataLayer } = loadAnalytics();

  sandbox.trackPhoneCall('legacy_call_button');

  assert.ok(dataLayer.some((entry) => entry.event === 'phone_call_click'), 'canonical event still fires');
  assert.ok(dataLayer.some((entry) => entry.event === 'phone_call'), 'legacy phone_call event still fires');
});

test('Lead tracking sets pending thank-you lead marker', () => {
  const w = loadFunnel({ pathname: '/lp/aca/' });

  w.LHI.track('Lead', { content_name: 'lp_aca_lead_form' });

  const raw = w.sessionStorage.getItem('lhi_lead_submitted');
  assert.ok(raw, 'pending lead marker stored');
  const marker = JSON.parse(raw);
  assert.match(marker.event_id, /^lhi_\d+_[a-z0-9]+$/);
  assert.equal(marker.content_name, 'lp_aca_lead_form');
  assert.equal(marker.page_type, 'lp_aca');
  assert.equal(marker.page_path, '/lp/aca/');
  assert.equal(typeof marker.fired_at, 'number');
});

test('Lead form submit posts to /api/lead and stops legacy submit handlers', async () => {
  const calls = [];
  const form = makeFunnelForm({
    contentName: 'city_lead_form',
    fields: {
      'form-name': 'tampa-health-insurance',
      full_name: 'Jane Doe',
      phone_number: '863-640-3102',
      email: 'jane@example.com',
      zip_code: '33801'
    }
  });
  const w = loadFunnel({
    pathname: '/tampa-health-insurance/',
    forms: [form],
    fetchImpl: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve({ ok: true });
    }
  });
  let prevented = false;
  let stopped = false;

  form.dispatchSubmit({
    preventDefault() { prevented = true; },
    stopImmediatePropagation() { stopped = true; }
  });
  await Promise.resolve();

  assert.equal(prevented, true);
  assert.equal(stopped, true);
  const apiCalls = calls.filter((call) => call.url === '/api/lead');
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].init.method, 'POST');
  assert.equal(apiCalls[0].init.headers['Content-Type'], 'application/json');

  const payload = JSON.parse(apiCalls[0].init.body);
  assert.equal(payload.content_name, 'city_lead_form');
  assert.equal(payload['form-name'], 'tampa-health-insurance');
  assert.equal(payload.phone_number, '863-640-3102');
  assert.equal(payload.zip_code, '33801');

  assert.ok(w.dataLayer.some((entry) => entry.event === 'Lead'), 'Lead event pushed to dataLayer');
  assert.ok(w.sessionStorage.getItem('lhi_lead_submitted'), 'thank-you marker set');
});

test('Lead form API failure falls back to native Netlify submit', async () => {
  const form = makeFunnelForm({
    fields: {
      'form-name': 'lp-aca-lead',
      email: 'jane@example.com'
    }
  });
  loadFunnel({
    pathname: '/lp/aca/',
    forms: [form],
    fetchImpl: () => Promise.resolve({ ok: false, status: 500 })
  });

  form.dispatchSubmit();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(form.__submitted, true);
});

test('Subscriber form fires Subscriber without Lead marker or API submit', async () => {
  const calls = [];
  const form = makeFunnelForm({
    eventName: 'Subscriber',
    contentName: 'newsletter_optin',
    fields: {
      'form-name': 'newsletter-signup',
      email: 'reader@example.com',
      interest: 'medicare'
    }
  });
  const w = loadFunnel({
    pathname: '/newsletter/',
    forms: [form],
    fetchImpl: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve({ ok: true });
    }
  });

  form.dispatchSubmit();
  await Promise.resolve();

  assert.ok(w.dataLayer.some((entry) => entry.event === 'Subscriber'), 'Subscriber event pushed to dataLayer');
  assert.equal(w.dataLayer.some((entry) => entry.event === 'Lead'), false, 'Lead event not fired');
  assert.equal(w.sessionStorage.getItem('lhi_lead_submitted'), null, 'thank-you Lead marker not set');
  assert.equal(calls.filter((call) => call.url === '/api/lead').length, 0, 'Subscriber does not post to lead API');
});

test('outbound CTA tracking fires canonical events with source context', () => {
  const w = loadFunnel({ pathname: '/aca-health-insurance-lakeland-fl/' });
  const phone = makeAnchor({ href: 'tel:+18636403102', text: 'Call David' });
  const messenger = makeAnchor({ href: 'https://m.me/2330958066941437', text: 'Message David' });
  const quote = makeAnchor({ href: 'https://www.healthsherpa.com/?_agent_id=dhuff', text: 'Start quote' });
  const calendar = makeAnchor({ href: 'https://calendly.com/dhuff-healthmarkets', text: 'Schedule a time' });
  [phone, messenger, quote, calendar].forEach((el) => w.__addElement(el));

  w.LHI._t.wireForms();

  phone.click();
  messenger.click();
  quote.click();
  calendar.click();

  for (const eventName of ['PhoneClick', 'MessengerClick', 'SelfServiceQuoteClick', 'Schedule']) {
    const entry = w.dataLayer.find((item) => item.event === eventName);
    assert.ok(entry, `${eventName} fired`);
    assert.equal(entry.page_type, 'local_seo_aca');
    assert.equal(entry.source_page, '/aca-health-insurance-lakeland-fl/');
  }
});

test('thanks.html does not fire generate_lead without pending marker', () => {
  const { dataLayer, sandbox } = runThanksHeadScript(makeSessionStorage());

  assert.equal(sandbox.__LHI_THANKS_LEAD_MARKER, null);
  assert.equal(dataLayer.some((entry) => entry[0] === 'event' && entry[1] === 'generate_lead'), false);
});

test('thanks.html fires generate_lead once when pending marker exists', () => {
  const marker = {
    event_id: 'lhi_test_123',
    content_name: 'lp_aca_lead_form',
    page_type: 'lp_aca',
    page_path: '/lp/aca/',
    fired_at: Date.now()
  };
  const storage = makeSessionStorage({ lhi_lead_submitted: JSON.stringify(marker) });

  const { dataLayer, sandbox } = runThanksHeadScript(storage);

  assert.deepEqual(sandbox.__LHI_THANKS_LEAD_MARKER, marker);
  assert.equal(storage.getItem('lhi_lead_submitted'), null, 'marker consumed after use');

  const generateLeadEvents = dataLayer.filter((entry) => entry[0] === 'event' && entry[1] === 'generate_lead');
  assert.equal(generateLeadEvents.length, 1);
  assert.equal(generateLeadEvents[0][2].event_id, 'lhi_test_123');
  assert.equal(generateLeadEvents[0][2].event_label, 'lp_aca_lead_form');

  const secondRun = runThanksHeadScript(storage);
  assert.equal(secondRun.dataLayer.some((entry) => entry[0] === 'event' && entry[1] === 'generate_lead'), false);
});
