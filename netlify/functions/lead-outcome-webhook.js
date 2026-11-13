'use strict';

const crypto = require('crypto');

const MAX_BODY_BYTES = 16 * 1024;
const GA4_DEFAULT_MEASUREMENT_ID = 'G-W45RMKHXV0';
const GA4_MP_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const FETCH_TIMEOUT_MS = 2500;
const MAX_SEEN_KEYS = 2000;

const OUTCOME_MAP = Object.freeze({
  qualify_lead: { name: 'qualify_lead', stage: 'qualified' },
  qualified: { name: 'qualify_lead', stage: 'qualified' },
  close_convert_lead: { name: 'close_convert_lead', stage: 'enrolled' },
  enrolled: { name: 'close_convert_lead', stage: 'enrolled' },
  closed_won: { name: 'close_convert_lead', stage: 'enrolled' },
  converted: { name: 'close_convert_lead', stage: 'enrolled' }
});

const FORBIDDEN_PII_KEYS = new Set([
  'email',
  'email_address',
  'phone',
  'phone_number',
  'full_name',
  'name',
  'first_name',
  'last_name',
  'dob',
  'date_of_birth',
  'ssn',
  'address',
  'street',
  'medications',
  'prescriptions',
  'doctor_note',
  'diagnosis'
]);

const ALLOWED_LOB = new Set([
  'medicare',
  'aca',
  'health_protector_guard',
  'short_term',
  'dental_vision',
  'life',
  'other'
]);

const seenOutcomeKeys = new Map();

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function normalizedHeaders(headers) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [k, v] of Object.entries(headers)) {
    out[String(k).toLowerCase()] = String(v == null ? '' : v);
  }
  return out;
}

function getWebhookSecret(env = process.env) {
  return String(
    (env && (env.LEAD_OUTCOME_WEBHOOK_SECRET || env.LHI_LEAD_OUTCOME_WEBHOOK_SECRET)) || ''
  ).trim();
}

function isProductionContext(env = process.env) {
  const siteEnv = String((env && env.LHI_SITE_ENV) || '').trim();
  const context = String((env && env.CONTEXT) || '').trim();
  return siteEnv === 'production' && (!context || context === 'production');
}

function sha256TimingEqual(left, right) {
  const digestA = crypto.createHash('sha256').update(String(left || ''), 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(String(right || ''), 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function verifyRequestAuth(headers, rawBody, secret) {
  if (!secret) return { ok: false, status: 503, reason: 'webhook_secret_not_configured' };

  const signature = String(headers['x-lhi-webhook-signature'] || '').trim();
  if (signature) {
    const cleanHex = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    if (/^[0-9a-f]{64}$/i.test(cleanHex)) {
      const expectedHex = crypto.createHmac('sha256', secret).update(String(rawBody || ''), 'utf8').digest('hex');
      const actualBuf = Buffer.from(cleanHex.toLowerCase(), 'hex');
      const expectedBuf = Buffer.from(expectedHex, 'hex');
      if (actualBuf.length === expectedBuf.length && crypto.timingSafeEqual(actualBuf, expectedBuf)) {
        return { ok: true, method: 'hmac' };
      }
    }
    return { ok: false, status: 401, reason: 'invalid_signature' };
  }

  const headerSecret = String(headers['x-lhi-webhook-secret'] || '').trim();
  if (headerSecret) {
    return sha256TimingEqual(headerSecret, secret)
      ? { ok: true, method: 'header' }
      : { ok: false, status: 401, reason: 'invalid_secret' };
  }

  const auth = String(headers.authorization || '').trim();
  if (/^Bearer\s+/i.test(auth)) {
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (token && sha256TimingEqual(token, secret)) {
      return { ok: true, method: 'bearer' };
    }
    return { ok: false, status: 401, reason: 'invalid_bearer_token' };
  }

  return { ok: false, status: 401, reason: 'missing_credentials' };
}

function resolveOutcome(payload) {
  const candidate = String(payload.event_name || payload.outcome || payload.stage || '').trim().toLowerCase();
  return OUTCOME_MAP[candidate] || null;
}

function synthesizeClientId(seed, secret) {
  const hash = crypto.createHmac('sha256', secret || 'lhi-mp-fallback').update(String(seed)).digest();
  const left = (hash.readUInt32BE(0) % 900000000) + 100000000;
  const right = (hash.readUInt32BE(4) % 900000000) + 100000000;
  return `${left}.${right}`;
}

function validateAndSanitizePayload(payload, secret) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'invalid_payload' };
  }

  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_PII_KEYS.has(String(key).toLowerCase())) {
      return { ok: false, error: 'pii_forbidden' };
    }
  }

  const mappedOutcome = resolveOutcome(payload);
  if (!mappedOutcome) {
    return { ok: false, error: 'unsupported_outcome' };
  }

  const eventId = String(payload.event_id || '').trim();
  const leadId = String(payload.lead_id || '').trim();
  const rawClientId = String(payload.client_id || payload.ga4_client_id || '').trim();

  if (eventId && !/^[a-z0-9._:-]{6,80}$/i.test(eventId)) {
    return { ok: false, error: 'invalid_event_id' };
  }
  if (leadId && !/^[a-z0-9._:-]{4,80}$/i.test(leadId)) {
    return { ok: false, error: 'invalid_lead_id' };
  }
  if (rawClientId && !/^\d{1,20}\.\d{1,20}$/.test(rawClientId)) {
    return { ok: false, error: 'invalid_client_id' };
  }
  if (!eventId && !leadId && !rawClientId) {
    return { ok: false, error: 'missing_correlation_id' };
  }

  const correlationKey = eventId || leadId || rawClientId;
  const clientId = rawClientId || synthesizeClientId(correlationKey, secret);
  const params = {
    lead_stage: mappedOutcome.stage
  };

  if (eventId) params.event_id = eventId;
  if (leadId) params.lead_id = leadId;

  const leadSource = String(payload.lead_source || '').trim().toLowerCase();
  if (leadSource) {
    if (!/^[a-z0-9_-]{2,40}$/.test(leadSource)) return { ok: false, error: 'invalid_lead_source' };
    params.lead_source = leadSource;
  }

  const lob = String(payload.line_of_business || '').trim().toLowerCase();
  if (lob) {
    if (!ALLOWED_LOB.has(lob)) return { ok: false, error: 'invalid_line_of_business' };
    params.line_of_business = lob;
  }

  const stateCode = String(payload.state_code || '').trim().toUpperCase();
  if (stateCode) {
    if (!/^[A-Z]{2}$/.test(stateCode)) return { ok: false, error: 'invalid_state_code' };
    params.state_code = stateCode;
  }

  const abVariant = String(payload.ab_variant || '').trim().toLowerCase();
  if (abVariant) {
    if (!/^[a-z0-9_-]{2,32}$/.test(abVariant)) return { ok: false, error: 'invalid_ab_variant' };
    params.ab_variant = abVariant;
  }

  if (payload.value != null && payload.value !== '') {
    const numValue = Number(payload.value);
    if (!Number.isFinite(numValue) || numValue < 0 || numValue > 50000) {
      return { ok: false, error: 'invalid_value' };
    }
    params.value = Math.round(numValue * 100) / 100;
    params.currency = 'USD';
  }

  const eventBody = {
    name: mappedOutcome.name,
    params
  };

  let timestampMicros;
  if (payload.timestamp_micros != null && payload.timestamp_micros !== '') {
    const ts = Number(payload.timestamp_micros);
    if (!Number.isInteger(ts) || ts <= 0) {
      return { ok: false, error: 'invalid_timestamp_micros' };
    }
    timestampMicros = ts;
  }

  const mpPayload = {
    client_id: clientId,
    non_personalized_ads: false,
    events: [eventBody]
  };
  if (timestampMicros) mpPayload.timestamp_micros = timestampMicros;

  return {
    ok: true,
    ga4Event: mappedOutcome.name,
    dedupeKey: `${mappedOutcome.name}:${correlationKey}`,
    mpPayload
  };
}

function recordSeenKey(key) {
  if (seenOutcomeKeys.has(key)) return false;
  if (seenOutcomeKeys.size >= MAX_SEEN_KEYS) {
    const firstKey = seenOutcomeKeys.keys().next().value;
    if (firstKey !== undefined) seenOutcomeKeys.delete(firstKey);
  }
  seenOutcomeKeys.set(key, Date.now());
  return true;
}

exports.handler = async function (event) {
  if (String((event && event.httpMethod) || '').toUpperCase() !== 'POST') {
    return response(405, { ok: false, error: 'method_not_allowed' });
  }

  const rawBody = String((event && event.body) || '');
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return response(413, { ok: false, error: 'payload_too_large' });
  }

  const headers = normalizedHeaders(event && event.headers);
  const secret = getWebhookSecret(process.env);
  const auth = verifyRequestAuth(headers, rawBody, secret);
  if (!auth.ok) {
    return response(auth.status, { ok: false, error: auth.reason });
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody || '{}');
  } catch {
    return response(400, { ok: false, error: 'invalid_json' });
  }

  const validated = validateAndSanitizePayload(parsed, secret);
  if (!validated.ok) {
    return response(400, { ok: false, error: validated.error });
  }

  if (!isProductionContext(process.env)) {
    return response(202, {
      ok: true,
      skipped: true,
      reason: 'non_production_context',
      ga4_event: validated.ga4Event
    });
  }

  const mpSecret = String(process.env.GA4_MP_API_SECRET || '').trim();
  const measurementId = String(process.env.GA4_MEASUREMENT_ID || GA4_DEFAULT_MEASUREMENT_ID).trim();
  if (!mpSecret) {
    return response(503, { ok: false, error: 'ga4_mp_not_configured' });
  }

  if (!recordSeenKey(validated.dedupeKey)) {
    return response(200, {
      ok: true,
      deduped: true,
      ga4_event: validated.ga4Event
    });
  }

  const endpoint = `${GA4_MP_ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(mpSecret)}`;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validated.mpPayload),
      ...(controller ? { signal: controller.signal } : {})
    });
    if (timeout) clearTimeout(timeout);
    if (!res.ok) {
      seenOutcomeKeys.delete(validated.dedupeKey);
      return response(502, { ok: false, error: `ga4_mp_${res.status}` });
    }
    return response(200, {
      ok: true,
      ga4_event: validated.ga4Event
    });
  } catch (err) {
    if (timeout) clearTimeout(timeout);
    seenOutcomeKeys.delete(validated.dedupeKey);
    return response(502, { ok: false, error: 'ga4_mp_request_failed' });
  }
};

exports._test = {
  verifyRequestAuth,
  validateAndSanitizePayload,
  synthesizeClientId,
  clearSeenKeys: () => seenOutcomeKeys.clear()
};
