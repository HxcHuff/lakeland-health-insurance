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

/* Build a sandbox that mimics the browser globals funnel.js touches.
   __LHI_IS_PROD=false silences gtag/Supabase fire paths so loading
   the script has no side-effects beyond attaching window.LHI. */
function loadFunnel({ pathname = '/' } = {}) {
  const dataLayer = [];
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
    fetch: () => Promise.resolve({ ok: true }),
    setTimeout: () => 0,
    dataLayer
  };
  /* funnel.js IIFE call: (function(w,d){...})(window||this, document).
     We pass the sandbox itself as `window`, and sandbox.document as `document`. */
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(FUNNEL_SRC, sandbox, { filename: 'funnel.js' });
  return sandbox;
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
