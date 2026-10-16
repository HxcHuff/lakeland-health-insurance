import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const ANALYTICS_SRC = readFileSync(join(ROOT, 'js/analytics.js'), 'utf8');
const FUNNEL_SRC = readFileSync(join(ROOT, 'js/funnel.js'), 'utf8');
const FUNNEL_PIN = '20261016-prd-conversion-d';
const ANALYTICS_PIN = '20261016-prd-conversion-d';

function makeSessionStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function makeCookieJar(initial = '') {
  let cookie = initial;
  return {
    get cookie() { return cookie; },
    set cookie(value) { cookie = String(value); }
  };
}

function loadAnalytics({
  hostname = 'lakelandhealthinsurance.com',
  pathname = '/lp/aca/',
  search = '',
  readyState = 'complete',
  userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  webdriver = false,
  referrer = '',
  localStorageInitial = {},
  cookieInitial = ''
} = {}) {
  const dataLayer = [];
  const appendedScripts = [];
  const scheduledTimeouts = [];
  const origin = `https://${hostname}`;
  const cookieJar = makeCookieJar(cookieInitial);
  const sandbox = {
    __LHI_TEST: true,
    console: { info: () => {} },
    localStorage: makeSessionStorage(localStorageInitial),
    sessionStorage: makeSessionStorage(),
    navigator: { userAgent, webdriver },
    dataLayer,
    location: {
      hostname,
      pathname,
      search,
      href: origin + pathname + search,
      origin,
      protocol: 'https:'
    },
    crypto: globalThis.crypto,
    URL: globalThis.URL,
    URLSearchParams: globalThis.URLSearchParams,
    document: Object.assign(cookieJar, {
      referrer,
      addEventListener() {},
      querySelectorAll() { return []; },
      querySelector(selector) {
        if (selector === 'form[data-funnel-track], form[data-funnel-step]') return null;
        if (selector === 'script[src^="/js/funnel.js"]') return null;
        return null;
      },
      createElement(tagName) {
        if (tagName === 'script') return { async: false, src: '', onload: null, onerror: null };
        return { async: false, src: '' };
      },
      head: {
        appendChild(node) {
          appendedScripts.push(node);
          if (node && node.src && node.src.indexOf('/js/lead-first-touch.js') !== -1) {
            sandbox.LHILeadFirstTouch = { captureIfNeeded: () => ({}), applyToForm: () => {} };
            if (typeof node.onload === 'function') node.onload();
          }
        }
      },
      readyState,
      title: 'Paid landing test'
    }),
    window: null,
    Date,
    setTimeout(callback, delay) {
      scheduledTimeouts.push({ callback, delay });
      return scheduledTimeouts.length;
    },
    requestIdleCallback(callback, options) {
      scheduledTimeouts.push({ callback, delay: options?.timeout ?? 1 });
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
    appendedScripts,
    runDeferredInit() {
      while (scheduledTimeouts.length) scheduledTimeouts.shift().callback();
    }
  };
}

function attachFunnelFormData(sandbox) {
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
  sandbox.FormData = TestFormData;
}

function loadFunnelInSandbox(sandbox, { pathname = '/blog/test.html', forms = [] } = {}) {
  sandbox.LHILeadFirstTouch = sandbox.LHILeadFirstTouch || {
    captureIfNeeded: () => ({}),
    applyToForm: () => {}
  };
  sandbox.location.pathname = pathname;
  sandbox.location.href = sandbox.location.origin + pathname + (sandbox.location.search || '');
  sandbox.document.querySelectorAll = (selector) => {
    if (selector === 'form[data-funnel-track], form[data-funnel-step]') return forms;
    if (selector === '[data-funnel-booking], a[href*="calendly.com"]') return [];
    if (selector === 'a[href^="tel:"]') return [];
    return [];
  };
  attachFunnelFormData(sandbox);
  vm.runInContext(FUNNEL_SRC, sandbox, { filename: 'funnel.js' });
}

function makeLeadForm(fields = {}) {
  const listeners = {};
  const elements = Object.fromEntries(Object.keys(fields).map((key) => [key, { value: fields[key] }]));
  return {
    _fields: fields,
    elements,
    getAttribute(name) {
      if (name === 'data-funnel-event') return 'Lead';
      if (name === 'data-funnel-name') return 'test_lead';
      if (name === 'action') return '/thanks.html';
      return null;
    },
    hasAttribute(name) { return name === 'data-funnel-track'; },
    addEventListener(type, cb) {
      listeners[type] = cb;
    },
    appendChild() {},
    querySelector(sel) {
      if (sel === 'input[name="normalized_intent"]') return elements.normalized_intent || null;
      return null;
    },
    dispatchSubmit() {
      listeners.submit({
        preventDefault() {},
        stopImmediatePropagation() {}
      });
    }
  };
}

test('production paid landing paths suppress deferred Google tags but keep the funnel bus', () => {
  for (const pathname of ['/lp/aca/', '/lp/medicare/', '/lp/gap/']) {
    const loaded = loadAnalytics({ pathname });
    assert.equal(loaded.sandbox.__LHI_SUPPRESS_GOOGLE_TAGS, true, pathname);
    assert.equal(loaded.sandbox.__LHI_SUPPRESS.reason, 'paid-landing');
    assert.ok(
      loaded.appendedScripts.some((script) => script.src === `/js/funnel.js?v=${FUNNEL_PIN}`),
      `${pathname} still requests funnel.js`
    );
    loaded.runDeferredInit();
    assert.equal(
      loaded.appendedScripts.some((script) => String(script.src || '').includes('googletagmanager.com')),
      false,
      `${pathname} must not request GTM/gtag`
    );
  }
});

test('non-LP production routes still initialize deferred Google tags', () => {
  const loaded = loadAnalytics({ pathname: '/medicare/' });
  assert.equal(loaded.sandbox.__LHI_SUPPRESS_GOOGLE_TAGS, false);
  loaded.runDeferredInit();
  assert.ok(
    loaded.appendedScripts.some((script) => script.src === 'https://www.googletagmanager.com/gtm.js?id=GTM-W6MZ7XT6')
  );
});

test('?analytics_test=1 on paid LP loads GTM with internal-traffic suppression state', () => {
  const loaded = loadAnalytics({
    pathname: '/lp/aca/',
    search: '?analytics_test=1'
  });
  assert.equal(loaded.sandbox.__LHI_SUPPRESS_GOOGLE_TAGS, false);
  assert.equal(loaded.sandbox.__LHI_SUPPRESS.reason, 'internal-traffic');
  assert.equal(loaded.sandbox.__LHI_SUPPRESS.suppressed, true);
  loaded.runDeferredInit();
  assert.ok(
    loaded.appendedScripts.some((script) => script.src === 'https://www.googletagmanager.com/gtm.js?id=GTM-W6MZ7XT6')
  );
});

test('?internal=1 suppresses Google tags and persists via localStorage and cookie', () => {
  const loaded = loadAnalytics({
    pathname: '/medicare/',
    search: '?internal=1'
  });
  assert.equal(loaded.sandbox.__LHI_SUPPRESS.reason, 'internal-flag');
  assert.equal(loaded.sandbox.localStorage.getItem('lhi_internal'), '1');
  assert.match(loaded.sandbox.document.cookie, /lhi_internal=1/);
  loaded.runDeferredInit();
  assert.equal(
    loaded.appendedScripts.some((script) => String(script.src || '').includes('googletagmanager.com')),
    false
  );

  const persisted = loadAnalytics({
    pathname: '/get-help/',
    search: '',
    localStorageInitial: { lhi_internal: '1' }
  });
  assert.equal(persisted.sandbox.__LHI_SUPPRESS.reason, 'internal-flag');
});

test('?internal=0 clears persisted internal flag', () => {
  const loaded = loadAnalytics({
    pathname: '/medicare/',
    search: '?internal=0',
    localStorageInitial: { lhi_internal: '1' },
    cookieInitial: 'lhi_internal=1'
  });
  assert.equal(loaded.sandbox.localStorage.getItem('lhi_internal'), null);
  assert.doesNotMatch(String(loaded.sandbox.document.cookie), /lhi_internal=1/);
  assert.equal(loaded.sandbox.__LHI_SUPPRESS.suppressed, false);
});

test('bot user agents and webdriver receive full measurement suppression', () => {
  const botLoaded = loadAnalytics({
    pathname: '/medicare/',
    userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
  });
  assert.equal(botLoaded.sandbox.__LHI_SUPPRESS.reason, 'bot-user-agent');

  const webdriverLoaded = loadAnalytics({
    pathname: '/medicare/',
    webdriver: true
  });
  assert.equal(webdriverLoaded.sandbox.__LHI_SUPPRESS.reason, 'webdriver');
});

test('blog page view does not push Lead or generate_lead to dataLayer', () => {
  const loaded = loadAnalytics({ pathname: '/blog/aep-2026-polk-county-checklist.html/' });
  loadFunnelInSandbox(loaded.sandbox, { pathname: '/blog/aep-2026-polk-county-checklist.html/' });
  loaded.sandbox.LHI.track('PageView', { page_type: 'blog' });
  assert.equal(
    loaded.dataLayer.some((entry) => entry && (entry.event === 'Lead' || entry.event === 'generate_lead')),
    false
  );
});

test('current-client-review accepted submit emits ClientServiceRequest not Lead', async () => {
  const eventId = '123e4567-e89b-42d3-a456-426614174000';
  const loaded = loadAnalytics({ pathname: '/about/' });
  loaded.sandbox.fetch = () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ ok: true, forms: true, event_id: eventId })
  });
  const form = makeLeadForm({ normalized_intent: 'current-client-review' });
  loadFunnelInSandbox(loaded.sandbox, { pathname: '/get-help/', forms: [form] });
  form.dispatchSubmit();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    loaded.dataLayer.some((entry) => entry && entry.event === 'Lead'),
    false
  );
  assert.ok(
    loaded.dataLayer.some((entry) => entry && entry.event === 'ClientServiceRequest'),
    'ClientServiceRequest pushed to dataLayer'
  );
  assert.equal(loaded.sandbox.sessionStorage.getItem('lhi_lead_submitted'), null);
});

test('internal-traffic sessions block Lead track but allow GTM load', async () => {
  const eventId = '223e4567-e89b-42d3-a456-426614174001';
  const loaded = loadAnalytics({
    pathname: '/medicare/',
    search: '?gtm_debug=foo'
  });
  loaded.runDeferredInit();
  loaded.sandbox.fetch = () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ ok: true, forms: true, event_id: eventId })
  });
  const form = makeLeadForm({ normalized_intent: 'medicare' });
  loadFunnelInSandbox(loaded.sandbox, { pathname: '/get-help/', forms: [form] });
  form.dispatchSubmit();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    loaded.dataLayer.some((entry) => entry && entry.event === 'Lead'),
    false
  );
});

test('QR thank-you route is not a conversion receipt page', () => {
  const loaded = loadAnalytics({ pathname: '/thank-you/' });
  loadFunnelInSandbox(loaded.sandbox, { pathname: '/thank-you/' });
  assert.notEqual(loaded.sandbox.LHI.pageType(), 'conversion');
  assert.equal(loaded.sandbox.__LHI_THANKS_LEAD_MARKER, undefined);
  assert.equal(
    loaded.dataLayer.some((entry) => entry && entry.event === 'LeadReceiptView'),
    false
  );
});

test('paid LP HTML keeps the prior analytics pin until a dedicated LP bump lands', () => {
  for (const rel of ['lp/aca/index.html', 'lp/medicare/index.html', 'lp/gap/index.html']) {
    const html = readFileSync(join(ROOT, rel), 'utf8');
    assert.match(html, /\/js\/analytics\.js\?v=20261015-v6merge2/, rel);
  }
});

test('shared release pins match the PR D conversion-counting bump', () => {
  assert.match(ANALYTICS_SRC, new RegExp(`/js/funnel\\.js\\?v=${FUNNEL_PIN}`));
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE_NAME = 'lhi-20261016-prd-conversion-d';/);
  const home = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(home, new RegExp(`/js/analytics\\.js\\?v=${ANALYTICS_PIN}`));
});
