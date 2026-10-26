// Netlify Function: /api/meta-event
// Fire-and-forget browser beacons for neutral Meta custom events (phone_click, message_start, sms_cta_click).

const crypto = require('crypto');

const META_DATASET_ID = '1480756087079484';
const META_GRAPH_VERSION = 'v25.0';
const CONFIGURED_META_DATASET_ID = String(process.env.META_PIXEL_ID || '').trim();
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE;
const PRIMARY_SITE_ORIGIN = 'https://lakelandhealthinsurance.com';
const MAX_JSON_BODY_BYTES = 2 * 1024;
const ALLOWED_EVENTS = new Set(['phone_click', 'message_start', 'sms_cta_click']);
const ELIGIBLE_PATHS = new Set([
  '/',
  '/get-help/',
  '/quote/',
  '/medicare/',
  '/medicare-broker-lakeland-fl/',
  '/aca-health-insurance-lakeland-fl/',
  '/aca-health-insurance-agent-polk-county-fl/',
  '/medicare-2027-check/',
  '/aca-2027-check/',
  '/plans/',
  '/thanks.html',
  '/blog/orlando-health-watson-clinic-insurance-2026.html',
  '/blog/orlando-health-watson-clinic-2027-plan.html',
  '/blog/watson-clinic-humana-2027.html',
  '/blog/switch-to-medigap-plan-g-non-renewal.html',
  '/blog/medicare-advantage-plan-ending-what-now.html',
  '/blog/medicare-part-b-giveback-polk-county.html',
  '/local-health-insurance-answers/lakeland-regional-unitedhealthcare-2027/'
]);
const RATE_LIMIT_STORE = 'meta-event-rate-v1';
const DEDUPE_STORE = 'meta-event-dedupe-v1';
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_EVENTS_PER_WINDOW = 40;

const DEFAULT_ALLOWED_ORIGINS = [
  PRIMARY_SITE_ORIGIN,
  'https://www.lakelandhealthinsurance.com',
  process.env.URL,
  process.env.DEPLOY_URL,
  process.env.DEPLOY_PRIME_URL,
  process.env.LEAD_FORMS_ORIGIN
];
const ALLOWED_ORIGINS = new Set(
  DEFAULT_ALLOWED_ORIGINS
    .concat(String(process.env.LEAD_ALLOWED_ORIGINS || '').split(','))
    .map(normalizeOrigin)
    .filter(Boolean)
);

function headerValue(headers, name) {
  if (!headers) return '';
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '';
}

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin.replace(/\/+$/, '');
  } catch (_) {
    return null;
  }
}

function corsPolicy(headers) {
  const responseHeaders = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  };
  const rawOrigin = String(headerValue(headers, 'origin') || '').trim();
  if (!rawOrigin) return { allowed: true, headers: responseHeaders };

  const origin = normalizeOrigin(rawOrigin);
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return { allowed: false, headers: responseHeaders };
  }
  responseHeaders['Access-Control-Allow-Origin'] = origin;
  return { allowed: true, headers: responseHeaders };
}

function decodeRequestBody(event) {
  const encoded = String(event.body || '');
  const body = event.isBase64Encoded ? Buffer.from(encoded, 'base64').toString('utf8') : encoded;
  if (Buffer.byteLength(body, 'utf8') > MAX_JSON_BODY_BYTES) {
    return { ok: false, statusCode: 413, error: 'Request body too large' };
  }
  return { ok: true, body };
}

function readCookieState(cookieHeader, name, maxValueLength = 128) {
  if (!cookieHeader) return { state: 'absent' };
  if (typeof cookieHeader !== 'string' || cookieHeader.length > 8192) return { state: 'invalid' };

  const prefix = `${name}=`;
  const matches = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix))
    .map((part) => part.slice(prefix.length));

  if (!matches.length) return { state: 'absent' };
  if (matches.length !== 1 || !matches[0] || matches[0].length > maxValueLength) return { state: 'invalid' };
  try {
    const value = decodeURIComponent(matches[0]);
    if (!value || /[\u0000-\u001f\u007f]/.test(value)) return { state: 'invalid' };
    return { state: 'value', value };
  } catch (_) {
    return { state: 'invalid' };
  }
}

function metaBrowserIdentifier(cookieHeader, name) {
  const maxLength = name === '_fbc' ? 320 : 96;
  const state = readCookieState(cookieHeader, name, maxLength);
  if (state.state !== 'value') return null;
  if (name === '_fbp') {
    return /^fb\.[12]\.\d{10,16}\.\d{5,32}$/.test(state.value) ? state.value : null;
  }
  if (name === '_fbc') {
    return /^fb\.[12]\.\d{10,16}\.[A-Za-z0-9_-]{20,256}$/.test(state.value) ? state.value : null;
  }
  return null;
}

function measurementBlocked(headers, cookieHeader) {
  const gpc = String(headerValue(headers, 'sec-gpc') || '').trim();
  const dnt = String(headerValue(headers, 'dnt') || '').trim().toLowerCase();
  if (gpc && gpc !== '0') return 'global-privacy-control';
  if (dnt && dnt !== '0' && dnt !== 'unspecified') return 'browser-opt-out-signal';

  const legacyOptOut = readCookieState(cookieHeader, 'lhi_meta_audience_opt_out');
  if (legacyOptOut.state === 'invalid' || legacyOptOut.state === 'value') return 'visitor-declined';

  const consent = readCookieState(cookieHeader, 'lhi_meta_audience_consent');
  if (consent.state === 'invalid') return 'preference-state-uncertain';
  if (consent.state === 'value' && consent.value === 'denied') return 'visitor-declined';
  return null;
}

function clientIpFromHeaders(headers) {
  const forwarded = String(headerValue(headers, 'x-forwarded-for') || '').split(',')[0].trim();
  const direct = String(
    headerValue(headers, 'x-nf-client-connection-ip') || headerValue(headers, 'client-ip') || ''
  ).trim();
  const ip = forwarded || direct;
  if (!ip || ip.length > 45 || !/^[\da-f.:]+$/i.test(ip)) return null;
  return ip;
}

function normalizePath(pathname) {
  let path = String(pathname || '/');
  if (path.charAt(0) !== '/') return '';
  path = path.replace(/\/index\.html$/i, '/');
  if (path !== '/' && path.charAt(path.length - 1) !== '/' && !/\.[a-z0-9]+$/i.test(path)) {
    path += '/';
  }
  return path;
}

function approvedEventId(eventName, value) {
  const text = String(value || '').trim();
  if (eventName === 'phone_click') return /^lhi_ph_[a-z0-9]{8,48}$/i.test(text) ? text : null;
  if (eventName === 'message_start') return /^lhi_ms_[a-z0-9]{8,48}$/i.test(text) ? text : null;
  if (eventName === 'sms_cta_click') return /^lhi_smc_[a-z0-9]{8,48}$/i.test(text) ? text : null;
  return null;
}

function isProductionContext(environment = process.env) {
  const siteEnv = String(environment.LHI_SITE_ENV || '').trim();
  const buildContext = String(environment.CONTEXT || '').trim();
  return siteEnv === 'production' && (!buildContext || buildContext === 'production');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

let blobsImport = () => import('@netlify/blobs');

async function getStore(event, name) {
  try {
    const blobs = await blobsImport();
    if (!blobs || typeof blobs.getStore !== 'function') return null;
    if (event && typeof blobs.connectLambda === 'function') {
      blobs.connectLambda(event);
    }
    return blobs.getStore({ name, consistency: 'strong' });
  } catch (_) {
    return null;
  }
}

async function checkRateLimit(event, headers) {
  const store = await getStore(event, RATE_LIMIT_STORE);
  if (!store) return { ok: true, skipped: true };

  const ip = clientIpFromHeaders(headers) || 'unknown';
  const bucket = Math.floor(Date.now() / RATE_WINDOW_MS);
  const key = `v1/${sha256(`${ip}:${bucket}`)}`;
  try {
    const existing = await store.get(key, { type: 'json' });
    const count = existing && typeof existing.count === 'number' ? existing.count : 0;
    if (count >= MAX_EVENTS_PER_WINDOW) return { ok: false, error: 'rate_limited' };
    await store.setJSON(key, { count: count + 1 }, { metadata: { bucket } });
    return { ok: true };
  } catch (_) {
    return { ok: true, skipped: true };
  }
}

async function claimEventId(event, eventId) {
  const store = await getStore(event, DEDUPE_STORE);
  if (!store) return { ok: true, skipped: true };

  const key = `v1/${sha256(eventId)}`;
  try {
    const existing = await store.get(key);
    if (existing) return { ok: false, duplicate: true };
    await store.set(key, '1', { metadata: { created: Date.now() } });
    return { ok: true };
  } catch (_) {
    return { ok: true, skipped: true };
  }
}

function json(statusCode, headers, body) {
  return {
    statusCode,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  const headers = event.headers || {};
  const cors = corsPolicy(headers);
  if (!cors.allowed) {
    return { statusCode: 403, headers: cors.headers, body: 'Origin Not Allowed' };
  }
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors.headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors.headers, body: 'Method Not Allowed' };
  }

  const decodedBody = decodeRequestBody(event);
  if (!decodedBody.ok) {
    return json(decodedBody.statusCode, cors.headers, { ok: false, error: decodedBody.error });
  }

  let payload;
  try {
    payload = JSON.parse(decodedBody.body || '{}');
  } catch (_) {
    return json(400, cors.headers, { ok: false, error: 'Invalid JSON' });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json(400, cors.headers, { ok: false, error: 'JSON body must be an object' });
  }

  const eventName = String(payload.name || '').trim();
  if (!ALLOWED_EVENTS.has(eventName)) {
    return json(400, cors.headers, { ok: false, error: 'Unsupported event' });
  }

  const eventId = approvedEventId(eventName, payload.event_id);
  if (!eventId) {
    return json(400, cors.headers, { ok: false, error: 'Invalid event id' });
  }

  const path = normalizePath(payload.path);
  if (!path || !ELIGIBLE_PATHS.has(path)) {
    return json(400, cors.headers, { ok: false, error: 'Path not eligible' });
  }

  const extraKeys = Object.keys(payload).filter((key) => key !== 'name' && key !== 'event_id' && key !== 'path');
  if (extraKeys.length) {
    return json(400, cors.headers, { ok: false, error: 'Unexpected fields' });
  }

  if (!isProductionContext(process.env)) {
    return json(200, cors.headers, {
      ok: false,
      skipped: true,
      event_id: eventId,
      error: 'CAPI skipped: production context not confirmed'
    });
  }

  const cookieHeader = headers.cookie || '';
  const blocked = measurementBlocked(headers, cookieHeader);
  if (blocked) {
    return json(200, cors.headers, {
      ok: false,
      skipped: true,
      event_id: eventId,
      error: `CAPI skipped: ${blocked}`
    });
  }

  const rate = await checkRateLimit(event, headers);
  if (!rate.ok) {
    return json(429, cors.headers, { ok: false, error: rate.error || 'rate_limited' });
  }

  const dedupe = await claimEventId(event, eventId);
  if (!dedupe.ok) {
    return json(200, cors.headers, { ok: true, duplicate: true, event_id: eventId });
  }

  if (CONFIGURED_META_DATASET_ID !== META_DATASET_ID || !ACCESS_TOKEN) {
    return json(200, cors.headers, {
      ok: false,
      skipped: true,
      event_id: eventId,
      error: 'Meta dataset configuration unavailable or mismatched'
    });
  }

  const userData = {};
  const fbp = metaBrowserIdentifier(cookieHeader, '_fbp');
  const fbc = metaBrowserIdentifier(cookieHeader, '_fbc');
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  const clientIp = clientIpFromHeaders(headers);
  const userAgent = String(headerValue(headers, 'user-agent') || '').trim().slice(0, 512);
  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;

  const body = {
    data: [{
      event_name: eventName,
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: `${PRIMARY_SITE_ORIGIN}${path}`,
      user_data: userData
    }]
  };
  if (TEST_EVENT_CODE) body.test_event_code = TEST_EVENT_CODE;

  try {
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_DATASET_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.error(`Meta event CAPI ${res.status}`);
      return json(502, cors.headers, { ok: false, error: `CAPI ${res.status}`, event_id: eventId });
    }
    return json(200, cors.headers, { ok: true, event_id: eventId });
  } catch (e) {
    console.error(`Meta event CAPI exception${e && e.name ? ` (${e.name})` : ''}`);
    return json(502, cors.headers, { ok: false, error: 'CAPI exception', event_id: eventId });
  }
};

exports._test = {
  ALLOWED_EVENTS,
  ELIGIBLE_PATHS,
  approvedEventId,
  measurementBlocked,
  normalizePath,
  clientIpFromHeaders,
  blobsImport: (fn) => {
    blobsImport = fn;
  }
};
