import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';
import vm from 'node:vm';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const BOOK_HTML = readFileSync(join(ROOT, 'book/index.html'), 'utf8');
const SCRIPT_SRC = readFileSync(join(ROOT, 'js/calendly-meta-schedule.js'), 'utf8');
const REDIRECTS = readFileSync(join(ROOT, '_redirects'), 'utf8');
const NETLIFY_TOML = readFileSync(join(ROOT, 'netlify.toml'), 'utf8');
const PRIVACY = readFileSync(join(ROOT, 'privacy-policy.html'), 'utf8');
const PIXEL_ID = '1480756087079484';

const ENV_KEYS = [
  'CONTEXT',
  'LHI_SITE_ENV',
  'META_PIXEL_ID',
  'META_CAPI_ACCESS_TOKEN',
  'META_CAPI_TEST_EVENT_CODE',
  'LEAD_ALLOWED_ORIGINS'
];
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
process.env.CONTEXT = 'production';
process.env.LHI_SITE_ENV = 'production';
process.env.META_PIXEL_ID = PIXEL_ID;
process.env.META_CAPI_ACCESS_TOKEN = 'test-token';
process.env.LEAD_ALLOWED_ORIGINS = 'https://lakelandhealthinsurance.com';
delete process.env.META_CAPI_TEST_EVENT_CODE;

const require = createRequire(import.meta.url);
const { handler, _test } = require('../netlify/functions/calendly-schedule.js');

after(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] == null) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadBookingScript({
  hostname = 'lakelandhealthinsurance.com',
  pathname = '/book/',
  search = '',
  consent = null,
  doNotTrack = '0',
  globalPrivacyControl = false,
  preexistingFbq = false,
  preexistingPixelId = null
} = {}) {
  const scripts = [];
  const imageSrcs = [];
  const createdImages = [];
  const frame = {
    id: 'booking-frame',
    src: ''
  };
  const head = {
    children: [],
    appendChild(node) {
      this.children.push(node);
      if (node.tagName === 'SCRIPT') scripts.push(node);
      return node;
    }
  };
  const document = {
    cookie: consent === 'denied' ? 'lhi_meta_audience_consent=denied' : '',
    head,
    createElement(tagName) {
      const node = { tagName: String(tagName).toUpperCase(), async: false, src: '' };
      if (node.tagName === 'IMG') createdImages.push(node);
      return node;
    },
    getElementById(id) {
      return id === 'booking-frame' ? frame : null;
    }
  };
  const fetchCalls = [];
  const gtagCalls = [];
  const listeners = [];
  function ImageMock(width, height) {
    this.width = width || 0;
    this.height = height || 0;
    this.alt = '';
    this._src = '';
    Object.defineProperty(this, 'src', {
      configurable: true,
      get() { return this._src; },
      set(value) {
        this._src = String(value || '');
        imageSrcs.push(this._src);
      }
    });
  }
  const sandbox = {
    URL,
    Image: ImageMock,
    document,
    localStorage: makeStorage(consent ? { lhi_meta_audience_consent: consent } : {}),
    location: {
      hostname,
      pathname,
      search,
      origin: `https://${hostname}`,
      protocol: 'https:'
    },
    navigator: { globalPrivacyControl, doNotTrack },
    crypto: { randomUUID() { return '11111111-2222-4333-a444-555555555555'; } },
    fetch: async (url, init) => {
      fetchCalls.push({ url, init });
      return { ok: true, status: 200 };
    },
    gtag: (...args) => { gtagCalls.push(args); },
    addEventListener(type, handler) {
      listeners.push({ type, handler });
    },
    window: null
  };
  sandbox.window = sandbox;
  if (preexistingFbq) {
    const queue = function () { queue.queue.push(Array.from(arguments)); };
    queue.queue = [];
    if (preexistingPixelId) {
      queue.getState = () => ({ pixels: [{ id: preexistingPixelId }] });
    }
    sandbox.fbq = queue;
    sandbox._fbq = queue;
  }
  vm.createContext(sandbox);
  vm.runInContext(SCRIPT_SRC, sandbox, { filename: 'calendly-meta-schedule.js' });
  return { sandbox, scripts, frame, fetchCalls, gtagCalls, listeners, imageSrcs, createdImages };
}

function queuedPixelCalls(sandbox) {
  return Array.from(sandbox.fbq?.queue || [], (args) => Array.from(args));
}

async function withEnv(overrides, fn) {
  const keys = Object.keys(overrides);
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
    return await fn();
  } finally {
    for (const key of keys) {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

const SCHEDULE_BODY = {
  event_name: 'Schedule',
  event_id: '11111111-2222-4333-a444-555555555555'
};

async function invoke(body, {
  method = 'POST',
  headers = {},
  capiStatus = 200
} = {}) {
  const calls = [];
  const logs = [];
  const originalFetch = global.fetch;
  const originalConsole = { info: console.info, warn: console.warn, error: console.error };
  global.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return { ok: capiStatus >= 200 && capiStatus < 300, status: capiStatus };
  };
  console.info = (...args) => logs.push(['info', ...args]);
  console.warn = (...args) => logs.push(['warn', ...args]);
  console.error = (...args) => logs.push(['error', ...args]);
  try {
    const response = await handler({
      httpMethod: method,
      headers: {
        origin: 'https://lakelandhealthinsurance.com',
        ...headers
      },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
    return { response, calls, logs };
  } finally {
    global.fetch = originalFetch;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }
}

test('booking page keeps the Schedule converter without hardcoding the calendar account', () => {
  assert.match(BOOK_HTML, /id="booking-frame"/);
  assert.doesNotMatch(BOOK_HTML, /src="\/book\/embed"/);
  assert.match(BOOK_HTML, /\/js\/calendly-meta-schedule\.js\?v=20261005c/);
  assert.doesNotMatch(BOOK_HTML, /healthmarkets|calendly\.com\/dhuff|\bfbq\s*\(/i);
  assert.match(REDIRECTS, /\/book\/embed https:\/\/calendly\.com\/dhuff-healthmarkets\?embed_domain=lakelandhealthinsurance\.com&embed_type=Inline/);
  assert.match(REDIRECTS, /^\/book\/embed .* 302$/m);
  assert.doesNotMatch(REDIRECTS, /^\/book\/embed .* 200$/m);
  assert.match(REDIRECTS, /^\/calendly-book\.html \/book\/ 301!$/m);
  assert.match(NETLIFY_TOML, /from = "\/api\/calendly-schedule"/);
  assert.match(PRIVACY, /standard Meta <code>Schedule<\/code> conversion/);
});

test('converter points the iframe at Calendly, initializes the Pixel once, and ignores other pages', () => {
  const booking = loadBookingScript({ search: '?utm_source=facebook' });
  assert.equal(
    booking.frame.src,
    'https://calendly.com/dhuff-healthmarkets?embed_domain=lakelandhealthinsurance.com&embed_type=Inline&hide_event_type_details=1&hide_gdpr_banner=1&hide_landing_page_details=1&utm_source=facebook'
  );
  assert.equal(booking.scripts.length, 1);
  assert.equal(booking.scripts[0].src, 'https://connect.facebook.net/en_US/fbevents.js');
  assert.deepEqual(queuedPixelCalls(booking.sandbox), [
    ['consent', 'grant'],
    ['set', 'autoConfig', false, PIXEL_ID],
    ['init', PIXEL_ID],
    ['trackSingle', PIXEL_ID, 'PageView']
  ]);
  assert.equal(booking.sandbox.__LHI_CALENDLY_META_STATUS__.state, 'ready');
  assert.equal(booking.sandbox.__LHI_CALENDLY_META_STATUS__.reason, 'pixel-initialized');

  const reused = loadBookingScript({
    preexistingFbq: true,
    preexistingPixelId: PIXEL_ID,
    search: '?utm_medium=paid_social'
  });
  assert.equal(reused.scripts.length, 0);
  assert.equal(queuedPixelCalls(reused.sandbox).length, 0);
  assert.equal(reused.sandbox.__LHI_CALENDLY_META_STATUS__.reason, 'pixel-reused');
  assert.match(reused.frame.src, /utm_medium=paid_social/);

  const adopted = loadBookingScript({ preexistingFbq: true, search: '?utm_campaign=book' });
  assert.equal(adopted.scripts.length, 0);
  assert.deepEqual(queuedPixelCalls(adopted.sandbox), [
    ['consent', 'grant'],
    ['set', 'autoConfig', false, PIXEL_ID],
    ['init', PIXEL_ID]
  ]);
  assert.equal(adopted.sandbox.__LHI_CALENDLY_META_STATUS__.reason, 'pixel-adopted');
  assert.match(adopted.frame.src, /utm_campaign=book/);

  const other = loadBookingScript({ pathname: '/get-help/' });
  assert.equal(other.scripts.length, 0);
  assert.equal(other.sandbox.fbq, undefined);
  assert.equal(other.sandbox.__LHI_CALENDLY_META_STATUS__.reason, 'page-not-booking');
});

test('event_scheduled fires Schedule once without Calendly payload fields', async () => {
  const { sandbox, listeners, gtagCalls, fetchCalls, imageSrcs } = loadBookingScript();
  const handler = listeners.find((entry) => entry.type === 'message').handler;
  handler({
    origin: 'https://calendly.com',
    data: {
      event: 'calendly.event_scheduled',
      payload: {
        event: { uri: 'https://api.calendly.com/scheduled_events/secret' },
        invitee: { uri: 'https://api.calendly.com/invitees/secret', email: 'person@example.com' }
      }
    }
  });

  const pixelCalls = queuedPixelCalls(sandbox);
  const scheduleCall = pixelCalls.find((call) => call[1] === 'Schedule');
  assert.equal(scheduleCall[0], 'track');
  assert.equal(scheduleCall[1], 'Schedule');
  assert.deepEqual({ ...scheduleCall[2] }, {});
  assert.equal(scheduleCall[3].eventID, '11111111-2222-4333-a444-555555555555');
  assert.equal(gtagCalls[0][1], 'schedule_appointment');
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, '/api/calendly-schedule');
  assert.deepEqual(JSON.parse(fetchCalls[0].init.body), {
    event_name: 'Schedule',
    event_id: '11111111-2222-4333-a444-555555555555'
  });
  assert.equal(imageSrcs.length, 1);
  assert.equal(
    imageSrcs[0],
    sandbox.__LHI_CALENDLY_META__.pixelTransportUrl('11111111-2222-4333-a444-555555555555')
  );
  assert.match(imageSrcs[0], /https:\/\/www\.facebook\.com\/tr\?/);
  assert.match(imageSrcs[0], /[?&]ev=Schedule(?:&|$)/);
  assert.match(imageSrcs[0], /[?&]eid=11111111-2222-4333-a444-555555555555(?:&|$)/);
  assert.match(imageSrcs[0], new RegExp(`[?&]id=${PIXEL_ID}(?:&|$)`));
  assert.doesNotMatch(JSON.stringify(fetchCalls), /person@example\.com|scheduled_events|invitees/i);
  assert.doesNotMatch(JSON.stringify(pixelCalls), /person@example\.com|scheduled_events|invitees/i);
  assert.doesNotMatch(imageSrcs[0], /person@example\.com|scheduled_events|invitees/i);
  assert.equal(sandbox.__LHI_CALENDLY_META_STATUS__.event_name, 'Schedule');
  assert.equal(sandbox.__LHI_CALENDLY_META_STATUS__.pixel, true);
  assert.equal(sandbox.__LHI_CALENDLY_META_STATUS__.capi, true);

  handler({
    origin: 'https://calendly.com',
    data: { event: 'calendly.event_scheduled' }
  });
  assert.equal(fetchCalls.length, 1);
  assert.equal(imageSrcs.length, 1);
  assert.equal(sandbox.__LHI_CALENDLY_META_STATUS__.reason, 'already-fired');
});

test('GTM-owned fbq still sends track + /tr Schedule with the CAPI event_id', () => {
  const { sandbox, listeners, fetchCalls, imageSrcs, scripts } = loadBookingScript({
    preexistingFbq: true,
    preexistingPixelId: PIXEL_ID
  });
  assert.equal(scripts.length, 0);
  assert.equal(sandbox.__LHI_CALENDLY_META_STATUS__.reason, 'pixel-reused');

  const handler = listeners.find((entry) => entry.type === 'message').handler;
  handler({ origin: 'https://calendly.com', data: { event: 'calendly.event_scheduled' } });

  const pixelCalls = queuedPixelCalls(sandbox);
  assert.equal(pixelCalls.some((call) => call[0] === 'init'), false);
  const scheduleCall = pixelCalls.find((call) => call[0] === 'track' && call[1] === 'Schedule');
  assert.equal(scheduleCall[3].eventID, '11111111-2222-4333-a444-555555555555');
  assert.equal(fetchCalls.length, 1);
  assert.equal(JSON.parse(fetchCalls[0].init.body).event_id, scheduleCall[3].eventID);
  assert.equal(imageSrcs.length, 1);
  assert.match(imageSrcs[0], /[?&]ev=Schedule(?:&|$)/);
  assert.match(imageSrcs[0], /[?&]eid=11111111-2222-4333-a444-555555555555(?:&|$)/);
  assert.equal(sandbox.__LHI_CALENDLY_META_STATUS__.pixel, true);
  assert.equal(sandbox.__LHI_CALENDLY_META_STATUS__.capi, true);
});

test('same-origin embed messages count and declined browsers do not send Meta', () => {
  const allowed = loadBookingScript();
  assert.equal(
    allowed.sandbox.__LHI_CALENDLY_META__.isScheduledMessage({
      origin: 'https://lakelandhealthinsurance.com',
      data: { event: 'calendly.event_scheduled' }
    }, 'https://lakelandhealthinsurance.com'),
    true
  );
  assert.equal(
    allowed.sandbox.__LHI_CALENDLY_META__.isScheduledMessage({
      origin: 'https://evil.example',
      data: { event: 'calendly.event_scheduled' }
    }, 'https://lakelandhealthinsurance.com'),
    false
  );

  const declined = loadBookingScript({ consent: 'denied' });
  assert.equal(declined.scripts.length, 0);
  const handler = declined.listeners.find((entry) => entry.type === 'message').handler;
  handler({ origin: 'https://calendly.com', data: { event: 'calendly.event_scheduled' } });
  assert.equal(declined.sandbox.fbq, undefined);
  assert.equal(declined.fetchCalls.length, 0);
  assert.equal(declined.imageSrcs.length, 0);
  assert.equal(declined.gtagCalls[0][1], 'schedule_appointment');
  assert.equal(declined.sandbox.__LHI_CALENDLY_META_STATUS__.reason, 'visitor-declined');

  const gpc = loadBookingScript({ globalPrivacyControl: true });
  const gpcHandler = gpc.listeners.find((entry) => entry.type === 'message').handler;
  gpcHandler({ origin: 'https://calendly.com', data: { event: 'calendly.event_scheduled' } });
  assert.equal(gpc.sandbox.fbq, undefined);
  assert.equal(gpc.fetchCalls.length, 0);
  assert.equal(gpc.imageSrcs.length, 0);
  assert.equal(gpc.sandbox.__LHI_CALENDLY_META_STATUS__.reason, 'global-privacy-control');

  const dnt = loadBookingScript({ doNotTrack: '1' });
  const dntHandler = dnt.listeners.find((entry) => entry.type === 'message').handler;
  dntHandler({ origin: 'https://calendly.com', data: { event: 'calendly.event_scheduled' } });
  assert.equal(dnt.fetchCalls.length, 0);
  assert.equal(dnt.imageSrcs.length, 0);
  assert.equal(dnt.sandbox.__LHI_CALENDLY_META_STATUS__.reason, 'browser-opt-out-signal');

  const local = loadBookingScript({ hostname: 'localhost' });
  const localHandler = local.listeners.find((entry) => entry.type === 'message').handler;
  localHandler({ origin: 'https://calendly.com', data: { event: 'calendly.event_scheduled' } });
  assert.equal(local.fetchCalls.length, 0);
  assert.equal(local.imageSrcs.length, 0);
  assert.equal(local.sandbox.__LHI_CALENDLY_META_STATUS__.reason, 'non-production-host');
});

test('CAPI accepts a production Schedule and rejects invitee fields', async () => {
  const { response, calls, logs } = await invoke({
    event_name: 'Schedule',
    event_id: '11111111-2222-4333-a444-555555555555'
  }, {
    headers: {
      cookie: '_fbp=fb.1.1234567890.123456; _fbc=fb.1.1234567890.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
    }
  });
  const result = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(result.ok, true);
  assert.equal(result.capi, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, new RegExp(`graph\\.facebook\\.com/v25\\.0/${PIXEL_ID}/events`));
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.data[0].event_name, 'Schedule');
  assert.equal(body.data[0].event_source_url, 'https://lakelandhealthinsurance.com/book/');
  assert.equal(body.data[0].custom_data.content_name, 'calendly_booking_completed');
  assert.equal(body.data[0].user_data.fbp, 'fb.1.1234567890.123456');
  assert.doesNotMatch(JSON.stringify(body), /invitee|"email"|"phone"|@example/i);
  assert.match(logs[0][1], /calendly_schedule_capi_v1/);

  const rejected = await invoke({
    event_name: 'Schedule',
    event_id: '11111111-2222-4333-a444-555555555555',
    email: 'person@example.com'
  });
  assert.equal(rejected.response.statusCode, 400);
  assert.equal(JSON.parse(rejected.response.body).error, 'Unexpected fields');
  assert.equal(_test.META_DATASET_ID, PIXEL_ID);
  assert.equal(_test.BOOKING_SOURCE_URL, 'https://lakelandhealthinsurance.com/book/');
});

test('CAPI stays quiet for opt-out, non-Schedule names, and invalid ids', async () => {
  const declined = await invoke({
    event_name: 'Schedule',
    event_id: '11111111-2222-4333-a444-555555555555'
  }, {
    headers: { cookie: 'lhi_meta_audience_consent=denied' }
  });
  assert.equal(declined.response.statusCode, 200);
  assert.equal(JSON.parse(declined.response.body).skipped, true);
  assert.equal(declined.calls.length, 0);

  const leadNamed = await invoke({
    event_name: 'Lead',
    event_id: '11111111-2222-4333-a444-555555555555'
  });
  assert.equal(leadNamed.response.statusCode, 400);

  const badId = await invoke({
    event_name: 'Schedule',
    event_id: 'not-an-id'
  });
  assert.equal(badId.response.statusCode, 400);

  const get = await invoke({
    event_name: 'Schedule',
    event_id: '11111111-2222-4333-a444-555555555555'
  }, { method: 'GET' });
  assert.equal(get.response.statusCode, 405);
  assert.equal(_test.approvedEventId('11111111-2222-4333-a444-555555555555'), '11111111-2222-4333-a444-555555555555');
  assert.equal(_test.measurementBlocked({ dnt: '1' }, ''), 'browser-opt-out-signal');
});

test('production context allows empty CONTEXT when LHI_SITE_ENV is production', () => {
  assert.equal(_test.isProductionContext({ LHI_SITE_ENV: 'production' }), true);
  assert.equal(_test.isProductionContext({ LHI_SITE_ENV: 'production', CONTEXT: '' }), true);
  assert.equal(_test.isProductionContext({ LHI_SITE_ENV: 'production', CONTEXT: '   ' }), true);
  assert.equal(_test.isProductionContext({ LHI_SITE_ENV: 'production', CONTEXT: 'production' }), true);

  for (const environment of [
    { LHI_SITE_ENV: 'production', CONTEXT: 'deploy-preview' },
    { LHI_SITE_ENV: 'production', CONTEXT: 'branch-deploy' },
    { LHI_SITE_ENV: 'production', CONTEXT: 'dev' },
    { LHI_SITE_ENV: 'preview', CONTEXT: '' },
    { LHI_SITE_ENV: 'branch' },
    { CONTEXT: 'production' },
    {}
  ]) {
    assert.equal(_test.isProductionContext(environment), false, JSON.stringify(environment));
  }
});

test('CAPI proceeds when LHI_SITE_ENV is production and CONTEXT is empty', async () => {
  await withEnv({ CONTEXT: '' }, async () => {
    const { response, calls } = await invoke(SCHEDULE_BODY);
    const result = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.equal(result.ok, true);
    assert.equal(result.capi, true);
    assert.equal(result.skipped, undefined);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, new RegExp(`graph\\.facebook\\.com/v25\\.0/${PIXEL_ID}/events`));
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.data[0].event_name, 'Schedule');
    assert.equal(body.data[0].event_id, SCHEDULE_BODY.event_id);
    assert.doesNotMatch(JSON.stringify(body), /invitee|"email"|"phone"|@example/i);
  });
});

test('CAPI stays quiet for deploy-preview and branch-deploy even when LHI_SITE_ENV is production', async () => {
  for (const context of ['deploy-preview', 'branch-deploy', 'dev']) {
    await withEnv({ CONTEXT: context, LHI_SITE_ENV: 'production' }, async () => {
      const { response, calls } = await invoke(SCHEDULE_BODY);
      const result = JSON.parse(response.body);
      assert.equal(response.statusCode, 200, context);
      assert.equal(result.ok, false, context);
      assert.equal(result.skipped, true, context);
      assert.equal(
        result.error,
        `CAPI skipped: production context not confirmed (${context}/production)`,
        context
      );
      assert.equal(calls.length, 0, context);
    });
  }
});

test('privacy skips still win when CONTEXT is empty in production', async () => {
  await withEnv({ CONTEXT: '' }, async () => {
    const declined = await invoke(SCHEDULE_BODY, {
      headers: { cookie: 'lhi_meta_audience_consent=denied' }
    });
    assert.equal(declined.response.statusCode, 200);
    assert.equal(JSON.parse(declined.response.body).error, 'CAPI skipped: visitor-declined');
    assert.equal(declined.calls.length, 0);

    const gpc = await invoke(SCHEDULE_BODY, {
      headers: { 'sec-gpc': '1' }
    });
    assert.equal(JSON.parse(gpc.response.body).error, 'CAPI skipped: global-privacy-control');
    assert.equal(gpc.calls.length, 0);

    const dnt = await invoke(SCHEDULE_BODY, {
      headers: { dnt: '1' }
    });
    assert.equal(JSON.parse(dnt.response.body).error, 'CAPI skipped: browser-opt-out-signal');
    assert.equal(dnt.calls.length, 0);
  });
});
