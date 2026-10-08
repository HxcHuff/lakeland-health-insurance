import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SRC = readFileSync(join(ROOT, 'js/lead-first-touch.js'), 'utf8');
const ANALYTICS_SRC = readFileSync(join(ROOT, 'js/analytics.js'), 'utf8');

function makeStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    _dump() {
      return map;
    }
  };
}

function loadFirstTouch(options = {}) {
  const local = options.localStorage || makeStorage();
  const session = options.sessionStorage || makeStorage();
  const document = {
    referrer: options.referrer || '',
    createElement: () => ({})
  };
  const sandbox = {
    __LHI_TEST: true,
    document,
    window: {},
    location: {
      pathname: options.pathname || '/',
      search: options.search || '',
      href: 'https://lakelandhealthinsurance.com' + (options.pathname || '/') + (options.search || '')
    },
    localStorage: local,
    sessionStorage: session,
    URLSearchParams,
    URL,
    Date,
    JSON,
    Object,
    String,
    Number,
    Array,
    RegExp
  };
  sandbox.window = sandbox;
  sandbox.window.document = document;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'lead-first-touch.js' });
  return sandbox;
}

test('capture stores Google click IDs and click_id_type; never stores fbclid values', () => {
  const local = makeStorage();
  const ctx = loadFirstTouch({
    localStorage: local,
    pathname: '/lp/aca/',
    search: '?utm_source=Google&utm_medium=cpc&utm_campaign=cid_24123358247&gclid=SecretClickValue-001&fbclid=MetaSecret',
    referrer: 'https://www.google.com/search?q=test'
  });
  const touch = ctx.LHILeadFirstTouch.getFirstTouch();
  assert.equal(touch.landing_page, '/lp/aca/');
  assert.equal(touch.referrer, 'google.com');
  assert.equal(touch.utm_source, 'google');
  assert.equal(touch.utm_medium, 'cpc');
  assert.equal(touch.utm_campaign, 'cid_24123358247');
  assert.equal(touch.click_id_type, 'gclid');
  assert.equal(touch.gclid, 'SecretClickValue-001');
  assert.equal(touch.lead_channel, 'google_ads');
  assert.ok(touch.click_timestamp && Number.isFinite(Date.parse(touch.click_timestamp)));
  const stored = JSON.parse(local.getItem('lhi_first_touch'));
  assert.equal(stored.gclid, 'SecretClickValue-001');
  assert.equal(stored.fbclid, undefined);
  assert.equal(JSON.stringify(stored).includes('MetaSecret'), false);
});

test('invalid Google click IDs are dropped before storage', () => {
  const local = makeStorage();
  const ctx = loadFirstTouch({
    localStorage: local,
    search: '?gclid=jane@example.com&gbraid=' + 'x'.repeat(600)
  });
  const touch = ctx.LHILeadFirstTouch.getFirstTouch();
  assert.equal(touch.gclid, undefined);
  assert.equal(touch.gbraid, undefined);
  assert.equal(touch.click_id_type, 'none');
});

test('first-touch UTMs are not overwritten while still valid', () => {
  const local = makeStorage();
  const first = loadFirstTouch({
    localStorage: local,
    pathname: '/lp/medicare/',
    search: '?utm_source=google&utm_medium=cpc&gclid=FirstGclid-001',
    referrer: 'https://google.com/'
  });
  first.LHILeadFirstTouch.getFirstTouch();

  const second = loadFirstTouch({
    localStorage: local,
    pathname: '/get-help/',
    search: '?utm_source=facebook&utm_medium=social&fbclid=LaterClick',
    referrer: 'https://facebook.com/'
  });
  const touch = second.LHILeadFirstTouch.getFirstTouch();
  assert.equal(touch.landing_page, '/lp/medicare/');
  assert.equal(touch.utm_source, 'google');
  assert.equal(touch.utm_medium, 'cpc');
  assert.equal(touch.click_id_type, 'gclid');
  assert.equal(touch.gclid, 'FirstGclid-001');
});

test('newer Google click IDs refresh stored values and extend TTL', () => {
  const local = makeStorage();
  local.setItem('lhi_first_touch', JSON.stringify({
    expires_at: Date.now() + 86400000,
    landing_page: '/lp/medicare/',
    referrer: 'google.com',
    utm_source: 'google',
    utm_medium: 'cpc',
    click_id_type: 'gclid',
    gclid: 'OlderGclid-001',
    click_timestamp: '2026-01-01T12:00:00+00:00',
    lead_channel: 'google_ads'
  }));
  const before = Date.now();
  const ctx = loadFirstTouch({
    localStorage: local,
    pathname: '/get-help/',
    search: '?gclid=NewerGclid-002&gbraid=Gbraid-002',
    referrer: 'https://google.com/'
  });
  const touch = ctx.LHILeadFirstTouch.getFirstTouch();
  assert.equal(touch.gclid, 'NewerGclid-002');
  assert.equal(touch.gbraid, 'Gbraid-002');
  assert.equal(touch.utm_source, 'google');
  assert.ok(Number(touch.expires_at) > before + 86400000 * 0.5);
  assert.notEqual(touch.click_timestamp, '2026-01-01T12:00:00+00:00');
});

test('expired first-touch records are replaced on the next page view', () => {
  const local = makeStorage();
  local.setItem('lhi_first_touch', JSON.stringify({
    expires_at: Date.now() - 1000,
    landing_page: '/old/',
    referrer: 'example.com',
    utm_source: 'old',
    click_id_type: 'none',
    lead_channel: 'other'
  }));
  const ctx = loadFirstTouch({
    localStorage: local,
    pathname: '/medicare/',
    search: '?utm_source=chatgpt&gclid=FreshAfterExpiry-001',
    referrer: 'https://chatgpt.com/'
  });
  const touch = ctx.LHILeadFirstTouch.getFirstTouch();
  assert.equal(touch.landing_page, '/medicare/');
  assert.equal(touch.utm_source, 'chatgpt');
  assert.equal(touch.gclid, 'FreshAfterExpiry-001');
  assert.equal(touch.lead_channel, 'google_ads');
  assert.ok(Number(touch.expires_at) > Date.now());
});

test('lead_channel mapping covers google, facebook, chatgpt, direct, organic, and other', () => {
  const { deriveLeadChannel } = loadFirstTouch().LHILeadFirstTouch;
  assert.equal(deriveLeadChannel({ click_id_type: 'gbraid' }), 'google_ads');
  assert.equal(deriveLeadChannel({ utm_source: 'google', utm_medium: 'ppc' }), 'google_ads');
  assert.equal(deriveLeadChannel({ referrer: 'facebook.com', click_id_type: 'none' }), 'facebook');
  assert.equal(deriveLeadChannel({ click_id_type: 'fbclid' }), 'facebook');
  assert.equal(deriveLeadChannel({ utm_source: 'chatgpt' }), 'chatgpt');
  assert.equal(deriveLeadChannel({ referrer: 'openai.com' }), 'chatgpt');
  assert.equal(deriveLeadChannel({ referrer: 'google.com' }), 'google_organic');
  assert.equal(deriveLeadChannel({ referrer: '', utm_source: '', utm_medium: '', utm_campaign: '' }), 'direct');
  assert.equal(deriveLeadChannel({ referrer: 'bing.com', utm_source: 'bing' }), 'other');
});

test('applyToForm writes hidden first-touch and Google click ID fields', () => {
  const ctx = loadFirstTouch({
    pathname: '/tampa-health-insurance/',
    search: '?utm_source=google&utm_medium=cpc&utm_campaign=testcamp&gclid=HiddenValue-001'
  });
  ctx.LHILeadFirstTouch.getFirstTouch();
  const form = {
    elements: {
      lead_source: { type: 'select-one', value: 'Google search' },
      lead_medium: { value: '' },
      lead_campaign: { value: '' },
      landing_page: { value: '' },
      referrer: { value: '' },
      click_id_type: { value: '' },
      lead_channel: { value: '' },
      gclid: { value: '' },
      gbraid: { value: '' },
      wbraid: { value: '' },
      click_timestamp: { value: '' }
    },
    querySelector() {
      return null;
    }
  };
  ctx.LHILeadFirstTouch.applyToForm(form);
  assert.equal(form.elements.lead_source.value, 'Google search');
  assert.equal(form.elements.lead_medium.value, 'cpc');
  assert.equal(form.elements.lead_channel.value, 'google_ads');
  assert.equal(form.elements.click_id_type.value, 'gclid');
  assert.equal(form.elements.gclid.value, 'HiddenValue-001');
  assert.ok(form.elements.click_timestamp.value.length > 10);
});

const SITE_JS_DIR = join(ROOT, 'js');
const FORBIDDEN_GOOGLE_USER_DATA = /gtag\s*\(\s*['"]set['"]\s*,\s*['"]user_data['"]|user_\s*\+\s*['"]data['"]|LHIEnhancedConversions|ENHANCED_CONVERSIONS_ENABLED/i;

function listSiteJsFiles() {
  return readdirSync(SITE_JS_DIR)
    .filter((name) => name.endsWith('.js'))
    .map((name) => join(SITE_JS_DIR, name));
}

test('site JS must not call gtag user_data or ship enhanced-conversion helpers', () => {
  for (const file of listSiteJsFiles()) {
    const src = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      src,
      FORBIDDEN_GOOGLE_USER_DATA,
      `${file} must not contain gtag user_data or enhanced-conversion code`
    );
  }
  assert.doesNotMatch(ANALYTICS_SRC, /sha256_/i);
});

const LEAD_FORM_MARKERS = ['data-funnel-event="Lead"'];
const FIRST_TOUCH_FIELDS = [
  'lead_medium',
  'lead_campaign',
  'landing_page',
  'referrer',
  'click_id_type',
  'lead_channel',
  'gclid',
  'gbraid',
  'wbraid',
  'click_timestamp'
];

function walkHtml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'search-engine-from-zip', '.git'].includes(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkHtml(path, out);
    else if (name.endsWith('.html')) out.push(path);
  }
  return out;
}

test('every tracked lead form declares static first-touch and Google click hidden fields', () => {
  const missing = [];
  for (const file of walkHtml(ROOT)) {
    const html = readFileSync(file, 'utf8');
    if (!LEAD_FORM_MARKERS.some((marker) => html.includes(marker))) continue;
    const hasVisibleLeadSource = html.includes('<select id="lead_source" name="lead_source"');
    const required = hasVisibleLeadSource ? FIRST_TOUCH_FIELDS : ['lead_source', ...FIRST_TOUCH_FIELDS];
    for (const field of required) {
      if (!new RegExp(`name="${field}"`).test(html)) {
        missing.push(`${file.replace(ROOT + '/', '')} missing ${field}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
