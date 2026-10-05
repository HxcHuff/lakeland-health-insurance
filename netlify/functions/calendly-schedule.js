// Netlify Function: /api/calendly-schedule
// Browser-confirmed Calendly booking → Meta CAPI Schedule.
// Accepts only event_id + event_name. Never reads Calendly invitee details.

const META_DATASET_ID = '1480756087079484';
const META_GRAPH_VERSION = 'v25.0';
const CONFIGURED_META_DATASET_ID = String(process.env.META_PIXEL_ID || '').trim();
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE;
const PRIMARY_SITE_ORIGIN = 'https://lakelandhealthinsurance.com';
const BOOKING_SOURCE_URL = `${PRIMARY_SITE_ORIGIN}/book/`;
const MAX_JSON_BODY_BYTES = 4 * 1024;

const DEFAULT_ALLOWED_ORIGINS = [
  PRIMARY_SITE_ORIGIN,
  'https://www.lakelandhealthinsurance.com',
  process.env.URL,
  process.env.DEPLOY_URL,
  process.env.DEPLOY_PRIME_URL
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

function approvedEventId(value) {
  const text = String(value || '').trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    return text;
  }
  if (/^lhi_book_[a-z0-9]{6,24}_[a-z0-9]{4,16}$/i.test(text)) return text;
  return null;
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
  if (matches.length !== 1 || !matches[0] || matches[0].length > maxValueLength) {
    return { state: 'invalid' };
  }
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

function runtimeLabel(value) {
  return String(value || '').trim() || 'unknown';
}

// Netlify's built-in CONTEXT is a build-image variable and is often unset in
// Functions. This site's production runtime has been observed with CONTEXT
// empty while LHI_SITE_ENV=production. Match submission-created.js and
// google-ads-crm-relay: LHI_SITE_ENV=production is the runtime gate. Empty
// CONTEXT is allowed. Explicit deploy-preview / branch-deploy / dev CONTEXT
// values fail closed.
function isProductionContext(environment = process.env) {
  const siteEnv = String(environment.LHI_SITE_ENV || '').trim();
  const buildContext = String(environment.CONTEXT || '').trim();
  return siteEnv === 'production' && (!buildContext || buildContext === 'production');
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

  if (String(payload.event_name || '').trim() !== 'Schedule') {
    return json(400, cors.headers, { ok: false, error: 'Unsupported event' });
  }

  const eventId = approvedEventId(payload.event_id);
  if (!eventId) {
    return json(400, cors.headers, { ok: false, error: 'Invalid event id' });
  }

  const extraKeys = Object.keys(payload).filter((key) => key !== 'event_name' && key !== 'event_id');
  if (extraKeys.length) {
    return json(400, cors.headers, { ok: false, error: 'Unexpected fields' });
  }

  const netlifyContext = runtimeLabel(process.env.CONTEXT);
  const siteEnv = runtimeLabel(process.env.LHI_SITE_ENV);
  if (!isProductionContext(process.env)) {
    return json(200, cors.headers, {
      ok: false,
      skipped: true,
      event_id: eventId,
      error: `CAPI skipped: production context not confirmed (${netlifyContext}/${siteEnv})`
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

  if (CONFIGURED_META_DATASET_ID !== META_DATASET_ID || !ACCESS_TOKEN) {
    console.warn('Meta dataset configuration unavailable or mismatched');
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

  const eventTime = Math.floor(Date.now() / 1000);
  const body = {
    data: [{
      event_name: 'Schedule',
      event_time: eventTime,
      event_id: eventId,
      action_source: 'website',
      event_source_url: BOOKING_SOURCE_URL,
      user_data: userData,
      custom_data: {
        content_name: 'calendly_booking_completed',
        currency: 'USD',
        value: 0
      }
    }]
  };
  if (TEST_EVENT_CODE) body.test_event_code = TEST_EVENT_CODE;

  let capiOk = false;
  let capiError = null;
  try {
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_DATASET_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    capiOk = res.ok;
    if (!res.ok) capiError = `CAPI ${res.status}`;
  } catch (e) {
    capiError = `CAPI exception${e && e.name ? ` (${e.name})` : ''}`;
  }

  console.info(JSON.stringify({
    type: 'calendly_schedule_capi_v1',
    event_id: eventId,
    day: new Date().toISOString().slice(0, 10),
    context: netlifyContext,
    outcome: capiOk ? 'accepted' : 'failed'
  }));

  return json(capiOk ? 200 : 502, cors.headers, {
    ok: capiOk,
    event_id: eventId,
    capi: capiOk,
    ...(capiError ? { capi_error: capiError } : {})
  });
};

exports._test = {
  ALLOWED_ORIGINS,
  BOOKING_SOURCE_URL,
  META_DATASET_ID,
  approvedEventId,
  corsPolicy,
  isProductionContext,
  measurementBlocked,
  metaBrowserIdentifier
};
