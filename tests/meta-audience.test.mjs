import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const ANALYTICS_SRC = readFileSync(join(ROOT, 'js/analytics.js'), 'utf8');
const loaderMatch = ANALYTICS_SRC.match(/\/\* LHI_META_AUDIENCE_START \*\/([\s\S]*?)\/\* LHI_META_AUDIENCE_END \*\//);
assert.ok(loaderMatch, 'shared analytics asset contains the Meta audience loader');
const LOADER_SRC = loaderMatch[1];
const PIXEL_ID = '1480756087079484';
const ELIGIBLE_MARKER = '<meta name="meta-audience-eligible" content="pageview">';
const ANALYTICS_VERSION = '/js/analytics.js?v=20261017-meta-conversion-events-v1';
const CSS_VERSION = '/css/site-template.css?v=20261017-meta-conversion-events-v1';
const CONSENT_KEY = 'lhi_meta_audience_consent';
const ELIGIBLE_PAGES = [
  ['index.html', '/'],
  ['get-help/index.html', '/get-help/'],
  ['quote/index.html', '/quote/'],
  ['medicare/index.html', '/medicare/'],
  ['medicare-broker-lakeland-fl/index.html', '/medicare-broker-lakeland-fl/'],
  ['aca-health-insurance-lakeland-fl/index.html', '/aca-health-insurance-lakeland-fl/'],
  ['medicare-2027-check/index.html', '/medicare-2027-check/'],
  ['plans/index.html', '/plans/'],
  ['thanks.html', '/thanks.html'],
  ['blog/orlando-health-watson-clinic-2027-plan.html', '/blog/orlando-health-watson-clinic-2027-plan.html'],
  ['blog/orlando-health-watson-clinic-insurance-2026.html', '/blog/orlando-health-watson-clinic-insurance-2026.html']
];
const FORM_BEARING_ELIGIBLE_FILES = new Set([
  'index.html',
  'get-help/index.html',
  'medicare/index.html',
  'plans/index.html',
  'aca-health-insurance-lakeland-fl/index.html',
  'quote/index.html',
  'carriers/index.html',
  'medicare-broker-lakeland-fl/index.html',
  'medicare-2027-check/index.html',
  'blog/orlando-health-watson-clinic-2027-plan.html',
  'blog/orlando-health-watson-clinic-insurance-2026.html'
]);
const PROMPT_SUPPRESSED_PATHS = [
  '/lp/aca/',
  '/lp/aca.html',
  '/lp/medicare/',
  '/lp/medicare.html',
  '/lp/gap/',
  '/lp/gap.html',
  '/lp/campaign-regression'
];

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function makeNode(tagName, nodesById) {
  const listeners = new Map();
  const attributes = new Map();
  const node = {
    tagName: String(tagName).toUpperCase(),
    children: [],
    parentNode: null,
    hidden: true,
    textContent: '',
    className: '',
    async: false,
    src: '',
    type: '',
    href: '',
    appendChild(child) {
      child.parentNode = node;
      node.children.push(child);
      return child;
    },
    setAttribute(name, value) { attributes.set(String(name), String(value)); },
    getAttribute(name) { return attributes.get(String(name)) ?? null; },
    addEventListener(type, handler) { listeners.set(type, handler); },
    click() { listeners.get('click')?.(); }
  };
  let id = '';
  Object.defineProperty(node, 'id', {
    get() { return id; },
    set(value) {
      if (id) delete nodesById[id];
      id = String(value || '');
      if (id) nodesById[id] = node;
    }
  });
  return node;
}

function installCookieJar(document, initial = '') {
  let values = [];
  for (const part of String(initial).split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const equals = trimmed.indexOf('=');
    if (equals > 0) values.push([trimmed.slice(0, equals), trimmed.slice(equals + 1)]);
  }
  Object.defineProperty(document, 'cookie', {
    get() {
      return values.map(([name, value]) => `${name}=${value}`).join('; ');
    },
    set(value) {
      const parts = String(value).split(';').map((part) => part.trim());
      const equals = parts[0].indexOf('=');
      if (equals <= 0) return;
      const name = parts[0].slice(0, equals);
      const cookieValue = parts[0].slice(equals + 1);
      values = values.filter(([existingName]) => existingName !== name);
      if (!parts.some((part) => /^Max-Age=0$/i.test(part))) values.push([name, cookieValue]);
    }
  });
}

function loadMetaAudience({
  hostname = 'lakelandhealthinsurance.com',
  pathname = '/get-help/',
  search = '',
  hash = '',
  marker = true,
  referrer = '',
  globalPrivacyControl = false,
  doNotTrack = '0',
  storage = makeStorage({ [CONSENT_KEY]: 'granted' }),
  cookie = `${CONSENT_KEY}=granted`,
  controls = false,
  preexistingFbq = false,
  trapFormAccess = false,
  noticeTopMarker = false,
  mobileLayout = false
} = {}) {
  const scripts = [];
  const controlNodes = {};
  const accessedSelectors = [];
  const head = makeNode('head', controlNodes);
  const body = makeNode('body', controlNodes);
  const originalHeadAppendChild = head.appendChild;
  head.appendChild = function (node) {
    originalHeadAppendChild.call(head, node);
    if (node.tagName === 'SCRIPT') scripts.push(node);
    return node;
  };
  const document = {
    referrer,
    head,
    body,
    createElement(tagName) { return makeNode(tagName, controlNodes); },
    createTextNode(text) {
      const node = makeNode('#text', controlNodes);
      node.textContent = String(text);
      return node;
    },
    querySelector(selector) {
      accessedSelectors.push(selector);
      return marker && selector === 'meta[name="meta-audience-eligible"][content="pageview"]' ? {} : null;
    },
    getElementById(id) { return controlNodes[id] || null; }
  };
  const documentElement = makeNode('html', controlNodes);
  document.documentElement = documentElement;
  if (noticeTopMarker) documentElement.setAttribute('data-lhi-meta-notice-top', '1');
  if (controls) {
    const prompt = makeNode('div', controlNodes);
    if (controls !== 'privacy') {
      prompt.id = 'metaAudienceConsentPrompt';
      prompt.className = 'meta-audience-notice';
    }
    body.appendChild(prompt);
    const controlIds = controls === 'privacy'
      ? [
          ['metaAudienceOptOut', 'button'],
          ['metaAudienceOptIn', 'button'],
          ['metaAudiencePreferenceStatus', 'p']
        ]
      : [
          ['metaAudienceOptOut', 'button'],
          ['metaAudienceNoticeOk', 'button']
        ];
    for (const [id, tagName] of controlIds) {
      const node = makeNode(tagName, controlNodes);
      node.id = id;
      prompt.appendChild(node);
    }
  }
  if (trapFormAccess) {
    Object.defineProperty(document, 'forms', {
      get() { throw new Error('loader accessed document.forms'); }
    });
  }
  installCookieJar(document, cookie);
  const protocol = hostname === 'localhost' ? 'http:' : 'https:';
  const origin = `${protocol}//${hostname}`;
  const location = {
    hostname,
    pathname,
    search,
    hash,
    protocol,
    origin,
    href: `${origin}${pathname}${search || ''}${hash || ''}`
  };
  const sandbox = {
    URL,
    URLSearchParams,
    JSON,
    Date,
    encodeURIComponent,
    decodeURIComponent,
    document,
    localStorage: storage,
    sessionStorage: makeStorage(),
    location,
    history: {
      state: null,
      replaceState(state, _title, url) {
        const parsed = new URL(String(url || ''), origin);
        location.pathname = parsed.pathname;
        location.search = parsed.search;
        location.hash = parsed.hash;
        location.href = `${parsed.origin}${parsed.pathname}`;
        this.state = state;
      }
    },
    navigator: { globalPrivacyControl, doNotTrack },
    matchMedia(query) {
      return {
        matches: mobileLayout && String(query).includes('max-width: 900px'),
        media: String(query),
        addListener() {},
        removeListener() {}
      };
    },
    window: null
  };
  sandbox.window = sandbox;
  if (preexistingFbq) {
    sandbox.fbq = function () {};
    sandbox._fbq = sandbox.fbq;
  }
  vm.createContext(sandbox);
  vm.runInContext(LOADER_SRC, sandbox, { filename: 'meta-audience.js' });
  return { sandbox, scripts, controls: controlNodes, document, accessedSelectors };
}

function queuedCalls(sandbox) {
  return Array.from(sandbox.fbq?.queue || [], (args) => Array.from(args));
}

const EXPECTED_CALLS = [
  ['consent', 'grant'],
  ['set', 'autoConfig', false, PIXEL_ID],
  ['init', PIXEL_ID],
  ['trackSingle', PIXEL_ID, 'PageView']
];

function htmlFiles(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (['.git', '.claude', 'node_modules', 'search-engine-from-zip', 'output', 'audit', 'netlify', 'tests', 'scripts', '.ai-worker-local'].includes(name)) continue;
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) htmlFiles(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

test('all 10 reviewed landing routes queue one isolated standard PageView with no custom data', () => {
  assert.equal(ELIGIBLE_PAGES.length, 10);
  for (const [, pathname] of ELIGIBLE_PAGES) {
    const { sandbox, scripts, controls } = loadMetaAudience({ pathname });
    assert.equal(scripts.length, 1, pathname);
    assert.equal(scripts[0].src, 'https://connect.facebook.net/en_US/fbevents.js', pathname);
    assert.deepEqual(queuedCalls(sandbox), EXPECTED_CALLS, pathname);
    assert.deepEqual(queuedCalls(sandbox).map((call) => call.length), [2, 4, 2, 3], pathname);
    assert.equal(sandbox.fbq.disablePushState, true, pathname);
    assert.equal(sandbox.__LHI_META_AUDIENCE_STATUS__.state, 'queued', pathname);
    assert.equal(sandbox.__LHI_META_AUDIENCE_STATUS__.page_url, `https://lakelandhealthinsurance.com${pathname}`, pathname);
    assert.equal(sandbox.location.search, '', pathname);
    assert.equal(sandbox.location.hash, '', pathname);
    assert.doesNotMatch(sandbox.location.href, /[?#]/, pathname);
    assert.equal(controls.metaAudienceConsentPrompt, undefined, pathname);
    assert.doesNotMatch(JSON.stringify(queuedCalls(sandbox)), /Lead|Contact|Schedule|trackCustom|full_name|email|phone|zip|income/i, pathname);
  }
});

test('loader initializes at most once even if evaluated twice', () => {
  const { sandbox, scripts } = loadMetaAudience();
  vm.runInContext(LOADER_SRC, sandbox, { filename: 'meta-audience.js' });
  assert.equal(scripts.length, 1);
  assert.equal(queuedCalls(sandbox).length, 4);
  assert.equal(sandbox.__LHI_META_AUDIENCE_STATUS__.reason, 'already-initialized');
});

test('ineligible, unmarked, and non-production pages never create fbq or request Meta', () => {
  const scenarios = [
    { pathname: '/about/', marker: true },
    { pathname: '/blog/', marker: true },
    { pathname: '/privacy-policy.html', marker: true },
    { pathname: '/provider-prescription-check/', marker: true },
    { pathname: '/losing-medicaid-florida/', marker: true },
    { pathname: '/blog/mental-health-awareness-month-therapy-benefit-lakeland-2026.html', marker: true },
    { pathname: '/unreviewed/', marker: true },
    { pathname: '/get-help/', marker: false },
    { hostname: 'localhost', pathname: '/get-help/', marker: true },
    { hostname: 'www.lakelandhealthinsurance.com', pathname: '/get-help/', marker: true }
  ];
  for (const scenario of scenarios) {
    const { sandbox, scripts } = loadMetaAudience(scenario);
    assert.equal(scripts.length, 0);
    assert.equal(sandbox.fbq, undefined);
  }
});

test('query, fragment, and referrer gates reject uncertain or user-like data', () => {
  const rejected = [
    { search: '?email=jane%40example.com' },
    { search: '?utm_term=jane%40example.com' },
    { search: '?utm_content=863-555-1212' },
    { search: '?utm_content=33801' },
    { search: '?utm_content=medicare-tips' },
    { search: '?intent=jane%40example.com' },
    { search: '?zip_code=863-555-1212' },
    { search: '?fbclid=IwAR8635551212SensitiveValue' },
    { search: '?utm_source=meta&utm_source=facebook' },
    { search: '?analytics_test=1' },
    { search: '?utm_source=%E0%A4%A' },
    { hash: '#jane@example.com' },
    { referrer: 'https://lakelandhealthinsurance.com/get-help/?zip_code=33801' },
    { referrer: 'https://lakelandhealthinsurance.com/privacy-policy.html' },
    { referrer: 'https://example.com/private/path' },
    { referrer: 'https://oncology.example/' }
  ];
  for (const scenario of rejected) {
    const { sandbox, scripts } = loadMetaAudience(scenario);
    assert.equal(scripts.length, 0, JSON.stringify(scenario));
    assert.equal(sandbox.fbq, undefined, JSON.stringify(scenario));
  }

  const allowed = loadMetaAudience({
    pathname: '/get-help/',
    search: '?utm_source=facebook&utm_medium=paid_social&utm_campaign=lhi_site_retargeting_fps&utm_content=blog_education_v1&fbclid=IwY2xjawNeutralOpaqueClickIdentifier123',
    referrer: 'https://www.google.com/'
  });
  assert.equal(allowed.scripts.length, 1);

  const landingQuery = loadMetaAudience({
    pathname: '/get-help/',
    search: '?intent=medicare&zip_code=33805&gclid=OpaqueGoogleClickIdentifier123&utm_term=health-insurance&source_page_key=medicare&source_cta_key=start_review_hero&utm_campaign=florida_brand'
  });
  assert.equal(landingQuery.scripts.length, 1);

  const campaignSlug = loadMetaAudience({
    pathname: '/quote/',
    search: '?utm_campaign=cid_12345678'
  });
  assert.equal(campaignSlug.scripts.length, 1);

  const organicPost = loadMetaAudience({
    pathname: '/get-help/',
    search: '?utm_source=facebook&utm_medium=social&utm_campaign=Retiree+Spouse+Tips&utm_content=post_topic_v1'
  });
  assert.equal(organicPost.scripts.length, 1);
  assert.deepEqual(queuedCalls(organicPost.sandbox), EXPECTED_CALLS);
  assert.equal(organicPost.sandbox.location.search, '');
  assert.equal(organicPost.sandbox.location.hash, '');
  assert.equal(organicPost.sandbox.location.href, 'https://lakelandhealthinsurance.com/get-help/');
  assert.equal(organicPost.sandbox.__LHI_META_AUDIENCE_STATUS__.page_url, 'https://lakelandhealthinsurance.com/get-help/');
  assert.match(organicPost.document.cookie, /lhi_attr=/);
  assert.match(decodeURIComponent(organicPost.document.cookie), /retireespousetips/);

  const paidSocial = loadMetaAudience({
    pathname: '/get-help/',
    search: '?utm_source=facebook&utm_medium=paid_social&utm_campaign=lhi_site_retargeting_fps&utm_content=new_creative_v2'
  });
  assert.equal(paidSocial.scripts.length, 1);
  assert.deepEqual(queuedCalls(paidSocial.sandbox), EXPECTED_CALLS);
  assert.equal(paidSocial.sandbox.location.search, '');
  assert.equal(paidSocial.sandbox.__LHI_META_AUDIENCE_STATUS__.page_url, 'https://lakelandhealthinsurance.com/get-help/');

  const brand = loadMetaAudience({
    pathname: '/get-help/',
    search: '?utm_source=facebook&utm_medium=paid_social&utm_campaign=florida_brand&utm_content=home_brand_v1'
  });
  assert.equal(brand.scripts.length, 1);
  assert.equal(brand.sandbox.location.search, '');
});

test('health slugs in raw campaign or term values skip the Pixel', () => {
  for (const search of [
    '?utm_campaign=diabetes-medicare',
    '?utm_campaign=cancer',
    '?utm_campaign=medicaid-loss',
    '?utm_campaign=Diabetes+Medicare',
    '?utm_campaign=glp1',
    '?utm_term=ozempic',
    '?utm_content=wegovy-ad'
  ]) {
    const { sandbox, scripts } = loadMetaAudience({ search });
    assert.equal(scripts.length, 0, search);
    assert.equal(sandbox.fbq, undefined, search);
    assert.equal(sandbox.__LHI_META_AUDIENCE_STATUS__.reason, 'query-rejected', search);
    assert.equal(sandbox.location.search, search, search);
  }
});

test('heartland, heart-of-florida, and disbursement still load the Pixel', () => {
  for (const search of [
    '?utm_source=facebook&utm_medium=social&utm_campaign=heartland',
    '?utm_source=facebook&utm_medium=social&utm_campaign=heart-of-florida',
    '?utm_source=facebook&utm_medium=social&utm_campaign=disbursement'
  ]) {
    const { sandbox, scripts } = loadMetaAudience({ search });
    assert.equal(scripts.length, 1, search);
    assert.equal(sandbox.location.search, '');
    assert.equal(sandbox.__LHI_META_AUDIENCE_STATUS__.state, 'queued', search);
  }

  for (const search of [
    '?utm_campaign=heart-disease',
    '?utm_campaign=heart_attack',
    '?utm_campaign=heart-failure',
    '?utm_content=disabled',
    '?utm_term=disability'
  ]) {
    const { sandbox, scripts } = loadMetaAudience({ search });
    assert.equal(scripts.length, 0, search);
    assert.equal(sandbox.__LHI_META_AUDIENCE_STATUS__.reason, 'query-rejected', search);
  }
});

test('name-like utm_content does not send the raw query to the Pixel', () => {
  const named = loadMetaAudience({
    pathname: '/quote/',
    search: '?utm_source=facebook&utm_medium=social&utm_campaign=retiree-spouse-tips&utm_content=Jane+Smith'
  });
  assert.equal(named.scripts.length, 1);
  assert.deepEqual(queuedCalls(named.sandbox), EXPECTED_CALLS);
  assert.equal(named.sandbox.location.search, '');
  assert.equal(named.sandbox.location.hash, '');
  assert.doesNotMatch(named.sandbox.location.href, /[?#]/);
  assert.doesNotMatch(named.sandbox.location.href, /Jane|Smith|utm_/i);
  assert.equal(named.sandbox.__LHI_META_AUDIENCE_STATUS__.page_url, 'https://lakelandhealthinsurance.com/quote/');
  assert.match(decodeURIComponent(named.document.cookie), /janesmith/);
});

test('only reviewed same-site referrers pass without query or fragment data', () => {
  for (const [, pathname] of ELIGIBLE_PAGES) {
    const result = loadMetaAudience({
      pathname: '/get-help/',
      referrer: `https://lakelandhealthinsurance.com${pathname}`
    });
    assert.equal(result.scripts.length, 1, pathname);
  }

  for (const referrer of [
    'https://lakelandhealthinsurance.com/privacy-policy.html',
    'https://lakelandhealthinsurance.com/about/',
    'https://lakelandhealthinsurance.com/provider-prescription-check/',
    'https://lakelandhealthinsurance.com/get-help/?email=jane@example.com',
    'https://lakelandhealthinsurance.com/get-help/#private',
    'https://example.com/private/path'
  ]) {
    const result = loadMetaAudience({ referrer });
    assert.equal(result.scripts.length, 0, referrer);
    assert.equal(result.sandbox.fbq, undefined, referrer);
  }
});

test('missing preference defaults to PageView on reviewed eligible pages', () => {
  const { sandbox, scripts } = loadMetaAudience({ storage: makeStorage(), cookie: '' });
  assert.equal(scripts.length, 1);
  assert.deepEqual(queuedCalls(sandbox), EXPECTED_CALLS);
  assert.equal(sandbox.__LHI_META_AUDIENCE_STATUS__.state, 'queued');
});

test('GPC, DNT, denied, malformed, duplicate, and unavailable consent fail closed', () => {
  const throwingStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); }
  };
  const scenarios = [
    { globalPrivacyControl: true },
    { doNotTrack: '1' },
    { storage: makeStorage({ [CONSENT_KEY]: 'denied' }), cookie: `${CONSENT_KEY}=denied` },
    { storage: makeStorage({ [CONSENT_KEY]: 'granted' }), cookie: `${CONSENT_KEY}=%E0%A4%A` },
    { storage: makeStorage({ [CONSENT_KEY]: 'granted' }), cookie: `${CONSENT_KEY}=granted; ${CONSENT_KEY}=granted` },
    { storage: makeStorage({ lhi_meta_audience_opt_out: '1' }), cookie: 'lhi_meta_audience_opt_out=1' },
    { storage: throwingStorage },
    { storage: makeStorage({ [CONSENT_KEY]: 'granted' }), cookie: '' }
  ];
  for (const scenario of scenarios) {
    const { sandbox, scripts } = loadMetaAudience(scenario);
    assert.equal(scripts.length, 0);
    assert.equal(sandbox.fbq, undefined);
  }
});

test('conversion and paid landing routes never inject an automatic Meta prompt', () => {
  const states = [
    { label: 'fresh', storage: makeStorage(), cookie: '' },
    { label: 'denied', storage: makeStorage({ [CONSENT_KEY]: 'denied' }), cookie: `${CONSENT_KEY}=denied` },
    { label: 'uncertain', storage: makeStorage({ [CONSENT_KEY]: 'granted' }), cookie: '' },
    { label: 'GPC', globalPrivacyControl: true },
    { label: 'DNT', doNotTrack: '1' }
  ];

  for (const pathname of PROMPT_SUPPRESSED_PATHS) {
    for (const state of states) {
      const result = loadMetaAudience({ pathname, ...state });
      assert.equal(result.controls.metaAudienceConsentPrompt, undefined, `${pathname} ${state.label}`);
      assert.equal(result.controls.lhiMetaAudienceConsentStyles, undefined, `${pathname} ${state.label}`);
      assert.equal(result.controls.metaAudienceOptIn, undefined, `${pathname} ${state.label}`);
      assert.equal(result.controls.metaAudienceOptOut, undefined, `${pathname} ${state.label}`);
      assert.equal(result.scripts.length, 0, `${pathname} ${state.label}`);
      assert.equal(result.sandbox.fbq, undefined, `${pathname} ${state.label}`);
    }
  }
});

test('reviewed eligible routes inject one dismissible notice until acknowledged', () => {
  for (const [, pathname] of ELIGIBLE_PAGES) {
    const result = loadMetaAudience({ pathname, storage: makeStorage(), cookie: '' });
    assert.equal(result.scripts.length, 1, pathname);
    assert.ok(result.controls.metaAudienceConsentPrompt, pathname);
    assert.equal(result.controls.metaAudienceConsentPrompt.hidden, false, pathname);
    assert.ok(result.controls.metaAudienceOptOut, pathname);
    assert.ok(result.controls.metaAudienceNoticeOk, pathname);
  }
});

test('opt-out after default allow blocks later pixel loads', () => {
  const storage = makeStorage();
  const first = loadMetaAudience({ storage, cookie: '' });
  assert.equal(first.scripts.length, 1);
  first.controls.metaAudienceOptOut.click();
  assert.equal(storage.getItem(CONSENT_KEY), 'denied');
  const second = loadMetaAudience({ storage, cookie: first.document.cookie });
  assert.equal(second.scripts.length, 0);
  assert.equal(second.sandbox.fbq, undefined);
});

test('saved preferences remain honored on reviewed routes, not paid landing pages', () => {
  for (const [, pathname] of ELIGIBLE_PAGES) {
    const result = loadMetaAudience({ pathname, storage: makeStorage({ [CONSENT_KEY]: 'granted' }), cookie: `${CONSENT_KEY}=granted` });
    assert.equal(result.scripts.length, 1, pathname);
    assert.deepEqual(queuedCalls(result.sandbox), EXPECTED_CALLS, pathname);
    assert.equal(result.controls.metaAudienceConsentPrompt?.hidden ?? true, true, pathname);
  }

  for (const pathname of PROMPT_SUPPRESSED_PATHS.filter((path) => path.startsWith('/lp/'))) {
    const result = loadMetaAudience({ pathname, storage: makeStorage(), cookie: '' });
    assert.equal(result.scripts.length, 0, pathname);
    assert.equal(result.sandbox.fbq, undefined, pathname);
    assert.equal(result.controls.metaAudienceConsentPrompt, undefined, pathname);
  }
});

test('explicit privacy controls save a preference and a later eligible route honors it', () => {
  for (const pathname of ['/privacy-policy.html', '/about/']) {
    const storage = makeStorage();
    const controls = loadMetaAudience({
      pathname,
      marker: false,
      storage,
      cookie: '',
      controls: pathname === '/about/' ? 'about' : 'privacy'
    });
    if (pathname === '/about/') {
      assert.equal(controls.controls.metaAudienceConsentPrompt.hidden, false, pathname);
      controls.controls.metaAudienceNoticeOk.click();
      assert.equal(controls.controls.metaAudienceConsentPrompt.hidden, true, pathname);
    } else {
      assert.equal(controls.controls.metaAudienceConsentPrompt, undefined, pathname);
      controls.controls.metaAudienceOptIn.click();
      assert.equal(storage.getItem(CONSENT_KEY), 'granted', pathname);
      assert.match(controls.document.cookie, /lhi_meta_audience_consent=granted/, pathname);
    }
    assert.equal(controls.scripts.length, 0, pathname);
    assert.equal(controls.sandbox.fbq, undefined, pathname);

    const eligible = loadMetaAudience({
      pathname: '/get-help/',
      storage,
      cookie: controls.document.cookie
    });
    assert.equal(eligible.scripts.length, 1, pathname);
    assert.deepEqual(queuedCalls(eligible.sandbox), EXPECTED_CALLS, pathname);
  }
});

test('form-bearing eligible pages never expose form state to the loader', () => {
  for (const [file, pathname] of ELIGIBLE_PAGES.filter(([file]) => FORM_BEARING_ELIGIBLE_FILES.has(file))) {
    const html = readFileSync(join(ROOT, file), 'utf8');
    assert.match(html, /<(?:form|input|textarea|select)\b/i, file);
    const result = loadMetaAudience({
      pathname,
      storage: makeStorage(),
      cookie: '',
      trapFormAccess: true,
      mobileLayout: true
    });
    assert.equal(result.scripts.length, 1, pathname);
    assert.ok(result.accessedSelectors.length >= 1, pathname);
    assert.ok(result.accessedSelectors.every((selector) => selector === 'meta[name="meta-audience-eligible"][content="pageview"]'), pathname);
    assert.ok(result.accessedSelectors.every((selector) => !/form|input|textarea|select|leadForm|lhi-lead-hero/i.test(selector)), pathname);
    assert.doesNotMatch(result.controls.metaAudienceConsentPrompt.className, /meta-audience-notice--top/, pathname);
    assert.deepEqual(queuedCalls(result.sandbox), EXPECTED_CALLS, pathname);
  }
});

test('mobile notice shell stays on the bottom bar class path only', () => {
  const mobile = loadMetaAudience({
    pathname: '/get-help/',
    storage: makeStorage(),
    cookie: '',
    mobileLayout: true
  });
  assert.doesNotMatch(mobile.controls.metaAudienceConsentPrompt.className, /meta-audience-notice--top/);
  assert.match(mobile.controls.metaAudienceConsentPrompt.className, /meta-audience-notice/);
});

test('a pre-existing Meta runtime fails closed without adding calls or scripts', () => {
  const { sandbox, scripts } = loadMetaAudience({ preexistingFbq: true });
  assert.equal(scripts.length, 0);
  assert.equal(sandbox.__LHI_META_AUDIENCE_STATUS__.reason, 'preexisting-meta-runtime');
});

test('approved ad query parameters load the Pixel on eligible routes and strip before Meta', () => {
  const adQueries = [
    '?fbclid=IwY2xjawNeutralOpaqueClickIdentifier123',
    '?gclid=OpaqueGoogleClickIdentifier123',
    '?gbraid=OpaqueGoogleBraidIdentifier123456',
    '?wbraid=OpaqueGoogleWbraidIdentifier12345',
    '?msclkid=OpaqueMicrosoftClickIdentifier123456',
    '?utm_source=facebook&utm_medium=paid_social&utm_campaign=lhi_site_retargeting&utm_content=blog_v1&utm_term=brand-help&utm_id=1234567890',
    '?fbclid=IwY2xjawNeutralOpaqueClickIdentifier123&utm_source=facebook&utm_medium=paid_social&utm_campaign=watson-2027'
  ];
  for (const search of adQueries) {
    for (const pathname of ['/', '/medicare-2027-check/', '/blog/orlando-health-watson-clinic-2027-plan.html']) {
      const { sandbox, scripts } = loadMetaAudience({ pathname, search });
      assert.equal(scripts.length, 1, `${pathname} ${search}`);
      assert.equal(sandbox.location.search, '', `${pathname} ${search}`);
      assert.equal(sandbox.__LHI_META_AUDIENCE_STATUS__.page_url, `https://lakelandhealthinsurance.com${pathname}`, `${pathname} ${search}`);
    }
  }

  const rejected = loadMetaAudience({ pathname: '/', search: '?analytics_test=1' });
  assert.equal(rejected.scripts.length, 0);
  assert.equal(rejected.sandbox.__LHI_META_AUDIENCE_STATUS__.reason, 'query-rejected');
});

test('static marker inventory exactly matches the reviewed 10-page landing ledger', () => {
  const marked = [];
  for (const file of htmlFiles()) {
    const html = readFileSync(file, 'utf8');
    if (html.includes(ELIGIBLE_MARKER)) marked.push(file.slice(ROOT.length + 1));
  }
  const expectedFiles = ELIGIBLE_PAGES.map(([file]) => file).sort();
  assert.deepEqual(marked.sort(), expectedFiles);

  for (const [file, pathname] of ELIGIBLE_PAGES) {
    const html = readFileSync(join(ROOT, file), 'utf8');
    assert.equal((html.match(/<meta name="meta-audience-eligible" content="pageview">/g) || []).length, 1, file);
    assert.ok(html.indexOf(ELIGIBLE_MARKER) < html.indexOf('</head>'), file);
    assert.match(html, /\/js\/analytics\.js\?v=20261017-meta-conversion-events-v1/, file);
    if (html.includes('/css/site-template.css')) {
      assert.match(html, /\/css\/site-template\.css\?v=20261017-meta-conversion-events-v1/, file);
    }
    if (file === 'medicare-2027-check/index.html') {
      assert.doesNotMatch(html, /<link rel="canonical"/i, file);
    } else {
      assert.match(html, new RegExp(`https://lakelandhealthinsurance\\.com${pathname === '/' ? '/' : pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), file);
    }
    if (FORM_BEARING_ELIGIBLE_FILES.has(file)) {
      assert.match(html, /<(?:form|input|textarea|select)\b/i, file);
    } else {
      assert.doesNotMatch(html, /<(?:form|input|textarea|select)\b/i, file);
    }
  }

  for (const relative of [
    ...ELIGIBLE_PAGES.map(([file]) => file),
    'lp/aca/index.html',
    'lp/gap/index.html',
    'lp/medicare/index.html'
  ]) {
    const html = readFileSync(join(ROOT, relative), 'utf8');
    assert.doesNotMatch(html, /metaAudienceConsentPrompt|meta-audience-consent/i, relative);
  }

  const explicitDenied = [
    'about/index.html',
    'carriers/index.html',
    'aca-subsidy-estimator/index.html',
    'privacy-policy.html',
    'sms-policy.html',
    'current-client-review/index.html',
    'post-enrollment-review/index.html',
    'provider-prescription-check/index.html',
    'losing-medicaid-florida/index.html',
    'book/index.html',
    'blog/aca-subsidy-wrong-income-florida.html',
    'blog/dont-overlook-rx-costs-2027.html',
    'blog/mental-health-awareness-month-therapy-benefit-lakeland-2026.html'
  ];
  for (const relative of explicitDenied) {
    assert.doesNotMatch(readFileSync(join(ROOT, relative), 'utf8'), /meta-audience-eligible/i, relative);
  }
});

test('Meta conversion helpers fire trackSingle with empty params and honor opt-out', () => {
  const { sandbox } = loadMetaAudience({
    pathname: '/get-help/',
    storage: makeStorage(),
    cookie: ''
  });
  const callsBefore = queuedCalls(sandbox).length;
  assert.equal(sandbox.lhiTrackMetaPhoneClick(), true);
  assert.equal(sandbox.lhiTrackMetaPhoneClick(), false);
  const conversionCalls = queuedCalls(sandbox).slice(callsBefore);
  assert.equal(conversionCalls[0][0], 'trackSingle');
  assert.equal(conversionCalls[0][1], PIXEL_ID);
  assert.equal(conversionCalls[0][2], 'phone_click');
  assert.equal(Object.keys(conversionCalls[0][3] || {}).length, 0);
  assert.match(conversionCalls[0][4].eventID, /^lhi_ph_/);

  const denied = loadMetaAudience({
    pathname: '/get-help/',
    storage: makeStorage({ [CONSENT_KEY]: 'denied' }),
    cookie: 'lhi_meta_audience_consent=denied'
  });
  denied.sandbox.__LHI_META_AUDIENCE_INITIALIZED__ = true;
  assert.equal(denied.sandbox.lhiTrackMetaPhoneClick(), false);
});

test('CSP and static source preserve the single-loader, intended-dataset contract', () => {
  const headers = readFileSync(join(ROOT, '_headers'), 'utf8');
  const lead = readFileSync(join(ROOT, 'netlify/functions/lead.js'), 'utf8');
  const privacy = readFileSync(join(ROOT, 'privacy-policy.html'), 'utf8');
  const inventory = readFileSync(join(ROOT, 'docs/meta-audience-page-inventory.md'), 'utf8');
  assert.match(headers, /script-src[^;]*https:\/\/connect\.facebook\.net(?:[;\s])/);
  assert.doesNotMatch(headers, /https:\/\/\*\.facebook\.(?:net|com)/);
  assert.match(headers, /img-src[^;]*(?:https:|https:\/\/www\.facebook\.com)/);
  assert.match(headers, /connect-src[^;]*(?:https:|https:\/\/www\.facebook\.com)/);

  assert.equal((LOADER_SRC.match(/1480756087079484/g) || []).length, 2);
  assert.doesNotMatch(LOADER_SRC, /1822900971216472/);
  assert.doesNotMatch(LOADER_SRC, /FormData|document\.forms|\.elements\b|querySelector(?:All)?\([^)]*(?:input|form|textarea|select)|getElementsByTagName\(['"]form['"]\)|getElementById\(['"]leadForm['"]\)|lhi-lead-hero__form|addEventListener\(['"](?:submit|input|change)/i);
  assert.doesNotMatch(LOADER_SRC, /meta-audience-notice--top|data-lhi-meta-notice-top/);
  assert.doesNotMatch(LOADER_SRC, /trackCustom|['"]Lead['"]|['"]Contact['"]|['"]Schedule['"]/);
  assert.match(lead, /const META_DATASET_ID = '1480756087079484'/);
  assert.match(lead, /const META_GRAPH_VERSION = 'v25\.0'/);
  assert.match(lead, /process\.env\.CONTEXT \|\| 'unknown'/);
  assert.match(lead, /NETLIFY_CONTEXT === 'production' && SITE_ENV === 'production'/);
  assert.match(lead, /lhi_meta_audience_consent/);
  assert.match(lead, /metaBrowserIdentifier\(cookieHeader, '_fbp'\)/);
  assert.match(lead, /metaBrowserIdentifier\(cookieHeader, '_fbc'\)/);
  assert.doesNotMatch(lead, /user_data:\s*\{[^}]*\b(?:email|phone|zip|name|income|provider|prescription)\b/is);
  assert.doesNotMatch(privacy, /Meta website-audience measurement[^.]*disabled on forms/i);
  assert.match(privacy, /does not inspect or transmit anything entered into a form/i);
  assert.match(privacy, /The PageView reports only the page path \(no query or campaign parameters\)\./);
  assert.match(privacy, /Measurement remains disabled on other intake pages/i);
  assert.match(privacy, /matching server-side Conversions API events on eligible pages/i);
  assert.match(LOADER_SRC, /lhiTrackMetaFormSubmitComplete/);
  assert.match(LOADER_SRC, /lhiTrackMetaPhoneClick/);
  assert.match(LOADER_SRC, /lhiTrackMetaMessageStart/);
  assert.match(LOADER_SRC, /form_submit_complete/);
  assert.match(LOADER_SRC, /phone_click/);
  assert.match(LOADER_SRC, /message_start/);
  assert.doesNotMatch(LOADER_SRC, /custom_data/);
  assert.match(privacy, /on by default until you opt out/i);
  assert.match(privacy, /Medicare 2027 doctor-check page/);
  assert.match(privacy, /Watson Clinic and Orlando Health 2027 Medicare article/);
  assert.doesNotMatch(privacy, /ACA, contact, plans/);
  assert.match(readFileSync(join(ROOT, 'js/site-template.js'), 'utf8'), /Ad tracking choices/);
  assert.doesNotMatch(LOADER_SRC, /ensureConsentPrompt|CONSENT_STYLES_ID|createElement\(['"]aside['"]\)/i);
  assert.match(LOADER_SRC, /createElement\(['"]div['"]\)/);
  assert.equal((LOADER_SRC.match(/getElementById\(['"]metaAudienceConsentPrompt['"]\)/g) || []).length, 3);
  assert.match(LOADER_SRC, /prompt\.hidden\s*=\s*!showNotice/);
  assert.match(LOADER_SRC, /reason:\s*['"]default-allow['"]/);
  for (const [, pathname] of ELIGIBLE_PAGES) assert.ok(inventory.includes(`\`${pathname}\``), pathname);

  for (const file of htmlFiles()) {
    const html = readFileSync(file, 'utf8');
    assert.doesNotMatch(html, /connect\.facebook\.net|facebook\.com\/tr|\bfbq\s*\(/i, file);
  }
});
