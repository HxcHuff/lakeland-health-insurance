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
const GET_HELP_V2_HTML = readFileSync(resolve(__dirname, '../get-help/index-v2.html'), 'utf8');
const REDIRECTS_SRC = readFileSync(resolve(__dirname, '../_redirects'), 'utf8');
const ESTIMATOR_HTML = readFileSync(resolve(__dirname, '../aca-subsidy-estimator/index.html'), 'utf8');
const SERVICE_WORKER_SRC = readFileSync(resolve(__dirname, '../sw.js'), 'utf8');
const SITE_TEMPLATE_CSS = readFileSync(resolve(__dirname, '../css/site-template.css'), 'utf8');
const PAID_PLAN_REVIEW_HTML = readFileSync(resolve(__dirname, '../lp/aca/index.html'), 'utf8');

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
function loadFunnel({ pathname = '/', forms = [], fetchImpl, gtagImpl, isProd = false } = {}) {
  const dataLayer = [];
  const sessionStorage = makeSessionStorage();
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
    location: { pathname, search: '', href: 'http://localhost' + pathname, protocol: 'http:' },
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
    sessionStorage
  };
  sandbox.document.querySelectorAll = () => forms;
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
    },
    dispatchFormStart() {
      if (listeners.focusin) listeners.focusin({});
    }
  };
}

async function flushPromises(count = 3) {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
}

function loadAnalytics({ pathname = '/', telLabel = 'Call David' } = {}) {
  const listeners = {};
  const dataLayer = [];
  const appendedScripts = [];
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
    sessionStorage: makeSessionStorage(),
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
      head: { appendChild: (node) => { appendedScripts.push(node); } },
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
    appendedScripts,
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

test('analytics loads the first-party event bus before deferred third-party tags', () => {
  const { appendedScripts } = loadAnalytics();

  assert.equal(appendedScripts.length, 1);
  assert.match(appendedScripts[0].src, /^\/js\/funnel\.js\?v=/);
});

test('paid plan-review page presents general comparison before STM, TriTerm, and ACA', () => {
  assert.match(PAID_PLAN_REVIEW_HTML, /<h1>Compare health insurance plans around the care you actually use\.<\/h1>/);
  assert.match(PAID_PLAN_REVIEW_HTML, /name="coverage_interest"/);

  const compareIndex = PAID_PLAN_REVIEW_HTML.indexOf('value="Compare available options"');
  const shortTermIndex = PAID_PLAN_REVIEW_HTML.indexOf('value="Short-Term Medical"');
  const triTermIndex = PAID_PLAN_REVIEW_HTML.indexOf('value="TriTerm Medical"');
  const acaIndex = PAID_PLAN_REVIEW_HTML.indexOf('value="ACA Marketplace"');

  assert.ok(compareIndex > -1, 'general comparison choice exists');
  assert.ok(compareIndex < shortTermIndex, 'general comparison appears before Short-Term Medical');
  assert.ok(shortTermIndex < triTermIndex, 'Short-Term Medical appears before TriTerm Medical');
  assert.ok(triTermIndex < acaIndex, 'ACA remains a secondary choice');
  assert.doesNotMatch(PAID_PLAN_REVIEW_HTML, /ACA Marketplace plan review|<h1>Compare ACA/i);
});

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

test('tracking strips health-plan interest from analytics properties', () => {
  const { safeProps } = loadFunnel().LHI._t;
  const props = safeProps({
    coverage_interest: 'TriTerm Medical',
    content_name: 'first_party_lead'
  });

  assert.equal(props.coverage_interest, undefined);
  assert.equal(props.content_name, 'first_party_lead');
});

test('phone clicks fire canonical phone_call_click', () => {
  const { dataLayer, clickTel } = loadAnalytics({ telLabel: 'Call 863-640-3102' });

  clickTel();

  assert.equal(dataLayer.filter((entry) => entry.event === 'PhoneCallClick').length, 1, 'one GTM phone event fired');
  assert.equal(dataLayer.filter((entry) => entry.event === 'phone_call_click').length, 1, 'one canonical GA4 phone event fired');
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
  const leadEvents = w.dataLayer.filter((entry) => entry && entry.event === 'Lead');
  assert.equal(leadEvents.length, 1, 'one GTM Lead event fires at the delivery boundary');
  assert.equal(leadEvents[0].event_id, marker.event_id);
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
      zip_code: '33801',
      coverage_status: 'Uninsured',
      best_time_to_reach: 'Anytime during business hours',
      normalized_intent: 'aca',
      line_of_business: 'ACA',
      need_timing: 'Within 30 days',
      lead_priority: '',
      lead_priority_reason: ''
    }
  });
  const w = loadFunnel({
    pathname: '/tampa-health-insurance/',
    forms: [form],
    fetchImpl: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          event_id: 'server-event-id',
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
  assert.equal(payload.content_name, 'city_lead_form');
  assert.equal(payload['form-name'], 'tampa-health-insurance');
  assert.equal(payload.phone_number, '863-640-3102');
  assert.equal(payload.zip_code, '33801');

  const leadEvents = w.dataLayer.filter((entry) => entry && entry.event === 'Lead');
  assert.equal(leadEvents.length, 1, 'one GTM Lead event queued');
  const leadParams = JSON.parse(JSON.stringify(leadEvents[0]));
  assert.deepEqual(leadParams, {
    event: 'Lead',
    content_name: 'first_party_lead',
    step: 'submit',
    event_id: 'server-event-id',
    page_type: 'site',
    original_event_name: 'Lead',
    original_event_name: 'Lead'
  });
  assert.equal(leadParams.full_name, undefined);
  assert.equal(leadParams.email, undefined);
  assert.equal(leadParams.phone_number, undefined);
  assert.equal(form.elements.lead_priority.value, 'high');
  assert.equal(form.elements.lead_priority_reason.value, 'urgent_or_high_intent_with_contact_path');
  assert.ok(w.sessionStorage.getItem('lhi_lead_submitted'), 'thank-you marker set');
  assert.equal(JSON.parse(w.sessionStorage.getItem('lhi_lead_submitted')).event_id, 'server-event-id');
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
      return Promise.resolve({ ok: true });
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
  w.LHI.track('Lead', { content_name: 'get_help_lead_form' });
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

  w.LHI.track('Lead', { content_name: 'get_help_lead_form' });
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
  assert.match(SERVICE_WORKER_SRC, /const CACHE_NAME = 'lhi-20260807-conversion-review';/);
  assert.match(SITE_TEMPLATE_CSS, /header \.nav-links\s*\{[^}]*flex-wrap:\s*nowrap;/s);
});

test('get-help intent allowlist falls back safely', () => {
  const sandbox = {
    window: null,
    document: {
      addEventListener: () => {},
      getElementById: () => null,
      querySelectorAll: () => []
    },
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
  assert.ok(sandbox.LHIGetHelpIntake.intents['under-65']);
  assert.equal(sandbox.LHIGetHelpIntake.intents['under-65'].label, 'Individual and Family Coverage');
  assert.ok(sandbox.LHIGetHelpIntake.intents['retiring-before-65']);
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
