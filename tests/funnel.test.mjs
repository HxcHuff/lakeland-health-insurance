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
const GET_HELP_SRC = readFileSync(resolve(__dirname, '../js/get-help-intake.js'), 'utf8');
const GET_HELP_HTML = readFileSync(resolve(__dirname, '../get-help/index.html'), 'utf8');
const HOME_HTML = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const GET_HELP_V2_HTML = readFileSync(resolve(__dirname, '../get-help/index-v2.html'), 'utf8');
const REDIRECTS_SRC = readFileSync(resolve(__dirname, '../_redirects'), 'utf8');
const ESTIMATOR_HTML = readFileSync(resolve(__dirname, '../aca-subsidy-estimator/index.html'), 'utf8');
const SERVICE_WORKER_SRC = readFileSync(resolve(__dirname, '../sw.js'), 'utf8');
const SITE_TEMPLATE_CSS = readFileSync(resolve(__dirname, '../css/site-template.css'), 'utf8');
const FIXED_INDEMNITY_HTML = readFileSync(resolve(__dirname, '../blog/fixed-indemnity-analysis.html'), 'utf8');
const EXTERNAL_QUOTE_SELECTOR = 'a[data-funnel-external-quote], a[href*="healthsherpa.com"], a[href*="/find-plans"]';
const MEDICARE_HUB_HTML = readFileSync(resolve(__dirname, '../medicare/index.html'), 'utf8');
const BEST_MEDICARE_BROKER_HTML = readFileSync(resolve(__dirname, '../best-medicare-broker-lakeland-fl/index.html'), 'utf8');
const MEDICARE_BROKER_HTML = readFileSync(resolve(__dirname, '../medicare-broker-lakeland-fl/index.html'), 'utf8');
const WEBSITE_CALL_SELECTOR = 'a[href="tel:+18636403102"], a[data-lhi-business-phone="+18636403102"]';
const CITY_LEAD_PAGES = [
  'brandon-health-insurance',
  'clearwater-health-insurance',
  'davenport-health-insurance',
  'haines-city-health-insurance',
  'lake-alfred-health-insurance',
  'largo-health-insurance',
  'new-port-richey-health-insurance',
  'riverview-health-insurance',
  'st-petersburg-health-insurance',
  'tampa-health-insurance',
  'wesley-chapel-health-insurance',
  'winter-haven-health-insurance'
].map((route) => ({
  route,
  html: readFileSync(resolve(__dirname, `../${route}/index.html`), 'utf8')
}));
const MEDICARE_EDUCATION_PAGES = [
  {
    html: readFileSync(resolve(__dirname, '../blog/aep-2026-polk-county-checklist.html'), 'utf8'),
    pageKey: 'aep_2026_polk_county_checklist',
    pageRole: 'education',
    ctaKeys: ['request_review_final']
  },
  {
    html: readFileSync(resolve(__dirname, '../blog/medicare-supplement-cost-lakeland.html'), 'utf8'),
    pageKey: 'medicare_supplement_cost_lakeland',
    pageRole: 'education',
    ctaKeys: ['request_review_final']
  },
  {
    html: readFileSync(resolve(__dirname, '../blog/medicare-vs-aca-central-florida-age-65.html'), 'utf8'),
    pageKey: 'medicare_vs_aca_central_florida_age_65',
    pageRole: 'education',
    ctaKeys: ['request_review_final', 'request_review_hero', 'request_review_nav']
  },
  {
    html: readFileSync(resolve(__dirname, '../blog/turning-65-medicare-checklist-florida.html'), 'utf8'),
    pageKey: 'turning_65_medicare_checklist_florida',
    pageRole: 'education',
    ctaKeys: ['request_review_final', 'request_review_nav']
  },
  {
    html: readFileSync(resolve(__dirname, '../blog/when-can-i-switch-medicare-plans-florida.html'), 'utf8'),
    pageKey: 'when_can_i_switch_medicare_plans_florida',
    pageRole: 'education',
    ctaKeys: ['request_review_final']
  },
  {
    html: readFileSync(resolve(__dirname, '../medicare/east-polk/index.html'), 'utf8'),
    pageKey: 'medicare_east_polk',
    pageRole: 'education',
    ctaKeys: ['request_review_final', 'request_review_hero', 'request_review_nav']
  },
  {
    html: readFileSync(resolve(__dirname, '../moving-florida-medicare/index.html'), 'utf8'),
    pageKey: 'moving_florida_medicare',
    pageRole: 'education',
    ctaKeys: ['request_move_review', 'request_related_review']
  }
];

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
   __LHI_IS_PROD=false silences production-only conversion helpers so loading
   the script has no side-effects beyond attaching window.LHI. */
function loadFunnel({
  pathname = '/',
  search = '',
  forms = [],
  selectorMap = {},
  selectorResults = {},
  fetchImpl,
  gtagImpl,
  isProd = false,
  receiptMarker = null,
  sessionInitial = {},
  phoneHelper
} = {}) {
  const dataLayer = [];
  const sessionStorage = makeSessionStorage(sessionInitial);
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
    __LHI_IS_PROD: isProd,
    crypto: globalThis.crypto,
    TextEncoder: globalThis.TextEncoder,
    navigator: { userAgent: 'node-test', sendBeacon: undefined },
    document: {
      cookie: '',
      referrer: '',
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: () => ({ async: false, src: '', onload: null, onerror: null }),
      head: { appendChild: () => {} },
      readyState: 'complete'
    },
    location: { pathname, search, href: 'http://localhost' + pathname + search, protocol: 'http:' },
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
    gtag: gtagImpl,
    setTimeout: () => 0,
    dataLayer,
    sessionStorage,
    __LHI_THANKS_LEAD_MARKER: receiptMarker
  };
  if (phoneHelper) sandbox.lhiTrackPhoneClick = phoneHelper;
  sandbox.document.querySelectorAll = (selector) => {
    if (Object.prototype.hasOwnProperty.call(selectorMap, selector)) return selectorMap[selector];
    if (Object.prototype.hasOwnProperty.call(selectorResults, selector)) return selectorResults[selector];
    if (selector === 'form[data-funnel-track], form[data-funnel-step]') return forms;
    return [];
  };
  /* funnel.js IIFE call: (function(w,d){...})(window||this, document).
     We pass the sandbox itself as `window`, and sandbox.document as `document`. */
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(FUNNEL_SRC, sandbox, { filename: 'funnel.js' });
  return sandbox;
}

function makeFunnelForm({
  eventName = 'Lead',
  contentName = 'test_lead_form',
  action = '/thanks.html',
  apiOptOut = false,
  fields = {}
} = {}) {
  const listeners = {};
  const elements = Object.fromEntries(Object.keys(fields).map((key) => [key, { value: fields[key] }]));
  return {
    _fields: fields,
    elements,
    __submitted: false,
    getAttribute(name) {
      if (name === 'data-funnel-event') return eventName;
      if (name === 'data-funnel-name') return contentName;
      if (name === 'data-funnel-step') return null;
      if (name === 'action') return action;
      return null;
    },
    hasAttribute(name) {
      return name === 'data-funnel-track' || (name === 'data-funnel-api-opt-out' && apiOptOut);
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
    },
    dispatchFormStart() {
      if (listeners.focusin) listeners.focusin({});
    }
  };
}

function makeFunnelLink({ analyticsLabel = null } = {}) {
  const listeners = {};
  return {
    getAttribute(name) {
      if (name === 'data-analytics-label') return analyticsLabel;
      return null;
    },
    addEventListener(type, cb) {
      listeners[type] = cb;
    },
    dispatchClick() {
      listeners.click({});
    },
    listenerCount(type) {
      return listeners[type] ? 1 : 0;
    }
  };
}

async function flushPromises(count = 3) {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
}

function makeAnalyticsDomElement(tagName, text = '', attributes = {}) {
  const attrs = new Map(Object.entries(attributes));
  const element = {
    nodeType: 1,
    tagName: String(tagName || '').toUpperCase(),
    childNodes: [],
    className: '',
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    appendChild(child) {
      this.childNodes.push(child);
      return child;
    },
    querySelector(selector) {
      if (selector !== '[data-lhi-forwarding-number]') return null;
      const pending = [...this.childNodes];
      while (pending.length) {
        const node = pending.shift();
        if (node && node.nodeType === 1 && node.getAttribute('data-lhi-forwarding-number') !== null) return node;
        if (node && node.childNodes) pending.push(...node.childNodes);
      }
      return null;
    }
  };
  Object.defineProperty(element, 'textContent', {
    get() {
      function nodeText(node) {
        if (!node) return '';
        if (node.nodeType === 3) return String(node.nodeValue || '');
        return (node.childNodes || []).map(nodeText).join('');
      }
      return this.childNodes.map(nodeText).join('');
    },
    set(value) {
      this.childNodes = [{ nodeType: 3, nodeValue: String(value) }];
    }
  });
  if (text) element.textContent = text;
  return element;
}

function makeWebsiteCallLink({ text, ariaLabel = null, analyticsLabel = null, nested = false }) {
  const attributes = { href: 'tel:+18636403102' };
  if (ariaLabel) attributes['aria-label'] = ariaLabel;
  if (analyticsLabel) attributes['data-analytics-label'] = analyticsLabel;
  const link = makeAnalyticsDomElement('a', '', attributes);
  if (nested) {
    link.__testIcon = makeAnalyticsDomElement('span', '☎', { 'aria-hidden': 'true' });
    link.appendChild(link.__testIcon);
    link.appendChild(makeAnalyticsDomElement('span', text));
  } else {
    link.textContent = text;
  }
  link.closest = function (selector) {
    if (selector === 'a') return this;
    if (selector === 'a[href^="tel:"]') return String(this.getAttribute('href') || '').startsWith('tel:') ? this : null;
    return null;
  };
  return link;
}

function loadAnalytics({
  pathname = '/',
  search = '',
  hostname = 'localhost',
  telLabel = 'Call David',
  analyticsLabel = null,
  link = null,
  phoneLinks = [],
  trackedForm = false,
  funnelScriptPresent = false,
  readyState = 'loading'
} = {}) {
  const listeners = {};
  const dataLayer = [];
  const telLink = {
    getAttribute(name) {
      if (name === 'data-analytics-label') return analyticsLabel;
      if (name === 'aria-label') return telLabel;
      return null;
    },
    textContent: telLabel
  };
  const origin = hostname === 'localhost' ? 'http://localhost' : `https://${hostname}`;
  const sessionStorage = makeSessionStorage();
  const appendedScripts = [];
  const scheduledTimeouts = [];
  const sandbox = {
    __LHI_TEST: true,
    console: { info: () => {} },
    localStorage: makeSessionStorage(),
    sessionStorage,
    dataLayer,
    location: {
      hostname,
      pathname,
      search,
      href: origin + pathname + search,
      origin,
      protocol: origin.startsWith('https:') ? 'https:' : 'http:'
    },
    crypto: globalThis.crypto,
    URL: globalThis.URL,
    URLSearchParams: globalThis.URLSearchParams,
    document: {
      addEventListener(type, cb) {
        listeners[type] = listeners[type] || [];
        listeners[type].push(cb);
      },
      querySelectorAll(selector) {
        return selector === WEBSITE_CALL_SELECTOR ? phoneLinks : [];
      },
      querySelector(selector) {
        if (selector === 'form[data-funnel-track], form[data-funnel-step]') return trackedForm ? {} : null;
        if (selector === 'script[src^="/js/funnel.js"]') return funnelScriptPresent ? {} : null;
        return null;
      },
      createElement(tagName) {
        return tagName === 'span' ? makeAnalyticsDomElement('span') : { async: false, src: '' };
      },
      head: { appendChild: (node) => { appendedScripts.push(node); } },
      readyState
    },
    window: null,
    Date,
    Object,
    String,
    Math,
    setTimeout(callback, delay) {
      scheduledTimeouts.push({ callback, delay });
      return scheduledTimeouts.length;
    },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(ANALYTICS_SRC, sandbox, { filename: 'analytics.js' });
  return {
    sandbox,
    dataLayer,
    sessionStorage,
    appendedScripts,
    runTimeouts() {
      while (scheduledTimeouts.length) scheduledTimeouts.shift().callback();
    },
    dispatch(type, target = link) {
      (listeners[type] || []).forEach((listener) => listener({ target }));
    },
    clickTel() {
      (listeners.click || []).forEach((listener) => listener({
        target: {
          closest(selector) {
            return selector === 'a[href^="tel:"]' ? telLink : null;
          }
        }
      }));
    }
  };
}

function makeAnalyticsLink({ href, medicareCta, ancestors = [] }) {
  const attrs = new Map([
    ['href', href],
    ['data-medicare-cta', medicareCta]
  ].filter(([, value]) => value != null));
  return {
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    closest(selector) {
      if (selector === 'a') return this;
      if (selector === 'a[href^="tel:"]') return String(attrs.get('href') || '').startsWith('tel:') ? this : null;
      return ancestors.includes(selector) ? {} : null;
    },
    textContent: 'Untrusted Jane Doe jane@example.com 863-640-3102'
  };
}

function getHelpCtas(html) {
  return [...html.matchAll(/<a\b[^>]*href="([^"]*\/get-help\/[^"]*)"[^>]*>/gi)].map((match) => {
    const tag = match[0];
    const ctaMatch = tag.match(/\bdata-medicare-cta="([^"]+)"/i);
    return {
      tag,
      href: match[1].replaceAll('&amp;', '&'),
      ctaKey: ctaMatch ? ctaMatch[1] : null
    };
  });
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
  assert.equal(typeof w.LHI._t.pageType, 'function');
  assert.equal(w.LHI.identify, undefined);
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

test('pageType — known landing-page paths', () => {
  for (const [path, expected] of [
    ['/lp/aca/', 'lp_aca'],
    ['/lp/medicare/', 'lp_medicare'],
    ['/lp/gap/', 'lp_gap'],
    ['/carriers/aetna/', 'carrier_lp'],
    ['/blog/aca-vs-medicare/', 'blog'],
    ['/aca-subsidy-estimator/', 'estimator'],
    ['/get-help/', 'get_help'],
    ['/health-protector-guard/', 'guard_lp'],
    ['/aca-health-insurance-lakeland-fl/', 'local_seo_aca'],
    ['/medicare-broker-lakeland/', 'local_seo_medicare'],
    ['/life-insurance-dime/', 'dime_method'],
    ['/lost-job-health-insurance/', 'lp_job_loss'],
    ['/download-free-guide/', 'guide_optin'],
    ['/calendly-book.html', 'booking'],
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

test('fixed-indemnity phone CTA preserves its distinct analytics label', () => {
  const { dataLayer, clickTel } = loadAnalytics({
    analyticsLabel: 'fixed_indemnity_inline_enrollment_call'
  });

  clickTel();

  const canonicalEvents = dataLayer.filter((entry) => entry.event === 'PhoneCallClick');
  const ga4Events = dataLayer.filter((entry) => entry.event === 'phone_call_click');
  assert.equal(canonicalEvents.length, 1);
  assert.equal(ga4Events.length, 1);
  assert.equal(ga4Events[0].event_label, 'fixed_indemnity_inline_enrollment_call');
});

test('funnel phone fallback does not double-wire analytics-owned links', () => {
  const link = makeFunnelLink();
  loadFunnel({
    phoneHelper: () => {},
    selectorResults: { 'a[href^="tel:"]': [link] }
  });

  assert.equal(link.listenerCount('click'), 0);
});

test('funnel phone fallback remains available without analytics.js', () => {
  const link = makeFunnelLink();
  const w = loadFunnel({
    pathname: '/blog/fixed-indemnity-analysis.html',
    selectorResults: { 'a[href^="tel:"]': [link] }
  });

  link.dispatchClick();

  assert.equal(w.dataLayer.filter((entry) => entry.event === 'PhoneCallClick').length, 1);
});

test('explicit self-service CTAs fire one labeled, non-sensitive external_quote_click each', () => {
  for (const analyticsLabel of [
    'fixed_indemnity_inline_self_service_apply',
    'fixed_indemnity_lower_self_service_apply'
  ]) {
    const gtagCalls = [];
    const link = makeFunnelLink({ analyticsLabel });
    const w = loadFunnel({
      pathname: '/blog/fixed-indemnity-analysis.html',
      gtagImpl: (...args) => gtagCalls.push(args),
      selectorResults: { [EXTERNAL_QUOTE_SELECTOR]: [link] }
    });

    link.dispatchClick();

    const dataLayerEvents = w.dataLayer.filter((entry) => entry.event === 'ExternalQuoteClick');
    const ga4Events = gtagCalls.filter((call) => call[0] === 'event' && call[1] === 'external_quote_click');
    assert.equal(dataLayerEvents.length, 1);
    assert.equal(ga4Events.length, 1);
    assert.equal(dataLayerEvents[0].page_type, 'blog');
    assert.equal(dataLayerEvents[0].event_params.content_name, analyticsLabel);
    assert.equal(ga4Events[0][2].content_name, analyticsLabel);
    assert.equal(ga4Events[0][2].page_type, 'blog');

    const emittedParams = JSON.stringify({ dataLayerEvents, ga4Events });
    assert.doesNotMatch(emittedParams, /https?:|brokerid|tel:|AA5045127/i);
  }
});

test('fixed-indemnity enrollment CTAs declare scoped analytics attributes', () => {
  assert.match(FIXED_INDEMNITY_HTML, /data-analytics-label="fixed_indemnity_inline_enrollment_call"/);
  assert.match(FIXED_INDEMNITY_HTML, /data-funnel-external-quote data-analytics-label="fixed_indemnity_inline_self_service_apply"/);
  assert.match(FIXED_INDEMNITY_HTML, /data-funnel-external-quote data-analytics-label="fixed_indemnity_lower_self_service_apply"/);
});

test('legacy phone_call remains supported through shared helper', () => {
  const { sandbox, dataLayer } = loadAnalytics();

  sandbox.trackPhoneCall('legacy_call_button');

  assert.ok(dataLayer.some((entry) => entry.event === 'phone_call_click'), 'canonical event still fires');
  assert.ok(dataLayer.some((entry) => entry.event === 'phone_call'), 'legacy phone_call event still fires');
});

test('website-call conversion uses the verified Ads tag while click telemetry remains separate', () => {
  assert.match(
    ANALYTICS_SRC,
    /gtag\('config', 'AW-300112445\/MVhNCILUi-IaEL20jY8B', \{\s*phone_conversion_number: '\(863\) 640-3102',\s*phone_conversion_callback: applyGoogleForwardingNumber\s*\}\);/s
  );
  assert.match(ANALYTICS_SRC, /pushDataLayerEvent\('phone_call_click', params\);/);
  assert.match(ANALYTICS_SRC, /gtag\('config', 'AW-300112445', \{ send_page_view: false \}\);/);
  assert.doesNotMatch(ANALYTICS_SRC, /enhanced_conversions|user_data|sha256_/i);
});

test('website-call retrieval starts before deferred init and a first tel interaction', () => {
  const phoneLink = makeWebsiteCallLink({ text: 'Call David' });
  const loaded = loadAnalytics({
    hostname: 'lakelandhealthinsurance.com',
    pathname: '/about/',
    phoneLinks: [phoneLink]
  });

  assert.deepEqual(
    loaded.appendedScripts.map((script) => script.src),
    ['https://www.googletagmanager.com/gtag/js?id=AW-300112445'],
    'only the website-call Google tag loads eagerly'
  );
  const callConfigIndex = loaded.dataLayer.findIndex((entry) =>
    entry && entry[0] === 'config' && entry[1] === 'AW-300112445/MVhNCILUi-IaEL20jY8B'
  );
  assert.ok(callConfigIndex >= 0, 'website-call callback is queued before window.load');
  assert.equal(loaded.dataLayer.some((entry) => entry && entry.event === 'gtm.js'), false, 'general GTM remains deferred');

  loaded.clickTel();

  const clickIndex = loaded.dataLayer.findIndex((entry) => entry && entry.event === 'phone_call_click');
  assert.ok(clickIndex > callConfigIndex, 'call retrieval was initialized before the first tel click');
  assert.equal(loaded.dataLayer.filter((entry) => entry && entry.event === 'phone_call_click').length, 1);

  const productionPageWithoutPhone = loadAnalytics({
    hostname: 'lakelandhealthinsurance.com',
    pathname: '/no-phone-test/'
  });
  productionPageWithoutPhone.dispatch('DOMContentLoaded');
  productionPageWithoutPhone.runTimeouts();
  assert.deepEqual(productionPageWithoutPhone.appendedScripts, [], 'pages without phone links keep all Google tags deferred');
});

test('deferred init safely loads the GA4 Google tag once on a production page without phone links', () => {
  const loaded = loadAnalytics({
    hostname: 'lakelandhealthinsurance.com',
    pathname: '/no-phone-test/',
    readyState: 'complete'
  });

  assert.deepEqual(loaded.appendedScripts, [], 'the no-phone guard keeps gtag.js deferred');
  loaded.sandbox.gtag = undefined;
  assert.doesNotThrow(() => loaded.runTimeouts(), 'deferred init restores the queue before configuring GA4');

  const googleTagScripts = loaded.appendedScripts
    .map((script) => script.src)
    .filter((src) => src.startsWith('https://www.googletagmanager.com/gtag/js?id='));
  assert.deepEqual(googleTagScripts, ['https://www.googletagmanager.com/gtag/js?id=G-W45RMKHXV0']);
  assert.equal(typeof loaded.sandbox.gtag, 'function');
  assert.equal(
    loaded.dataLayer.filter((entry) => entry && entry[0] === 'config' && entry[1] === 'G-W45RMKHXV0').length,
    1
  );

  loaded.runTimeouts();
  assert.equal(
    loaded.appendedScripts.filter((script) => script.src.startsWith('https://www.googletagmanager.com/gtag/js?id=')).length,
    1,
    'deferred initialization cannot request gtag.js twice'
  );
});

test('deferred init reuses the eager AW Google tag request on a production phone page', () => {
  const phoneLink = makeWebsiteCallLink({ text: 'Call David' });
  const loaded = loadAnalytics({
    hostname: 'lakelandhealthinsurance.com',
    pathname: '/about/',
    phoneLinks: [phoneLink],
    readyState: 'complete'
  });

  assert.deepEqual(
    loaded.appendedScripts
      .map((script) => script.src)
      .filter((src) => src.startsWith('https://www.googletagmanager.com/gtag/js?id=')),
    ['https://www.googletagmanager.com/gtag/js?id=AW-300112445']
  );
  loaded.runTimeouts();
  assert.deepEqual(
    loaded.appendedScripts
      .map((script) => script.src)
      .filter((src) => src.startsWith('https://www.googletagmanager.com/gtag/js?id=')),
    ['https://www.googletagmanager.com/gtag/js?id=AW-300112445'],
    'GA4 configuration reuses the already requested Google tag library'
  );
  assert.equal(
    loaded.dataLayer.filter((entry) => entry && entry[0] === 'config' && entry[1] === 'G-W45RMKHXV0').length,
    1
  );
});

test('listener-order-safe DOMContentLoaded retry initializes website-call tracking for a late template link exactly once', () => {
  const phoneLinks = [];
  const loaded = loadAnalytics({
    hostname: 'lakelandhealthinsurance.com',
    pathname: '/about/',
    phoneLinks,
    readyState: 'interactive'
  });
  const lateLink = makeWebsiteCallLink({ text: 'Call David', nested: true });

  assert.deepEqual(loaded.appendedScripts, [], 'no Google tag loads before a canonical phone link exists');
  loaded.sandbox.document.addEventListener('DOMContentLoaded', () => phoneLinks.push(lateLink));
  loaded.dispatch('DOMContentLoaded');
  assert.deepEqual(loaded.appendedScripts, [], 'analytics retry waits until every DOMContentLoaded listener has run');
  loaded.runTimeouts();

  assert.deepEqual(
    loaded.appendedScripts.map((script) => script.src),
    ['https://www.googletagmanager.com/gtag/js?id=AW-300112445']
  );
  assert.equal(
    loaded.dataLayer.filter((entry) => entry && entry[0] === 'config' && entry[1] === 'AW-300112445/MVhNCILUi-IaEL20jY8B').length,
    1,
    'website-call conversion initializes exactly once'
  );

  loaded.dispatch('DOMContentLoaded');
  loaded.runTimeouts();
  assert.equal(loaded.appendedScripts.length, 1, 'a repeated retry cannot append the Ads tag again');
});

test('cached Google forwarding number is applied immediately to a late replacement link', () => {
  const initialLink = makeWebsiteCallLink({ text: 'Call 863-640-3102' });
  const phoneLinks = [initialLink];
  const loaded = loadAnalytics({
    hostname: 'lakelandhealthinsurance.com',
    pathname: '/about/',
    phoneLinks,
    readyState: 'interactive'
  });
  const tracking = loaded.sandbox.LHIWebsiteCallTracking;
  const lateLink = makeWebsiteCallLink({
    text: 'Call David',
    ariaLabel: 'Call David',
    nested: true
  });
  const originalIcon = lateLink.__testIcon;

  assert.equal(tracking.applyGoogleForwardingNumber('(407) 555-0112', '+14075550112'), 1);
  loaded.sandbox.document.addEventListener('DOMContentLoaded', () => phoneLinks.splice(0, phoneLinks.length, lateLink));
  loaded.dispatch('DOMContentLoaded');
  loaded.runTimeouts();

  assert.equal(lateLink.getAttribute('href'), 'tel:+14075550112');
  assert.equal(lateLink.getAttribute('data-lhi-business-phone'), '+18636403102');
  assert.equal(lateLink.getAttribute('aria-label'), 'Call David, (407) 555-0112');
  assert.match(lateLink.textContent, /\(407\) 555-0112/);
  assert.equal(lateLink.childNodes[0], originalIcon, 'late-link nested markup is preserved');
  assert.equal(loaded.appendedScripts.length, 1, 'cached application does not reinitialize the Ads tag');

  loaded.dispatch('click', lateLink);
  const canonical = loaded.dataLayer.filter((entry) => entry && entry.event === 'phone_call_click');
  assert.equal(canonical.length, 1);
  assert.equal(canonical[0].event_label, 'Call David');
});

test('website-call callback updates every link, preserves labels and markup, and is idempotent', () => {
  const numericLink = makeWebsiteCallLink({
    text: 'Call 863-640-3102',
    ariaLabel: 'Call David at 863-640-3102'
  });
  const labelLink = makeWebsiteCallLink({
    text: 'Call David',
    ariaLabel: 'Call David',
    nested: true
  });
  const originalIcon = labelLink.__testIcon;
  const loaded = loadAnalytics({ phoneLinks: [numericLink, labelLink] });
  const tracking = loaded.sandbox.LHIWebsiteCallTracking;

  assert.equal(tracking.applyGoogleForwardingNumber('(407) 555-0112', '+14075550112'), 2);
  for (const link of [numericLink, labelLink]) {
    assert.equal(link.getAttribute('href'), 'tel:+14075550112');
    assert.match(link.textContent, /\(407\) 555-0112/);
    assert.equal(link.getAttribute('data-lhi-business-phone'), '+18636403102');
  }
  assert.equal(labelLink.childNodes[0], originalIcon, 'existing icon markup is preserved');
  assert.equal(labelLink.getAttribute('aria-label'), 'Call David, (407) 555-0112');
  assert.equal(numericLink.getAttribute('aria-label'), 'Call David at (407) 555-0112');

  assert.equal(tracking.applyGoogleForwardingNumber('(321) 555-0199', '+13215550199'), 2);
  assert.equal(labelLink.getAttribute('href'), 'tel:+13215550199');
  assert.match(labelLink.textContent, /\(321\) 555-0199/);
  assert.doesNotMatch(labelLink.textContent, /\(407\) 555-0112/);
  assert.equal(labelLink.querySelector('[data-lhi-forwarding-number]').textContent, ': (321) 555-0199');

  loaded.dispatch('click', labelLink);
  const canonical = loaded.dataLayer.filter((entry) => entry && entry.event === 'phone_call_click');
  assert.equal(canonical.length, 1);
  assert.equal(canonical[0].event_label, 'Call David', 'forwarding number does not create a dynamic analytics label');
});

test('website-call callback rejects malformed forwarding values without changing links', () => {
  const link = makeWebsiteCallLink({ text: 'Call David' });
  const tracking = loadAnalytics({ phoneLinks: [link] }).sandbox.LHIWebsiteCallTracking;

  assert.equal(tracking.applyGoogleForwardingNumber('<script>alert(1)</script>', '+14075550112'), 0);
  assert.equal(tracking.applyGoogleForwardingNumber('(407) 555-0112', 'javascript:alert(1)'), 0);
  assert.equal(link.getAttribute('href'), 'tel:+18636403102');
  assert.equal(link.textContent, 'Call David');
});

test('first-party attribution loads immediately on the homepage, Get Help, and paid landing pages', () => {
  for (const pathname of ['/', '/get-help/', '/lp/aca/', '/lp/medicare/', '/lp/gap/']) {
    const { appendedScripts } = loadAnalytics({ pathname });
    assert.ok(
      appendedScripts.some((script) => script.src === '/js/funnel.js?v=20260821-lead-reconciliation'),
      `${pathname} requests the attribution bus during analytics initialization`
    );
  }
});

test('first-party delivery bus loads immediately on any parsed tracked form page', () => {
  const { appendedScripts } = loadAnalytics({
    pathname: '/brandon-health-insurance/',
    trackedForm: true
  });

  assert.ok(
    appendedScripts.some((script) => script.src === '/js/funnel.js?v=20260821-lead-reconciliation'),
    'a tracked city-page form requests the delivery bus during analytics initialization'
  );
});

test('tracked form pages with a direct funnel script do not request it twice', () => {
  const { appendedScripts } = loadAnalytics({
    pathname: '/plans/',
    trackedForm: true,
    funnelScriptPresent: true
  });

  assert.equal(
    appendedScripts.some((script) => script.src === '/js/funnel.js?v=20260821-lead-reconciliation'),
    false
  );
});

test('Medicare page context classifies hub, education, selection, and transaction pages exactly', () => {
  const hub = loadAnalytics({ pathname: '/MEDICARE/index.html' }).sandbox;
  const education = loadAnalytics({ pathname: '/moving-florida-medicare/' }).sandbox;
  const selection = loadAnalytics({ pathname: '/BEST-MEDICARE-BROKER-LAKELAND-FL/index.html' }).sandbox;
  const transaction = loadAnalytics({ pathname: '/medicare-broker-lakeland-fl/' }).sandbox;

  assert.deepEqual(JSON.parse(JSON.stringify(hub.LHIMedicareAttribution.pageContext(hub.location.pathname))), {
    schema_version: 'medicare-attribution.v1',
    page_key: 'medicare',
    page_role: 'hub',
    content_cluster: 'lakeland_medicare_broker',
    intent: 'medicare'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(education.LHIMedicareAttribution.pageContext(education.location.pathname))), {
    schema_version: 'medicare-attribution.v1',
    page_key: 'moving_florida_medicare',
    page_role: 'education',
    content_cluster: 'lakeland_medicare_broker',
    intent: 'medicare'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(selection.LHIMedicareAttribution.pageContext(selection.location.pathname))), {
    schema_version: 'medicare-attribution.v1',
    page_key: 'best_medicare_broker_lakeland_fl',
    page_role: 'selection',
    content_cluster: 'lakeland_medicare_broker',
    intent: 'medicare'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(transaction.LHIMedicareAttribution.pageContext(transaction.location.pathname))), {
    schema_version: 'medicare-attribution.v1',
    page_key: 'medicare_broker_lakeland_fl',
    page_role: 'transaction',
    content_cluster: 'lakeland_medicare_broker',
    intent: 'medicare'
  });
  assert.equal(selection.LHIMedicareAttribution.pageContext('/blog/best-medicare-broker-lakeland-fl/'), null);
});

test('Medicare content view emits once with only the versioned allowlisted context', () => {
  const { dataLayer } = loadAnalytics({ pathname: '/best-medicare-broker-lakeland-fl/' });
  const views = dataLayer.filter((entry) => entry && entry.event === 'MedicareContentView');

  assert.equal(views.length, 1);
  assert.deepEqual(Object.keys(views[0]).sort(), [
    'content_cluster',
    'event',
    'event_id',
    'intent',
    'page_key',
    'page_role',
    'schema_version'
  ]);
  assert.match(views[0].event_id, /^lhi_measurement_/);
  assert.equal(views[0].page_key, 'best_medicare_broker_lakeland_fl');
  assert.equal(views[0].page_role, 'selection');

  const directGA4 = dataLayer.filter((entry) => entry && entry[0] === 'event' && entry[1] === 'medicare_content_view');
  assert.equal(directGA4.length, 1);
  assert.equal(directGA4[0][2].event_id, views[0].event_id);
});

test('Medicare CTA click uses a registered key, preserves safe campaign values, and ignores link text', () => {
  const link = makeAnalyticsLink({
    href: '/get-help/',
    medicareCta: 'request_review_hero'
  });
  const { dataLayer, sessionStorage, dispatch } = loadAnalytics({
    pathname: '/best-medicare-broker-lakeland-fl/',
    search: '?utm_source=google&utm_campaign=medicare_review&utm_term=jane%40example.com',
    link
  });

  dispatch('click');

  const clicks = dataLayer.filter((entry) => entry && entry.event === 'MedicareCtaClick');
  assert.equal(clicks.length, 1);
  assert.deepEqual(Object.keys(clicks[0]).sort(), [
    'content_cluster',
    'cta_key',
    'event',
    'event_id',
    'intent',
    'page_key',
    'page_role',
    'schema_version'
  ]);
  assert.equal(clicks[0].cta_key, 'request_review_hero');
  assert.equal(JSON.stringify(clicks[0]).includes('Jane Doe'), false);
  assert.equal(JSON.stringify(clicks[0]).includes('jane@example.com'), false);
  assert.equal(JSON.stringify(clicks[0]).includes('863-640-3102'), false);

  const destination = new URL(link.getAttribute('href'), 'https://lakelandhealthinsurance.com');
  assert.equal(destination.pathname, '/get-help/');
  assert.equal(destination.searchParams.get('intent'), 'medicare');
  assert.equal(destination.searchParams.get('source_page_key'), 'best_medicare_broker_lakeland_fl');
  assert.equal(destination.searchParams.get('source_cta_key'), 'request_review_hero');
  assert.equal(destination.searchParams.get('utm_source'), 'google');
  assert.equal(destination.searchParams.get('utm_campaign'), 'medicare_review');
  assert.equal(destination.searchParams.has('utm_term'), false);

  const stored = JSON.parse(sessionStorage.getItem('lhi_medicare_source'));
  assert.equal(stored.source_page_role, 'selection');
  assert.equal(stored.source_cta_key, 'request_review_hero');
});

test('Medicare attribution rejects tampered page, CTA, and campaign values', () => {
  const unregistered = makeAnalyticsLink({
    href: '/get-help/',
    medicareCta: 'jane@example.com'
  });
  const loaded = loadAnalytics({
    pathname: '/best-medicare-broker-lakeland-fl/',
    link: unregistered
  });

  loaded.dispatch('click');

  assert.equal(loaded.dataLayer.some((entry) => entry && entry.event === 'MedicareCtaClick'), false);
  assert.equal(unregistered.getAttribute('href'), '/get-help/');
  assert.equal(loaded.sessionStorage.getItem('lhi_medicare_source'), null);

  const helper = loaded.sandbox.LHIMedicareAttribution;
  assert.equal(helper.sourceContext('?intent=medicare&source_page_key=unknown&source_cta_key=request_review_hero'), null);
  assert.equal(helper.sourceContext('?intent=medicare&source_page_key=best_medicare_broker_lakeland_fl&source_cta_key=unknown'), null);
  assert.equal(helper.sourceContext('?intent=aca&source_page_key=best_medicare_broker_lakeland_fl&source_cta_key=request_review_hero'), null);
  for (const hostileKey of ['constructor', 'toString', '__proto__']) {
    assert.equal(helper.sourceContext(`?intent=medicare&source_page_key=${hostileKey}&source_cta_key=request_review_hero`), null);
    assert.equal(helper.sourceContext(`?intent=medicare&source_page_key=best_medicare_broker_lakeland_fl&source_cta_key=${hostileKey}`), null);

    const hostileLink = makeAnalyticsLink({
      href: '/get-help/',
      medicareCta: hostileKey
    });
    const hostileLoaded = loadAnalytics({
      pathname: '/best-medicare-broker-lakeland-fl/',
      link: hostileLink
    });
    hostileLoaded.dispatch('click');
    assert.equal(hostileLoaded.dataLayer.some((entry) => entry && entry.event === 'MedicareCtaClick'), false);
    assert.equal(hostileLink.getAttribute('href'), '/get-help/');
  }
  assert.equal(helper.approvedCampaignValue('jane@example.com'), null);
  assert.equal(helper.approvedCampaignValue('863-640-3102'), null);

  assert.deepEqual(JSON.parse(JSON.stringify(helper.sourceContext(
    '?intent=medicare&source_page_key=best_medicare_broker_lakeland_fl&source_page_role=transaction&source_cta_key=request_review_hero'
  ))), {
    schema_version: 'medicare-attribution.v1',
    source_page_key: 'best_medicare_broker_lakeland_fl',
    source_page_role: 'selection',
    source_cta_key: 'request_review_hero',
    content_cluster: 'lakeland_medicare_broker',
    intent: 'medicare'
  });
});

test('Medicare source pages declare exact roles and deterministic keyed Get Help CTAs', () => {
  for (const [html, expected] of [
    [MEDICARE_HUB_HTML, {
      pageKey: 'medicare',
      pageRole: 'hub',
      ctaKeys: ['request_review_process', 'start_review_final', 'start_review_hero']
    }],
    [BEST_MEDICARE_BROKER_HTML, {
      pageKey: 'best_medicare_broker_lakeland_fl',
      pageRole: 'selection',
      ctaKeys: ['request_help_final', 'request_review_hero', 'start_review_criteria']
    }],
    [MEDICARE_BROKER_HTML, {
      pageKey: 'medicare_broker_lakeland_fl',
      pageRole: 'transaction',
      ctaKeys: ['request_review_final', 'request_review_hero', 'request_review_verification']
    }],
    ...MEDICARE_EDUCATION_PAGES.map((page) => [page.html, page])
  ]) {
    assert.match(html, new RegExp(`<body[^>]*data-page-key="${expected.pageKey}"[^>]*data-page-role="${expected.pageRole}"[^>]*data-content-cluster="lakeland_medicare_broker"`));
    const ctas = getHelpCtas(html);
    assert.ok(ctas.length > 0, `${expected.pageKey} has Get Help CTAs`);
    assert.deepEqual(ctas.map((cta) => cta.ctaKey).sort(), expected.ctaKeys);
    assert.match(html, /\/js\/analytics\.js\?v=20260821-lead-reconciliation/);

    for (const cta of ctas) {
      const url = new URL(cta.href, 'https://lakelandhealthinsurance.com');
      assert.equal(url.pathname, '/get-help/');
      assert.equal(url.searchParams.get('intent'), 'medicare');
      assert.equal(url.searchParams.get('source_page_key'), expected.pageKey);
      assert.equal(url.searchParams.get('source_cta_key'), cta.ctaKey);
      assert.equal(url.searchParams.has('source_page_role'), false, 'role is derived from the registry, not trusted from the URL');
    }
  }

  assert.match(BEST_MEDICARE_BROKER_HTML, /href="\/medicare-broker-lakeland-fl\/" data-medicare-cta="see_review_process"/);
  assert.match(MEDICARE_BROKER_HTML, /href="\/best-medicare-broker-lakeland-fl\/" data-medicare-cta="selection_guide_nav"/);
});

test('Lead tracking sets pending thank-you lead marker', () => {
  const w = loadFunnel({ pathname: '/lp/aca/' });
  const eventID = '223e4567-e89b-42d3-a456-426614174000';

  w.LHI.track('Lead', {
    content_name: 'first_party_lead',
    step: 'submit',
    event_id: eventID,
    acceptance_status: 'forms_accepted'
  });

  const raw = w.sessionStorage.getItem('lhi_lead_submitted');
  assert.ok(raw, 'pending lead marker stored');
  const marker = JSON.parse(raw);
  assert.equal(marker.event_id, eventID);
  assert.equal(marker.content_name, 'first_party_lead');
  assert.equal(marker.page_type, 'lp_aca');
  assert.equal(marker.page_path, '/lp/aca/');
  assert.equal(typeof marker.fired_at, 'number');
  const leadEvents = w.dataLayer.filter((entry) => entry && entry.event === 'Lead');
  assert.equal(leadEvents.length, 1, 'one GTM Lead event fires at the delivery boundary');
  assert.equal(leadEvents[0].event_id, marker.event_id);
});

test('Lead tracking fails closed without a Forms-accepted server receipt', () => {
  const w = loadFunnel({ pathname: '/get-help/' });

  assert.equal(w.LHI.track('Lead', { content_name: 'get_help_lead_form' }), false);
  assert.equal(w.LHI.track('Lead', {
    content_name: 'first_party_lead',
    event_id: '323e4567-e89b-42d3-a456-426614174000'
  }), false);
  assert.equal(w.LHI.track('Lead', {
    content_name: 'first_party_lead',
    event_id: 'not-approved',
    acceptance_status: 'forms_accepted'
  }), false);

  assert.equal(w.dataLayer.some((entry) => entry && entry.event === 'Lead'), false);
  assert.equal(w.sessionStorage.getItem('lhi_lead_submitted'), null);
});

test('Lead tracking emits one GTM event for one accepted server event ID', () => {
  const w = loadFunnel({ pathname: '/get-help/' });
  const receipt = {
    content_name: 'first_party_lead',
    step: 'submit',
    event_id: '423e4567-e89b-42d3-a456-426614174000',
    acceptance_status: 'forms_accepted'
  };

  assert.equal(w.LHI.track('Lead', receipt), true);
  assert.equal(w.LHI.track('Lead', receipt), false);
  assert.equal(w.LHI.track('Lead', Object.assign({}, receipt, {
    event_id: '523e4567-e89b-42d3-a456-426614174000'
  })), true);

  const leadEvents = w.dataLayer.filter((entry) => entry && entry.event === 'Lead');
  assert.equal(leadEvents.length, 2);
  assert.equal(leadEvents[0].event_id, receipt.event_id);
  assert.equal(leadEvents[1].event_id, '523e4567-e89b-42d3-a456-426614174000');
});

test('non-API Lead forms remain deliverable but never emit a canonical conversion', () => {
  const form = makeFunnelForm({
    apiOptOut: true,
    fields: { 'form-name': 'get-help' }
  });
  const w = loadFunnel({ pathname: '/get-help/', forms: [form] });
  let prevented = false;

  form.dispatchSubmit({ preventDefault() { prevented = true; } });

  assert.equal(prevented, false, 'native form delivery is not blocked');
  assert.equal(w.dataLayer.some((entry) => entry && entry.event === 'Lead'), false);
  assert.equal(w.sessionStorage.getItem('lhi_lead_submitted'), null);
});

test('city lead pages rely only on the canonical delivery bus', () => {
  for (const page of CITY_LEAD_PAGES) {
    assert.match(page.html, /<form\b[^>]*data-funnel-track[^>]*data-funnel-event="Lead"/i, `${page.route} has a canonical tracked form`);
    assert.doesNotMatch(page.html, /gtag\('event',\s*'lead_submit'/, `${page.route} has no legacy lead_submit event`);
    assert.doesNotMatch(page.html, /fetch\('\/'\s*,\s*\{[\s\S]{0,240}application\/x-www-form-urlencoded/, `${page.route} has no page-local direct Forms POST`);
  }
});

test('Medicare Lead fires once only after semantic Forms acceptance and carries canonical context', async () => {
  const calls = [];
  const form = makeFunnelForm({
    contentName: 'get_help_medicare',
    fields: {
      'form-name': 'get-help',
      full_name: 'Jane Doe',
      phone_number: '863-640-3102',
      email: 'jane@example.com',
      zip_code: '33801',
      coverage_status: 'Uninsured',
      best_time_to_reach: 'Anytime during business hours',
      normalized_intent: 'medicare',
      line_of_business: 'Medicare',
      need_timing: 'Within 30 days',
      source_page_key: 'best_medicare_broker_lakeland_fl',
      source_page_role: 'attacker-supplied-role',
      source_cta_key: 'request_review_hero',
      content_cluster: 'attacker-supplied-cluster',
      lead_priority: '',
      lead_priority_reason: ''
    }
  });
  const w = loadFunnel({
    pathname: '/get-help/',
    search: '?intent=medicare&source_page_key=best_medicare_broker_lakeland_fl&source_cta_key=request_review_hero',
    forms: [form],
    fetchImpl: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          forms: true,
          event_id: '123e4567-e89b-42d3-a456-426614174000',
          accepted_at: '2026-08-14T14:00:00.000Z',
          source_page_key: 'best_medicare_broker_lakeland_fl',
          source_page_role: 'selection',
          source_cta_key: 'request_review_hero',
          content_cluster: 'lakeland_medicare_broker',
          lead_priority: 'high',
          lead_priority_reason: 'urgent_or_high_intent_with_contact_path'
        })
      });
    }
  });
  let prevented = false;
  let stopped = false;

  form.dispatchSubmit({
    preventDefault() { prevented = true; },
    stopImmediatePropagation() { stopped = true; }
  });
  await flushPromises();

  assert.equal(prevented, true);
  assert.equal(stopped, true);
  const apiCalls = calls.filter((call) => call.url === '/api/lead');
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].init.method, 'POST');
  assert.equal(apiCalls[0].init.headers['Content-Type'], 'application/json');

  const payload = JSON.parse(apiCalls[0].init.body);
  assert.equal(payload.content_name, 'get_help_medicare');
  assert.equal(payload['form-name'], 'get-help');
  assert.equal(payload.phone_number, '863-640-3102');
  assert.equal(payload.zip_code, '33801');

  const leadEvents = w.dataLayer.filter((entry) => entry && entry.event === 'Lead');
  assert.equal(leadEvents.length, 1, 'one GTM Lead event queued');
  const leadParams = JSON.parse(JSON.stringify(leadEvents[0]));
  assert.deepEqual(leadParams, {
    event: 'Lead',
    content_name: 'first_party_lead',
    step: 'submit',
    acceptance_status: 'forms_accepted',
    schema_version: 'medicare-attribution.v1',
    page_key: 'get_help',
    page_role: 'intake',
    source_page_key: 'best_medicare_broker_lakeland_fl',
    source_page_role: 'selection',
    source_cta_key: 'request_review_hero',
    content_cluster: 'lakeland_medicare_broker',
    intent: 'medicare',
    event_id: '123e4567-e89b-42d3-a456-426614174000',
    page_type: 'get_help',
    original_event_name: 'Lead',
  });
  assert.equal(leadParams.full_name, undefined);
  assert.equal(leadParams.email, undefined);
  assert.equal(leadParams.phone_number, undefined);
  assert.equal(JSON.stringify(leadParams).includes('attacker-supplied'), false);
  assert.equal(form.elements.lead_priority.value, 'high');
  assert.equal(form.elements.lead_priority_reason.value, 'urgent_or_high_intent_with_contact_path');
  assert.ok(w.sessionStorage.getItem('lhi_lead_submitted'), 'thank-you marker set');
  assert.equal(JSON.parse(w.sessionStorage.getItem('lhi_lead_submitted')).event_id, '123e4567-e89b-42d3-a456-426614174000');
  assert.equal(w.dataLayer.filter((entry) => entry && entry[0] === 'event' && entry[1] === 'generate_lead').length, 0);

  const thanks = runThanksHeadScript(w.sessionStorage);
  assert.equal(thanks.dataLayer.some((entry) => entry && entry[0] === 'event' && entry[1] === 'generate_lead'), false);
  assert.equal(w.sessionStorage.getItem('lhi_lead_submitted'), null, 'thank-you page consumes the marker without another conversion');
});

test('funnel forms fire StartLead once as a diagnostic event', () => {
  const form = makeFunnelForm({ contentName: 'get_help_conversational' });
  const w = loadFunnel({ pathname: '/get-help/', forms: [form] });

  form.dispatchFormStart();
  form.dispatchFormStart();

  const starts = w.dataLayer.filter((entry) => entry.event === 'StartLead');
  assert.equal(starts.length, 1);
  assert.equal(starts[0].event_params.content_name, 'get_help_conversational');
  assert.equal(starts[0].event_params.step, 'start');
});

test('Medicare intake start fires once with canonical source context', () => {
  const form = makeFunnelForm({ contentName: 'get_help_medicare' });
  const w = loadFunnel({
    pathname: '/get-help/',
    search: '?intent=medicare&source_page_key=medicare_broker_lakeland_fl&source_cta_key=request_review_final',
    forms: [form]
  });

  form.dispatchFormStart();
  form.dispatchFormStart();

  const starts = w.dataLayer.filter((entry) => entry && entry.event === 'MedicareIntakeStart');
  assert.equal(starts.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(starts[0])), {
    event: 'MedicareIntakeStart',
    page_type: 'get_help',
    content_name: 'get_help_medicare',
    step: 'start',
    schema_version: 'medicare-attribution.v1',
    page_key: 'get_help',
    page_role: 'intake',
    source_page_key: 'medicare_broker_lakeland_fl',
    source_page_role: 'transaction',
    source_cta_key: 'request_review_final',
    content_cluster: 'lakeland_medicare_broker',
    intent: 'medicare'
  });
  const directGA4 = w.dataLayer.filter((entry) => entry && entry[0] === 'event' && entry[1] === 'medicare_intake_start');
  assert.equal(directGA4.length, 1);
});

test('safeProps uses a positive analytics allowlist and canonicalizes Medicare context', () => {
  const { safeProps } = loadFunnel().LHI._t;
  const safe = JSON.parse(JSON.stringify(safeProps({
    content_name: 'first_party_lead',
    step: 'submit',
    event_id: '323e4567-e89b-42d3-a456-426614174000',
    source_page_path: '/get-help/?email=jane@example.com',
    page_key: 'get_help',
    page_role: 'intake',
    source_page_key: 'best_medicare_broker_lakeland_fl',
    source_page_role: 'tampered',
    source_cta_key: 'request_review_hero',
    content_cluster: 'tampered',
    acceptance_status: 'forms_accepted',
    full_name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '863-640-3102',
    zip_code: '33801',
    date_of_birth: '1955-01-01',
    age: 71,
    medicare_id: '1EG4-TE5-MK72',
    current_plan: 'Private plan name',
    provider_name: 'Private Clinic',
    facility_name: 'Private Hospital',
    prescription_name: 'Private Drug',
    household_income: '65000',
    health_status: 'Private status',
    coverage_status: 'Uninsured',
    notes: 'Private note',
    message: 'Private message',
    free_text: 'Private text',
    mystery: 'Jane Doe',
    nested: { email: 'jane@example.com' }
  })));

  assert.deepEqual(safe, {
    content_name: 'first_party_lead',
    step: 'submit',
    event_id: '323e4567-e89b-42d3-a456-426614174000',
    source_page_path: '/get-help/',
    schema_version: 'medicare-attribution.v1',
    source_page_key: 'best_medicare_broker_lakeland_fl',
    source_page_role: 'selection',
    source_cta_key: 'request_review_hero',
    content_cluster: 'lakeland_medicare_broker',
    intent: 'medicare',
    page_key: 'get_help',
    page_role: 'intake',
    acceptance_status: 'forms_accepted'
  });
  const serialized = JSON.stringify(safe);
  for (const prohibited of ['Jane Doe', 'jane@example.com', '863-640-3102', '33801', 'Private']) {
    assert.equal(serialized.includes(prohibited), false, `${prohibited} excluded from analytics`);
  }
});

test('Medicare funnel helpers reject prototype-chain registry keys', () => {
  const { canonicalSourceContext, safeProps } = loadFunnel().LHI._t;

  for (const hostileKey of ['constructor', 'toString', '__proto__']) {
    assert.equal(canonicalSourceContext({
      source_page_key: hostileKey,
      source_cta_key: 'start_review_hero'
    }), null);
    assert.equal(canonicalSourceContext({
      source_page_key: 'medicare',
      source_cta_key: hostileKey
    }), null);
    assert.deepEqual(JSON.parse(JSON.stringify(safeProps({
      page_key: hostileKey,
      page_role: 'hub',
      cta_key: 'start_review_hero',
      source_page_key: hostileKey,
      source_cta_key: 'start_review_hero'
    }))), {});

    const validPage = JSON.parse(JSON.stringify(safeProps({
      page_key: 'medicare',
      page_role: 'hub',
      cta_key: hostileKey
    })));
    assert.equal(validPage.page_key, 'medicare');
    assert.equal('cta_key' in validPage, false);
  }
});

test('Subscriber form posts through /api/lead and never fires Lead', async () => {
  const calls = [];
  const form = makeFunnelForm({
    eventName: 'Subscriber',
    contentName: 'newsletter_optin',
    fields: {
      'form-name': 'newsletter-signup',
      email: 'reader@example.com',
      consent: 'yes'
    }
  });
  const w = loadFunnel({
    pathname: '/newsletter/',
    forms: [form],
    fetchImpl: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          forms: true,
          event_id: '223e4567-e89b-42d3-a456-426614174000'
        })
      });
    }
  });

  form.dispatchSubmit();
  await flushPromises();

  const apiCalls = calls.filter((call) => call.url === '/api/lead');
  assert.equal(apiCalls.length, 1);
  assert.equal(w.dataLayer.some((entry) => entry.event === 'Subscriber'), true);
  assert.equal(w.dataLayer.some((entry) => entry.event === 'Lead'), false);
  assert.equal(w.sessionStorage.getItem('lhi_lead_submitted'), null);
  assert.ok(w.sessionStorage.getItem('lhi_submission_completed'), 'subscriber thank-you marker set');
});

test('completed lead receipt shows only the short follow-up message', () => {
  assert.match(THANKS_SRC, /David will reach out shortly\./);
  assert.match(THANKS_SRC, /\['thanksEyebrow', 'thanksSubtitle', 'nextGrid', 'ctaRow', 'privacyNote'\]\.forEach\(hide\)/);
  assert.match(THANKS_SRC, /\/js\/analytics\.js\?v=20260821-lead-reconciliation/);
});

test('direct thank-you visits show customer-facing help copy', () => {
  assert.match(THANKS_SRC, /Need help choosing coverage\?/);
  assert.match(THANKS_SRC, /Start with the short request form, call David, or choose an appointment time\./);
  assert.doesNotMatch(THANKS_SRC, /conversion accuracy|do not create a lead event/i);
});

test('funnel events bridge directly to named GA4 events while GTM owns Lead', () => {
  const gtagCalls = [];
  const w = loadFunnel({
    pathname: '/get-help/',
    gtagImpl: (...args) => gtagCalls.push(args)
  });

  w.LHI.track('Subscriber', { content_name: 'homepage_newsletter_optin', step: 'submit' });
  w.LHI.track('Schedule', { content_name: 'get_help_calendly_click' });
  w.LHI.track('ExternalQuoteClick', { content_name: 'get_help_external_quote_click' });
  w.LHI.track('messenger_click', { content_name: 'get_help_messenger_click' });
  w.LHI.track('Lead', {
    content_name: 'first_party_lead',
    step: 'submit',
    event_id: '823e4567-e89b-42d3-a456-426614174000',
    acceptance_status: 'forms_accepted'
  });
  w.LHI.track('PhoneCallClick', { content_name: 'get_help_phone_click' });

  const ga4Events = gtagCalls.filter((call) => call[0] === 'event');
  assert.deepEqual(ga4Events.map((call) => call[1]), [
    'newsletter_signup',
    'schedule_appointment',
    'external_quote_click',
    'messenger_click'
  ]);
  assert.equal(ga4Events.filter((call) => call[1] === 'generate_lead').length, 0);
  assert.equal(w.dataLayer.filter((entry) => entry && entry.event === 'Lead').length, 1);
  assert.equal(ga4Events.some((call) => call[1] === 'phone_call_click'), false);
  assert.equal(ga4Events[0][2].page_type, 'get_help');
  assert.equal(ga4Events[0][2].original_event_name, 'Subscriber');
  assert.equal(ga4Events[0][2].transport_type, 'beacon');
});

test('production Lead queues one GTM event without direct GA4 or Ads conversion', async () => {
  const gtagCalls = [];
  const w = loadFunnel({
    pathname: '/get-help/',
    isProd: true,
    gtagImpl: (...args) => gtagCalls.push(args),
    fetchImpl: () => Promise.resolve({ ok: false })
  });

  w.LHI.track('Lead', {
    content_name: 'first_party_lead',
    step: 'submit',
    event_id: '923e4567-e89b-42d3-a456-426614174000',
    acceptance_status: 'forms_accepted'
  });
  await flushPromises();

  assert.equal(w.dataLayer.filter((entry) => entry && entry.event === 'Lead').length, 1);
  assert.equal(gtagCalls.some((call) => call[0] === 'event' && call[1] === 'generate_lead'), false);
  assert.equal(gtagCalls.some((call) => call[0] === 'event' && call[1] === 'conversion'), false);
});

test('secondary funnel events queue named GA4 events when gtag is not initialized yet', () => {
  const w = loadFunnel({ pathname: '/get-help/' });

  w.LHI.track('Schedule', { content_name: 'get_help_calendly_click' });

  const queuedCommand = w.dataLayer.find((entry) => entry && entry[0] === 'event' && entry[1] === 'schedule_appointment');
  assert.ok(queuedCommand, 'schedule_appointment command should be queued for gtag.js');
  assert.equal(queuedCommand[2].page_type, 'get_help');
  assert.equal(queuedCommand[2].original_event_name, 'Schedule');
  assert.equal(queuedCommand[2].transport_type, 'beacon');
});

test('funnel tracking does not send third-party telemetry or raw PII in event params', () => {
  const calls = [];
  const w = loadFunnel({
    pathname: '/get-help/',
    fetchImpl: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve({ ok: true });
    }
  });

  w.LHI.track('StartLead', {
    content_name: 'get_help_aca',
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '863-640-3102',
    zip: '33801',
    provider_name: 'Clinic Name',
    household_income: '65000',
    coverage_status: 'uninsured'
  });

  assert.equal(calls.length, 0);

  const startLead = w.dataLayer.find((entry) => entry && entry.event === 'StartLead');
  assert.ok(startLead, 'StartLead should still reach dataLayer');
  assert.equal(startLead.event_params.email, undefined);
  assert.equal(startLead.event_params.zip, undefined);
  assert.equal(startLead.event_params.provider_name, undefined);
  assert.equal(startLead.event_params.household_income, undefined);
  assert.equal(startLead.event_params.coverage_status, undefined);
  assert.equal(JSON.stringify(startLead).includes('jane@example.com'), false);
  assert.equal(JSON.stringify(startLead).includes('863-640-3102'), false);
  assert.equal(JSON.stringify(startLead).includes('Jane Doe'), false);
});

test('Lead form client rejection does not submit fallback or keep thank-you marker', async () => {
  const form = makeFunnelForm({
    fields: {
      'form-name': 'get-help',
      email: 'bot@example.com'
    }
  });
  const w = loadFunnel({
    pathname: '/get-help/',
    forms: [form],
    fetchImpl: () => Promise.resolve({ ok: false, status: 422 })
  });

  form.dispatchSubmit();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(form.__submitted, false);
  assert.equal(w.sessionStorage.getItem('lhi_lead_submitted'), null);
  assert.equal(w.dataLayer.some((entry) => entry.event === 'Lead'), false);
});

test('Lead form API failure falls back to native Netlify submit without delivered lead marker', async () => {
  const form = makeFunnelForm({
    fields: {
      'form-name': 'lp-aca-lead',
      email: 'jane@example.com'
    }
  });
  const w = loadFunnel({
    pathname: '/lp/aca/',
    forms: [form],
    fetchImpl: () => Promise.resolve({ ok: false, status: 500 })
  });

  form.dispatchSubmit();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(form.__submitted, true);
  assert.equal(w.sessionStorage.getItem('lhi_lead_submitted'), null);
  assert.equal(w.dataLayer.some((entry) => entry.event === 'Lead'), false);
});

test('HTTP 200 without semantic Forms acceptance never fires Lead or redirects', async () => {
  const cases = [
    {
      name: 'body ok is false',
      json: () => Promise.resolve({ ok: false, forms: true, event_id: '423e4567-e89b-42d3-a456-426614174000' })
    },
    {
      name: 'forms is false',
      json: () => Promise.resolve({ ok: true, forms: false, event_id: '523e4567-e89b-42d3-a456-426614174000' })
    },
    {
      name: 'event id is missing',
      json: () => Promise.resolve({ ok: true, forms: true })
    },
    {
      name: 'event id is malformed',
      json: () => Promise.resolve({ ok: true, forms: true, event_id: 'jane@example.com' })
    },
    {
      name: 'response body is invalid JSON',
      json: () => Promise.reject(new Error('invalid json'))
    }
  ];

  for (const scenario of cases) {
    const form = makeFunnelForm({
      contentName: 'get_help_medicare',
      fields: {
        'form-name': 'get-help',
        normalized_intent: 'medicare',
        source_page_key: 'best_medicare_broker_lakeland_fl',
        source_cta_key: 'request_review_hero'
      }
    });
    const w = loadFunnel({
      pathname: '/get-help/',
      search: '?intent=medicare&source_page_key=best_medicare_broker_lakeland_fl&source_cta_key=request_review_hero',
      forms: [form],
      fetchImpl: () => Promise.resolve({ ok: true, json: scenario.json })
    });

    form.dispatchSubmit();
    await flushPromises(6);

    assert.equal(w.dataLayer.some((entry) => entry && entry.event === 'Lead'), false, scenario.name);
    assert.equal(w.sessionStorage.getItem('lhi_lead_submitted'), null, scenario.name);
    assert.equal(form.__submitted, false, `${scenario.name} must not fall back after a semantically invalid 200`);
    assert.equal(w.location.href, 'http://localhost/get-help/?intent=medicare&source_page_key=best_medicare_broker_lakeland_fl&source_cta_key=request_review_hero', scenario.name);
  }
});

test('ACA semantic success remains one accepted Lead without Medicare attribution', async () => {
  const form = makeFunnelForm({
    contentName: 'get_help_aca',
    fields: {
      'form-name': 'get-help',
      normalized_intent: 'aca',
      line_of_business: 'ACA',
      email: 'jane@example.com'
    }
  });
  const w = loadFunnel({
    pathname: '/get-help/',
    search: '?intent=aca',
    forms: [form],
    fetchImpl: () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        forms: true,
        event_id: '623e4567-e89b-42d3-a456-426614174000'
      })
    })
  });

  form.dispatchSubmit();
  await flushPromises(6);

  const leads = w.dataLayer.filter((entry) => entry && entry.event === 'Lead');
  assert.equal(leads.length, 1);
  assert.equal(leads[0].event_id, '623e4567-e89b-42d3-a456-426614174000');
  assert.equal(leads[0].acceptance_status, 'forms_accepted');
  assert.equal(leads[0].source_page_key, undefined);
  assert.equal(leads[0].content_cluster, undefined);
  assert.equal(w.dataLayer.some((entry) => entry && entry.event === 'MedicareIntakeStart'), false);
  assert.equal(w.dataLayer.some((entry) => entry && entry[0] === 'event' && entry[1] === 'generate_lead'), false);
});

test('double Medicare submit produces one API call and one accepted Lead', async () => {
  let resolveFetch;
  let callCount = 0;
  const form = makeFunnelForm({
    contentName: 'get_help_medicare',
    fields: {
      'form-name': 'get-help',
      normalized_intent: 'medicare',
      source_page_key: 'medicare_broker_lakeland_fl',
      source_cta_key: 'request_review_final'
    }
  });
  const w = loadFunnel({
    pathname: '/get-help/',
    search: '?intent=medicare&source_page_key=medicare_broker_lakeland_fl&source_cta_key=request_review_final',
    forms: [form],
    fetchImpl: () => {
      callCount += 1;
      return new Promise((resolveFetchPromise) => { resolveFetch = resolveFetchPromise; });
    }
  });

  form.dispatchSubmit();
  form.dispatchSubmit();
  assert.equal(callCount, 1);

  resolveFetch({
    ok: true,
    json: () => Promise.resolve({
      ok: true,
      forms: true,
      event_id: '723e4567-e89b-42d3-a456-426614174000',
      source_page_key: 'medicare_broker_lakeland_fl',
      source_page_role: 'transaction',
      source_cta_key: 'request_review_final',
      content_cluster: 'lakeland_medicare_broker'
    })
  });
  await flushPromises(6);

  const leads = w.dataLayer.filter((entry) => entry && entry.event === 'Lead');
  assert.equal(leads.length, 1);
  assert.equal(leads[0].event_id, '723e4567-e89b-42d3-a456-426614174000');
  assert.equal(leads[0].acceptance_status, 'forms_accepted');
  assert.equal(w.dataLayer.some((entry) => entry && entry[0] === 'event' && entry[1] === 'generate_lead'), false);
});

test('thanks.html does not fire generate_lead without pending marker', () => {
  const { dataLayer, sandbox } = runThanksHeadScript(makeSessionStorage());

  assert.equal(sandbox.__LHI_THANKS_LEAD_MARKER, null);
  assert.equal(dataLayer.some((entry) => entry[0] === 'event' && entry[1] === 'generate_lead'), false);
});

test('thanks.html consumes pending Lead marker without firing a second generate_lead', () => {
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
  assert.equal(generateLeadEvents.length, 0);

  const secondRun = runThanksHeadScript(storage);
  assert.equal(secondRun.dataLayer.some((entry) => entry[0] === 'event' && entry[1] === 'generate_lead'), false);
});

test('thank-you arrival records one diagnostic final-funnel view without another Lead conversion', () => {
  const marker = {
    kind: 'Lead',
    event_id: 'lhi_test_receipt_123',
    page_type: 'get_help',
    page_path: '/get-help/?zip_code=33801',
    fired_at: Date.now()
  };
  const w = loadFunnel({ pathname: '/thanks.html', receiptMarker: marker });

  const receiptViews = w.dataLayer.filter((entry) => entry && entry.event === 'LeadReceiptView');
  assert.equal(receiptViews.length, 1);
  assert.equal(receiptViews[0].event_params.content_name, 'lead_thank_you');
  assert.equal(receiptViews[0].event_params.step, 'complete');
  assert.equal(receiptViews[0].event_params.source_page_type, 'get_help');
  assert.equal(receiptViews[0].event_params.source_page_path, '/get-help/');
  assert.equal(w.dataLayer.filter((entry) => entry && entry.event === 'Lead').length, 0);
  assert.equal(w.dataLayer.filter((entry) => entry[0] === 'event' && entry[1] === 'generate_lead').length, 0);
  assert.equal(w.dataLayer.filter((entry) => entry[0] === 'event' && entry[1] === 'lead_receipt_view').length, 1);

  const directVisit = loadFunnel({ pathname: '/thanks.html' });
  assert.equal(directVisit.dataLayer.filter((entry) => entry && entry.event === 'LeadReceiptView').length, 0);
});

test('thanks.html shows Subscriber marker without generate_lead', () => {
  const marker = {
    kind: 'Subscriber',
    event_id: 'lhi_subscriber_123',
    content_name: 'newsletter_optin',
    page_type: 'site',
    page_path: '/newsletter/',
    fired_at: Date.now()
  };
  const storage = makeSessionStorage({ lhi_submission_completed: JSON.stringify(marker) });

  const { dataLayer, sandbox } = runThanksHeadScript(storage);

  assert.deepEqual(sandbox.__LHI_THANKS_SUBMISSION, marker);
  assert.equal(sandbox.__LHI_THANKS_LEAD_MARKER, null);
  assert.equal(dataLayer.some((entry) => entry[0] === 'event' && entry[1] === 'generate_lead'), false);
});

test('analytics QA override is session-bounded and explicitly clearable', () => {
  assert.match(ANALYTICS_SRC, /sessionStorage\.setItem\('lhi_analytics_test', '1'\)/);
  assert.match(ANALYTICS_SRC, /sessionStorage\.removeItem\('lhi_analytics_test'\)/);
  assert.doesNotMatch(ANALYTICS_SRC, /localStorage\.(?:getItem|setItem)\('lhi_analytics_test'/);
  assert.match(ANALYTICS_SRC, /debug_mode: IS_ANALYTICS_DEBUG/);
});

test('attribution cookies add Secure on HTTPS', () => {
  assert.match(FUNNEL_SRC, /location\.protocol === 'https:' \? '; Secure'/);
  assert.match(FUNNEL_SRC, /SameSite=Lax' \+ secure/);
});

test('retired Get Help v2 is a noindex redirect without a lead form or Offer schema', () => {
  assert.match(GET_HELP_V2_HTML, /name="robots" content="noindex, nofollow"/);
  assert.match(GET_HELP_V2_HTML, /rel="canonical" href="https:\/\/lakelandhealthinsurance\.com\/get-help\/"/);
  assert.match(GET_HELP_V2_HTML, /http-equiv="refresh" content="0; url=\/get-help\/"/);
  assert.match(GET_HELP_V2_HTML, /window\.location\.replace\('\/get-help\/'\)/);
  assert.doesNotMatch(GET_HELP_V2_HTML, /<form\b/i);
  assert.doesNotMatch(GET_HELP_V2_HTML, /"@type"\s*:\s*"Offer"/);
  assert.doesNotMatch(GET_HELP_V2_HTML, /generate_lead|window\.LHI\.track\('Lead'/);
  assert.match(REDIRECTS_SRC, /^\/get-help\/index-v2\.html\s+\/get-help\/\s+301!$/m);
});

test('retired plan finder aliases redirect to the canonical Get Help intake', () => {
  assert.match(REDIRECTS_SRC, /^\/find-plans\s+\/get-help\/\s+301!$/m);
  assert.match(REDIRECTS_SRC, /^\/find-plans\/\s+\/get-help\/\s+301!$/m);
  assert.doesNotMatch(REDIRECTS_SRC, /^\/find-plans\/?\s+\/search-engine-from-zip\//m);
});

test('legacy campaign aliases land on current canonical articles', () => {
  assert.match(REDIRECTS_SRC, /^\/blog\/florida-aca-subsidy-most-people-miss\/?\s+\/blog\/aca-2026-subsidy-expiration-florida-impact\.html\s+301!$/m);
  assert.match(REDIRECTS_SRC, /^\/blog\/no-health-insurance-florida-er-cost\/?\s+\/blog\/er-visit-cost-lakeland-without-insurance-2026\.html\s+301!$/m);
  assert.doesNotMatch(REDIRECTS_SRC, /\/blog\/(?:florida-aca-subsidy-most-people-miss|no-health-insurance-florida-er-cost)\.html\s+301!/);
});

test('shared release invalidates stale asset caches and keeps desktop navigation on one row', () => {
  assert.match(SERVICE_WORKER_SRC, /const CACHE_NAME = 'lhi-20260816-coverage-options';/);
  assert.match(SITE_TEMPLATE_CSS, /header \.nav-links\s*\{[^}]*flex-wrap:\s*nowrap;/s);
});

test('get-help intent allowlist falls back safely', () => {
  const sandbox = {
    window: null,
    location: {
      pathname: '/get-help/',
      search: '',
      origin: 'https://lakelandhealthinsurance.com'
    },
    document: {
      referrer: '',
      addEventListener: () => {},
      getElementById: () => null,
      querySelectorAll: () => []
    },
    URL,
    URLSearchParams,
    String,
    Object,
    Date,
    btoa: (value) => Buffer.from(value).toString('base64')
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(GET_HELP_SRC, sandbox, { filename: 'get-help-intake.js' });

  assert.equal(sandbox.LHIGetHelpIntake.normalizeIntent('under-65'), 'under-65');
  assert.equal(sandbox.LHIGetHelpIntake.normalizeIntent('individual-family'), 'under-65');
  assert.equal(sandbox.LHIGetHelpIntake.normalizeIntent('under65'), 'under-65');
  assert.equal(sandbox.LHIGetHelpIntake.normalizeIntent('pre-medicare'), 'under-65');
  assert.equal(sandbox.LHIGetHelpIntake.normalizeIntent('retiring-before-65'), 'retiring-before-65');
  assert.equal(sandbox.LHIGetHelpIntake.normalizeIntent('early-retirement'), 'retiring-before-65');
  assert.equal(sandbox.LHIGetHelpIntake.normalizeIntent('losing-coverage'), 'lost-coverage');
  assert.equal(sandbox.LHIGetHelpIntake.normalizeIntent('provider-prescription-check'), 'provider-check');
  assert.equal(sandbox.LHIGetHelpIntake.normalizeIntent('local-answer'), 'not-sure');
  assert.equal(sandbox.LHIGetHelpIntake.normalizeIntent('medicare'), 'medicare');
  assert.equal(sandbox.LHIGetHelpIntake.normalizeIntent('provider-check'), 'provider-check');
  assert.equal(sandbox.LHIGetHelpIntake.normalizeIntent('<script>alert(1)</script>'), 'not-sure');
  for (const hostileKey of ['constructor', 'toString', '__proto__']) {
    assert.equal(sandbox.LHIGetHelpIntake.normalizeIntent(hostileKey), 'not-sure');
  }
  assert.ok(sandbox.LHIGetHelpIntake.intents['under-65']);
  assert.equal(sandbox.LHIGetHelpIntake.intents['under-65'].label, 'Individual and Family Coverage');
  assert.equal(sandbox.LHIGetHelpIntake.intents['under-65'].optionLabel, 'Health coverage for me or my family');
  assert.equal(sandbox.LHIGetHelpIntake.intents['not-sure'].optionLabel, 'I am not sure yet');
  assert.ok(sandbox.LHIGetHelpIntake.intents['retiring-before-65']);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.LHIGetHelpIntake.intents.medicare.optional)), [
    'medicare_timing',
    'primary_concern',
    'referral',
    'notes'
  ]);
  assert.match(sandbox.LHIGetHelpIntake.intents.medicare.intro, /Do not enter medication names, medical details, policy numbers, Medicare numbers, or Social Security numbers/);

  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.LHIGetHelpIntake.medicareSourceContext(new URLSearchParams(
    'intent=medicare&source_page_key=medicare&source_page_role=transaction&source_cta_key=start_review_hero'
  )))), {
    source_page_key: 'medicare',
    source_page_role: 'hub',
    source_cta_key: 'start_review_hero',
    content_cluster: 'lakeland_medicare_broker'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.LHIGetHelpIntake.medicareSourceContext(new URLSearchParams(
    'intent=medicare&source_page_key=moving_florida_medicare&source_page_role=hub&source_cta_key=request_move_review'
  )))), {
    source_page_key: 'moving_florida_medicare',
    source_page_role: 'education',
    source_cta_key: 'request_move_review',
    content_cluster: 'lakeland_medicare_broker'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.LHIGetHelpIntake.medicareSourceContext(new URLSearchParams(
    'intent=medicare&source_page_key=best_medicare_broker_lakeland_fl&source_page_role=transaction&source_cta_key=request_review_hero'
  )))), {
    source_page_key: 'best_medicare_broker_lakeland_fl',
    source_page_role: 'selection',
    source_cta_key: 'request_review_hero',
    content_cluster: 'lakeland_medicare_broker'
  });
  assert.equal(sandbox.LHIGetHelpIntake.medicareSourceContext(new URLSearchParams(
    'intent=medicare&source_page_key=best_medicare_broker_lakeland_fl&source_cta_key=unknown'
  )), null);
  for (const hostileKey of ['constructor', 'toString', '__proto__']) {
    assert.equal(sandbox.LHIGetHelpIntake.medicareSourceContext(new URLSearchParams(
      `intent=medicare&source_page_key=${hostileKey}&source_cta_key=request_review_hero`
    )), null);
    assert.equal(sandbox.LHIGetHelpIntake.medicareSourceContext(new URLSearchParams(
      `intent=medicare&source_page_key=best_medicare_broker_lakeland_fl&source_cta_key=${hostileKey}`
    )), null);
  }
  assert.equal(sandbox.LHIGetHelpIntake.approvedCampaignValue('medicare_review'), 'medicare_review');
  assert.equal(sandbox.LHIGetHelpIntake.approvedCampaignValue('jane@example.com'), '');
  assert.equal(sandbox.LHIGetHelpIntake.approvedCampaignValue('863-640-3102'), '');
  assert.equal(sandbox.LHIGetHelpIntake.approvedCampaignTerm('Health Insurance Lakeland'), 'health insurance lakeland');
  assert.equal(sandbox.LHIGetHelpIntake.approvedCampaignTerm('jane@example.com'), '');
  assert.equal(sandbox.LHIGetHelpIntake.approvedCampaignTerm('863-640-3102'), '');
});

test('Get Help stores only bounded Medicare attribution and approved campaign fields', () => {
  for (const field of [
    'source_page_key',
    'source_page_role',
    'source_cta_key',
    'content_cluster',
    'event_id',
    'server_received_at',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content'
  ]) {
    assert.match(GET_HELP_HTML, new RegExp(`name="${field}"`));
  }
  for (const removed of ['gclid', 'fbclid']) {
    assert.doesNotMatch(GET_HELP_HTML, new RegExp(`name="${removed}"`));
  }
  assert.match(GET_HELP_SRC, /setValue\('sourcePageInput', String\(window\.location\.pathname \|\| '\/'\)\.slice\(0, 160\)\);/);
  assert.doesNotMatch(GET_HELP_SRC, /window\.location\.pathname \+ window\.location\.search/);
  assert.match(GET_HELP_HTML, /id="optionalPrivacyNote" hidden>Do not enter medication names, medical details, policy or member numbers, Medicare numbers, Social Security numbers, or medical records in optional fields\./);
  assert.match(GET_HELP_SRC, /privacyNote\.hidden = intentKey !== 'medicare';/);
  assert.match(GET_HELP_SRC, /setValue\('utmTermInput', approvedCampaignTerm\(qs\.get\('utm_term'\)\)\);/);
});

test('shared attribution hydrates hero ZIP and lead forms with a bounded multi-word Google keyword', () => {
  const elements = {};
  const listeners = {};
  const heroForm = {
    elements,
    appendChild(input) { this.elements[input.name] = input; },
    addEventListener(type, handler) { listeners[type] = handler; }
  };
  const sandbox = loadFunnel({
    pathname: '/plans/',
    search: '?utm_source=google&utm_medium=cpc&utm_campaign=cid_24123358247&utm_term=Health+Insurance+Lakeland&utm_content=sitelink_plans',
    selectorMap: { 'form.hero-zip-form[action="/get-help/"]': [heroForm] }
  });

  assert.equal(heroForm.elements.utm_source.value, 'google');
  assert.equal(heroForm.elements.utm_medium.value, 'cpc');
  assert.equal(heroForm.elements.utm_campaign.value, 'cid_24123358247');
  assert.equal(heroForm.elements.utm_term.value, 'health insurance lakeland');
  assert.equal(heroForm.elements.utm_content.value, 'sitelink_plans');
  assert.equal(typeof listeners.submit, 'function');
  assert.equal(sandbox.LHI._t.approvedCampaignTerm('jane@example.com'), null);
  assert.equal(sandbox.LHI._t.approvedCampaignTerm('863-640-3102'), null);
});

test('homepage ZIP entry starts the generic get-help flow and prefills the canonical ZIP field', () => {
  assert.match(HOME_HTML, /<form class="hero-zip-form" action="\/get-help\/" method="GET"/);
  assert.match(HOME_HTML, /name="intent" value="not-sure"/);
  assert.match(HOME_HTML, /name="zip_code"[^>]*pattern="\[0-9\]\{5\}"[^>]*required/);
  assert.match(GET_HELP_SRC, /setValue\('zipCode', qsValue\(qs, 'zip_code'\)\);/);
});

test('get-help consent evidence is channel-specific and versioned', () => {
  for (const field of [
    'consent_request',
    'consent_call',
    'consent_sms',
    'consent_email',
    'consent_marketing_email',
    'consent_text_version',
    'consent_recorded_at',
    'consent_request_state',
    'consent_call_state',
    'consent_sms_state',
    'consent_email_state',
    'consent_marketing_email_state',
    'consent_withdrawal_state'
  ]) {
    assert.match(GET_HELP_HTML, new RegExp(`name="${field}"`));
  }
  assert.match(GET_HELP_SRC, /consentCallStateInput/);
  assert.match(GET_HELP_SRC, /consentSmsStateInput/);
  assert.match(GET_HELP_SRC, /consentEmailStateInput/);
});

test('estimator keeps sensitive estimate inputs out of lead forms, URLs, and analytics', () => {
  assert.doesNotMatch(ESTIMATOR_HTML, /id="leadCaptureForm"/);
  assert.doesNotMatch(ESTIMATOR_HTML, /[?&](?:age|income|household|zip|tobacco|fpl|subsidy|premium)=/);
  assert.doesNotMatch(ESTIMATOR_HTML, /gtag\(['"]event['"],\s*['"]subsidy_calculator_complete/);
  assert.match(ESTIMATOR_HTML, /href="\/get-help\/\?intent=aca"/);
  assert.match(ESTIMATOR_HTML, /Inputs stay in this browser/);
});
