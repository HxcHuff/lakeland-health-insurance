import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import vm from 'node:vm';
import { buildWebsiteLeadPayload } from '../netlify/functions/lib/lead-bridge.js';

const ROOT = resolve(import.meta.dirname, '..');
const SUBMISSION_ID = 'abcdef0123456789abcdef01';

function loadWelcomeBackPopup() {
  const src = readFileSync(join(ROOT, 'js/welcome-back-popup.js'), 'utf8');
  const sandbox = {
    window: {
      __LHI_WELCOME_BACK_LOADED__: false,
      localStorage: {
        store: Object.create(null),
        getItem(key) { return this.store[key] ?? null; },
        setItem(key, value) { this.store[key] = String(value); }
      },
      location: { pathname: '/plans/', search: '', hostname: 'deploy-preview-123.netlify.app' },
      document: {
        readyState: 'complete',
        body: { classList: { contains() { return false; } } },
        documentElement: { style: { setProperty() {} } },
        addEventListener() {},
        getElementById() { return null; },
        querySelector() { return null; },
        createElement() { return { style: {}, appendChild() {}, setAttribute() {}, addEventListener() {} }; }
      },
      setTimeout(fn) { if (typeof fn === 'function') fn(); },
      clearTimeout() {},
      requestAnimationFrame(fn) { if (typeof fn === 'function') fn(); },
      requestIdleCallback(fn) { if (typeof fn === 'function') fn(); },
      addEventListener() {},
      fetch() { return Promise.resolve({ ok: true, json() { return Promise.resolve({ ok: true, forms: true, event_id: '11111111-2222-4333-a444-555555555555' }); } }); },
      dataLayer: []
    },
    document: null
  };
  sandbox.document = sandbox.window.document;
  vm.runInNewContext(src, sandbox, { filename: 'welcome-back-popup.js' });
  return sandbox.window;
}

test('visit counter treats 30+ idle minutes as a new visit', () => {
  const w = loadWelcomeBackPopup();
  const api = w.LHIWelcomeBackPopup;
  const t0 = Date.now();
  const first = api.touchVisitState(false);
  assert.equal(first.visitCount, 1);
  w.localStorage.setItem(api.STORAGE_KEY, JSON.stringify({
    visitCount: 1,
    lastActivityMs: t0 - (31 * 60 * 1000),
    suppressUntilMs: 0,
    shownThisVisit: false
  }));
  const second = api.touchVisitState(false);
  assert.equal(second.visitCount, 2);
  assert.equal(api.shouldOfferPopup(second, false), true);
});

test('excluded paths block popup eligibility', () => {
  const w = loadWelcomeBackPopup();
  const api = w.LHIWelcomeBackPopup;
  assert.equal(api.pathExcluded('/lp/medicare/'), true);
  assert.equal(api.pathExcluded('/get-help/'), true);
  assert.equal(api.pathExcluded('/privacy-policy.html'), true);
  assert.equal(api.pathExcluded('/plans/'), false);
});

test('preview wb=1 is ignored off Netlify preview hosts', () => {
  const w = loadWelcomeBackPopup();
  w.location.hostname = 'lakelandhealthinsurance.com';
  w.location.search = '?wb=1';
  assert.equal(w.LHIWelcomeBackPopup.forceShowRequested(), false);
  w.location.hostname = 'deploy-preview-123.netlify.app';
  assert.equal(w.LHIWelcomeBackPopup.forceShowRequested(), true);
});

test('returning visitor bridge payload accepts feedback without phone', () => {
  const lead = buildWebsiteLeadPayload({
    formName: 'returning-visitor-feedback',
    submissionId: SUBMISSION_ID,
    createdAt: '2026-10-18T12:00:00.000Z',
    filtered: {
      name: 'Pat',
      brought_back: 'Looking at Medicare again',
      help_with: 'Plan comparison',
      visit_count: '3',
      source_tag: 'returning-visitor-feedback',
      source_page: '/plans/'
    }
  });
  assert.ok(lead);
  assert.equal(lead.form_name, 'returning-visitor-feedback');
  assert.equal(lead.intent, 'returning_visitor_feedback');
  assert.match(String(lead.notes || ''), /Looking at Medicare again/);
});
