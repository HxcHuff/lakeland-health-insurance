import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const ANALYTICS_SRC = readFileSync(join(ROOT, 'js/analytics.js'), 'utf8');
const FUNNEL_PIN = '20261016-prd-analytics-suppress';

function makeSessionStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadAnalytics({
  hostname = 'lakelandhealthinsurance.com',
  pathname = '/lp/aca/',
  search = '',
  readyState = 'complete'
} = {}) {
  const dataLayer = [];
  const appendedScripts = [];
  const scheduledTimeouts = [];
  const origin = `https://${hostname}`;
  const sandbox = {
    __LHI_TEST: true,
    console: { info: () => {} },
    localStorage: makeSessionStorage(),
    sessionStorage: makeSessionStorage(),
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
    document: {
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
    },
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

test('production paid landing paths suppress deferred Google tags but keep the funnel bus', () => {
  for (const pathname of ['/lp/aca/', '/lp/medicare/', '/lp/gap/']) {
    const loaded = loadAnalytics({ pathname });
    assert.equal(loaded.sandbox.__LHI_SUPPRESS_GOOGLE_TAGS, true, pathname);
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
    assert.equal(
      loaded.dataLayer.some((entry) => entry && entry.event === 'gtm.js'),
      false,
      `${pathname} must not queue gtm.js`
    );
    assert.equal(
      loaded.dataLayer.some((entry) => entry && entry[0] === 'event' && entry[1] === 'page_view'),
      false,
      `${pathname} must not send GA4 page_view`
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
  assert.ok(
    loaded.dataLayer.some((entry) => entry && entry.event === 'gtm.js')
  );
});

test('?analytics_test=1 overrides paid-landing suppression for the current tab', () => {
  const loaded = loadAnalytics({
    pathname: '/lp/aca/',
    search: '?analytics_test=1'
  });
  assert.equal(loaded.sandbox.__LHI_SUPPRESS_GOOGLE_TAGS, false);
  loaded.runDeferredInit();
  assert.ok(
    loaded.appendedScripts.some((script) => script.src === 'https://www.googletagmanager.com/gtm.js?id=GTM-W6MZ7XT6')
  );
});

test('paid LP HTML keeps the prior analytics pin until a dedicated LP bump lands', () => {
  for (const rel of ['lp/aca/index.html', 'lp/medicare/index.html', 'lp/gap/index.html']) {
    const html = readFileSync(join(ROOT, rel), 'utf8');
    assert.match(html, /\/js\/analytics\.js\?v=20261015-v6merge2/, rel);
  }
});

test('shared release pins match the PR D analytics suppress bump', () => {
  assert.match(ANALYTICS_SRC, /\/js\/funnel\.js\?v=20261016-prd-analytics-suppress/);
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE_NAME = 'lhi-20261016-prd-analytics-suppress';/);
  const home = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(home, /\/js\/analytics\.js\?v=20261016-prd-analytics-suppress/);
});
