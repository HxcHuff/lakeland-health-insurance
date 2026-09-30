'use strict';

/**
 * Forward an accepted website form lead to the Vercel lead bridge.
 * Replaces the unused Hopper ingest path. Never texts or emails a lead.
 * Missing LEAD_BRIDGE_URL / LEAD_BRIDGE_KEY skips delivery. Failures are
 * written to a Blobs outbox and retried by lead-bridge-retry.
 */

const crypto = require('node:crypto');

const PRIMARY_SITE_ORIGIN = 'https://lakelandhealthinsurance.com';
const PRODUCTION_SITE_ID = 'b6ad2d8f-d771-44f4-89b5-7ab30350950e';

const PROTOCOL = Object.freeze({
  timeoutMilliseconds: 8000,
  maximumRequestBytes: 16 * 1024
});

const OUTBOX = Object.freeze({
  storeName: 'website-lead-bridge-outbox-v1',
  keyPrefix: 'submission/',
  maximumAttempts: 12,
  maximumBatchSize: 10,
  retryBaseMilliseconds: 15 * 60 * 1000,
  retryMaximumMilliseconds: 6 * 60 * 60 * 1000,
  retentionMilliseconds: 7 * 24 * 60 * 60 * 1000
});

const SUBMISSION_ID = /^[a-f0-9]{24}$/i;
const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SITE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_TEXT = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu;
const UTM_FIELDS = Object.freeze([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'first_utm_source',
  'first_utm_medium',
  'first_utm_campaign',
  'first_utm_term',
  'first_utm_content'
]);
const RAW_SAFE_EXTRAS = Object.freeze([
  'event_id',
  'source_url',
  'server_received_at',
  'consent_recorded_at',
  'consent_page',
  'consent_request_state',
  'consent_call_state',
  'consent_sms_state',
  'consent_email_state',
  'consent_marketing_email_state',
  'state'
]);
const PERMANENT_STATUSES = new Set([400, 401, 403, 404, 422]);

function cleanText(value, maximum) {
  const text = String(value == null ? '' : value).normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!text) return '';
  return text.replace(CONTROL_TEXT, '').slice(0, maximum);
}

function firstField(data, names, maximum) {
  for (const name of names) {
    if (!data || !Object.prototype.hasOwnProperty.call(data, name)) continue;
    const text = cleanText(data[name], maximum);
    if (text) return text;
  }
  return '';
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function normalizeEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return '';
  return email;
}

function normalizePhone(value) {
  const digits = cleanText(value, 32).replace(/\D/gu, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits.length >= 10 && digits.length <= 15 ? digits : '';
}

function normalizeZip(value) {
  const zip = cleanText(value, 10).replace(/\D/gu, '').slice(0, 5);
  return /^\d{5}$/.test(zip) ? zip : '';
}

function normalizeState(value) {
  const state = cleanText(value, 32).toUpperCase();
  if (/^[A-Z]{2}$/.test(state)) return state;
  return '';
}

function granted(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'yes' || raw === 'granted' || raw === 'true' || raw === 'on';
}

function consentFrom(data) {
  const request = granted(data.consent_request) || granted(data.consent_request_state);
  const call = granted(data.consent_call) || granted(data.consent_call_state);
  // Always a real boolean. The Vercel bridge reads consent.sms to enroll
  // the SMS ladder (currently shadow mode). Do not omit or stringify it.
  const sms = Boolean(granted(data.consent_sms) || granted(data.consent_sms_state));
  const email = granted(data.consent_email) || granted(data.consent_email_state);
  const marketingEmail = granted(data.consent_marketing_email)
    || granted(data.consent_marketing_email_state);
  const formConsent = granted(data.consent);
  return Object.freeze({
    request: Boolean(request || formConsent),
    call: Boolean(call || formConsent),
    sms,
    email: Boolean(email || formConsent),
    marketing_email: Boolean(marketingEmail),
    granted: Boolean(request || call || sms || email || marketingEmail || formConsent)
  });
}

function pageUrlFrom(data) {
  const raw = firstField(data, ['source_url', 'source_page', 'consent_page'], 500);
  if (!raw) return '';
  try {
    const url = new URL(raw, PRIMARY_SITE_ORIGIN);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    const host = url.hostname.toLowerCase();
    if (host !== 'lakelandhealthinsurance.com' && host !== 'www.lakelandhealthinsurance.com') {
      return '';
    }
    return `${url.origin}${url.pathname || '/'}`;
  } catch {
    return '';
  }
}

function pickRawExtras(raw) {
  const extras = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return extras;
  for (const key of RAW_SAFE_EXTRAS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const value = raw[key];
    if (value == null || value === '') continue;
    if (!['string', 'number', 'boolean'].includes(typeof value)) continue;
    extras[key] = value;
  }
  return extras;
}

function mergeLeadData(filtered, raw) {
  const base = filtered && typeof filtered === 'object' && !Array.isArray(filtered) ? filtered : {};
  return { ...base, ...pickRawExtras(raw) };
}

function buildWebsiteLeadPayload({
  formName,
  submissionId,
  createdAt,
  data,
  filtered
} = {}) {
  const form = cleanText(formName, 80);
  const id = cleanText(submissionId, 64).toLowerCase();
  if (!form || !SUBMISSION_ID.test(id)) return null;

  const source = mergeLeadData(filtered, data);
  const fromParts = {
    first: firstField(source, ['first_name', 'first'], 100),
    last: firstField(source, ['last_name', 'last'], 100)
  };
  const fromFull = splitName(firstField(source, ['full_name', 'name'], 200));
  const first = fromParts.first || fromFull.first;
  const last = fromParts.last || fromFull.last;
  const name = [first, last].filter(Boolean).join(' ') || firstField(source, ['full_name', 'name'], 200);
  const email = normalizeEmail(firstField(source, ['email'], 254));
  const phone = normalizePhone(firstField(source, ['phone', 'phone_number'], 32));
  if (!name && !first) return null;
  if (!email && !phone) return null;

  const lead = {
    source: 'website_form',
    submission_id: id,
    name,
    first,
    last,
    first_name: first,
    last_name: last,
    email,
    phone,
    form_name: form,
    consent: consentFrom(source)
  };

  const zip = normalizeZip(firstField(source, ['zip_code', 'zip'], 10));
  if (zip) lead.zip = zip;

  const state = normalizeState(firstField(source, ['state'], 32));
  if (state) lead.state = state;

  const intent = firstField(source, ['normalized_intent', 'inquiry_type'], 160);
  if (intent) lead.intent = intent;

  const insuranceType = firstField(source, [
    'line_of_business',
    'coverage_type',
    'product_interest',
    'plan_interest'
  ], 160);
  if (insuranceType) lead.insurance_type = insuranceType;

  const pageUrl = pageUrlFrom(source);
  if (pageUrl) lead.page_url = pageUrl;

  for (const field of UTM_FIELDS) {
    const value = firstField(source, [field], 80);
    if (value) lead[field] = value;
  }

  const eventId = cleanText(source.event_id, 64).toLowerCase();
  if (EVENT_ID.test(eventId)) lead.event_id = eventId;

  const created = cleanText(createdAt || source.server_received_at, 40);
  if (created && Number.isFinite(Date.parse(created))) {
    lead.created_at = new Date(created).toISOString();
  }

  return Object.freeze(lead);
}

function resolveBridgeEndpoint(baseUrl) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    return null;
  }
  const path = parsed.pathname.replace(/\/+$/u, '') || '';
  if (path === '/website/lead') return parsed.origin + '/website/lead';
  if (path) return null;
  return parsed.origin + '/website/lead';
}

function readBridgeConfig(environment = process.env) {
  const endpoint = resolveBridgeEndpoint(environment && environment.LEAD_BRIDGE_URL);
  const key = String(environment && environment.LEAD_BRIDGE_KEY || '').trim();
  if (!endpoint || !key) return null;
  if (key.length < 16 || key.length > 256) return null;
  if (/(?:placeholder|changeme|replace[_-]me|example[_-]secret|your[_-]secret|test[_-]secret)/iu.test(key)) {
    return null;
  }
  return Object.freeze({ endpoint, key });
}

function isProductionContext(environment = process.env) {
  const siteEnv = String(environment && environment.LHI_SITE_ENV || '').trim();
  const buildContext = String(environment && environment.CONTEXT || '').trim();
  return siteEnv === 'production' && (!buildContext || buildContext === 'production');
}

function outboxKey(submissionId) {
  const digest = crypto.createHash('sha256')
    .update('lakeland-website-lead-bridge-outbox-v1\0', 'utf8')
    .update(submissionId, 'utf8')
    .digest('hex');
  return `${OUTBOX.keyPrefix}${digest}`;
}

function retryDelay(attemptCount) {
  return Math.min(
    OUTBOX.retryBaseMilliseconds * Math.pow(2, Math.max(0, attemptCount - 1)),
    OUTBOX.retryMaximumMilliseconds
  );
}

function canonicalLead(lead) {
  return JSON.stringify(lead, Object.keys(lead).sort());
}

function parseStoredLead(data) {
  if (typeof data !== 'string' || !data || Buffer.byteLength(data, 'utf8') > PROTOCOL.maximumRequestBytes) {
    return null;
  }
  let value;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.source !== 'website_form' || !SUBMISSION_ID.test(String(value.submission_id || ''))) {
    return null;
  }
  return value;
}

function headerLookup(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  return String(
    headers[name]
    || headers[name.toLowerCase()]
    || headers[name.toUpperCase()]
    || ''
  ).trim();
}

function decodeBlobsEnvelope(raw) {
  const text = String(raw || '').trim();
  if (!text || text.length > 16 * 1024) return null;
  try {
    const decoded = Buffer.from(text, 'base64').toString('utf8');
    const value = JSON.parse(decoded);
    if (!value || typeof value !== 'object') return null;
    const siteID = String(value.siteID || value.site_id || '').trim();
    const token = String(value.token || '').trim();
    if (!token || token.length < 16 || token.length > 8192) return null;
    return Object.freeze({
      siteID: SITE_ID_PATTERN.test(siteID) ? siteID : '',
      token
    });
  } catch {
    return null;
  }
}

function resolveSiteId(environment, event) {
  const candidates = [
    environment && environment.SITE_ID,
    environment && environment.NETLIFY_SITE_ID,
    headerLookup(event && event.headers, 'x-nf-site-id')
  ];
  for (const value of candidates) {
    const siteID = String(value || '').trim();
    if (SITE_ID_PATTERN.test(siteID)) return siteID;
  }
  return '';
}

function explicitBlobsStoreOptions(environment, event) {
  const fromEnv = decodeBlobsEnvelope(environment && environment.NETLIFY_BLOBS_CONTEXT);
  const fromEvent = decodeBlobsEnvelope(event && event.blobs);
  const siteID = resolveSiteId(environment, event)
    || (fromEnv && fromEnv.siteID)
    || (fromEvent && fromEvent.siteID)
    || '';
  const token = (fromEnv && fromEnv.token)
    || (fromEvent && fromEvent.token)
    || String(environment && environment.NETLIFY_BLOBS_TOKEN || '').trim();
  if (!SITE_ID_PATTERN.test(siteID) || siteID.toLowerCase() !== PRODUCTION_SITE_ID) {
    return null;
  }
  if (!token || token.length < 16 || token.length > 8192) return null;
  return Object.freeze({
    name: OUTBOX.storeName,
    consistency: 'strong',
    siteID,
    token
  });
}

function createProductionStoreFactory({
  environment = process.env,
  blobsImport = () => import('@netlify/blobs')
} = {}) {
  return async function productionStoreFactory(event) {
    let blobs;
    try {
      blobs = await blobsImport();
    } catch {
      return null;
    }
    if (!blobs || typeof blobs.getStore !== 'function') return null;

    const lambdaEvent = Boolean(event && typeof event === 'object' && !Array.isArray(event));
    if (lambdaEvent && typeof blobs.connectLambda === 'function') {
      try {
        blobs.connectLambda(event);
        return blobs.getStore({ name: OUTBOX.storeName, consistency: 'strong' });
      } catch {
        // Fall through to explicit credentials.
      }
    } else {
      try {
        return blobs.getStore({ name: OUTBOX.storeName, consistency: 'strong' });
      } catch {
        // Fall through to explicit credentials.
      }
    }

    const explicit = explicitBlobsStoreOptions(environment, event);
    if (!explicit) return null;
    try {
      return blobs.getStore(explicit);
    } catch {
      return null;
    }
  };
}

function safeLog(logger, entry) {
  const line = {
    event: 'website_lead_bridge',
    form_name: entry.form_name || null,
    outcome: entry.outcome || null,
    reason: entry.reason || null
  };
  if (entry.status != null) line.status = entry.status;
  try {
    if (typeof logger === 'function') logger(Object.freeze(line));
    else console.info(JSON.stringify(line));
  } catch {
    // Observability must never alter delivery or disclose submission material.
  }
}

async function postWebsiteLead({
  lead,
  config,
  fetchImpl = globalThis.fetch,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  timeoutMilliseconds = PROTOCOL.timeoutMilliseconds
}) {
  const body = JSON.stringify(lead);
  if (Buffer.byteLength(body, 'utf8') > PROTOCOL.maximumRequestBytes) {
    return { ok: false, permanent: true, reason: 'request_body_too_large' };
  }

  const controller = new AbortController();
  const timer = setTimer(() => controller.abort(), timeoutMilliseconds);
  try {
    const res = await fetchImpl(config.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bridge-key': config.key
      },
      body,
      signal: controller.signal
    });
    if (res && res.ok) return { ok: true, status: res.status };
    const status = res && res.status;
    return {
      ok: false,
      status,
      permanent: PERMANENT_STATUSES.has(status),
      reason: status ? `upstream_${status}` : 'upstream_error'
    };
  } catch (error) {
    if (error && (error.name === 'AbortError' || controller.signal.aborted)) {
      return { ok: false, permanent: false, reason: 'upstream_timeout' };
    }
    return { ok: false, permanent: false, reason: 'upstream_network_error' };
  } finally {
    clearTimer(timer);
  }
}

function readAttemptCount(metadata) {
  const value = Number(metadata && metadata.attempt_count);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function readOutboxDate(metadata, name, fallback) {
  const value = Date.parse(String(metadata && metadata[name] || ''));
  return Number.isFinite(value) ? value : fallback;
}

async function writeOutboxRecord(store, key, body, metadata) {
  await store.set(key, body, { metadata });
}

async function enqueueFailedLead({
  store,
  lead,
  reason,
  nowMilliseconds,
  permanent
}) {
  if (!store || typeof store.set !== 'function') return false;
  const key = outboxKey(lead.submission_id);
  let existing = null;
  try {
    existing = typeof store.getWithMetadata === 'function'
      ? await store.getWithMetadata(key)
      : null;
  } catch {
    existing = null;
  }

  const storedData = canonicalLead(lead);
  const createdAt = existing
    ? readOutboxDate(existing.metadata, 'created_at', nowMilliseconds)
    : nowMilliseconds;
  const expiresAt = existing
    ? readOutboxDate(existing.metadata, 'expires_at', createdAt + OUTBOX.retentionMilliseconds)
    : nowMilliseconds + OUTBOX.retentionMilliseconds;
  const attemptCount = existing ? readAttemptCount(existing.metadata) + 1 : 1;
  const state = permanent || attemptCount >= OUTBOX.maximumAttempts || expiresAt <= nowMilliseconds
    ? 'FAILED'
    : 'PENDING';
  const metadata = {
    attempt_count: String(attemptCount),
    created_at: new Date(createdAt).toISOString(),
    expires_at: new Date(expiresAt).toISOString(),
    form_name: lead.form_name,
    last_reason: reason || '',
    next_attempt_at: state === 'PENDING'
      ? new Date(nowMilliseconds + retryDelay(attemptCount)).toISOString()
      : '',
    state
  };
  await writeOutboxRecord(store, key, storedData, metadata);
  return state === 'PENDING';
}

async function openBridgeStore(storeFactory, event) {
  if (typeof storeFactory !== 'function') return null;
  try {
    const store = await storeFactory(event);
    if (!store || typeof store.set !== 'function' || typeof store.getWithMetadata !== 'function') {
      return null;
    }
    return store;
  } catch {
    return null;
  }
}

async function deliverWebsiteLead({
  lead,
  environment = process.env,
  fetchImpl = globalThis.fetch,
  logger,
  now = () => Date.now(),
  event,
  storeFactory,
  blobsImport,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  timeoutMilliseconds = PROTOCOL.timeoutMilliseconds
} = {}) {
  try {
    if (!lead || typeof lead !== 'object') return { skipped: true, reason: 'incomplete_lead' };
    if (!isProductionContext(environment)) return { skipped: true, reason: 'non_production' };

    const config = readBridgeConfig(environment);
    if (!config) return { skipped: true, reason: 'missing_configuration' };

    const result = await postWebsiteLead({
      lead,
      config,
      fetchImpl,
      setTimer,
      clearTimer,
      timeoutMilliseconds
    });
    if (result.ok) {
      safeLog(logger, {
        form_name: lead.form_name,
        outcome: 'DELIVERED',
        reason: 'direct',
        status: result.status
      });
      return { skipped: false, ok: true, status: result.status };
    }

    const resolvedFactory = typeof storeFactory === 'function'
      ? storeFactory
      : createProductionStoreFactory({ environment, blobsImport });
    const store = await openBridgeStore(resolvedFactory, event);
    let queued = false;
    if (store) {
      try {
        queued = await enqueueFailedLead({
          store,
          lead,
          reason: result.reason,
          nowMilliseconds: Number(now()),
          permanent: result.permanent
        });
      } catch {
        queued = false;
      }
    }

    safeLog(logger, {
      form_name: lead.form_name,
      outcome: queued ? 'QUEUED' : 'FAILED',
      reason: result.reason,
      status: result.status
    });
    return {
      skipped: false,
      ok: false,
      queued,
      reason: result.reason,
      status: result.status
    };
  } catch {
    safeLog(logger, {
      form_name: lead && lead.form_name,
      outcome: 'FAILED',
      reason: 'internal_error'
    });
    return { skipped: false, ok: false, error: true };
  }
}

async function retryStoredLead({
  record,
  store,
  config,
  fetchImpl,
  logger,
  now,
  setTimer,
  clearTimer,
  timeoutMilliseconds
}) {
  const lead = parseStoredLead(record.data);
  if (!lead) return 'INVALID';
  const nowMilliseconds = Number(now());
  const expiresAt = readOutboxDate(record.metadata, 'expires_at', 0);
  const key = outboxKey(lead.submission_id);
  if (!expiresAt || expiresAt <= nowMilliseconds) {
    try {
      await store.delete(key);
    } catch {
      // Expired records should not block the rest of the batch.
    }
    safeLog(logger, { form_name: lead.form_name, outcome: 'FAILED', reason: 'retention_expired' });
    return 'EXPIRED';
  }

  const result = await postWebsiteLead({
    lead,
    config,
    fetchImpl,
    setTimer,
    clearTimer,
    timeoutMilliseconds
  });
  if (result.ok) {
    try {
      await store.delete(key);
    } catch {
      // Delivery already succeeded; a leftover key will no-op on the next scan.
    }
    safeLog(logger, {
      form_name: lead.form_name,
      outcome: 'DELIVERED',
      reason: 'retry',
      status: result.status
    });
    return 'DELIVERED';
  }

  await enqueueFailedLead({
    store,
    lead,
    reason: result.reason,
    nowMilliseconds,
    permanent: result.permanent
  });
  safeLog(logger, {
    form_name: lead.form_name,
    outcome: result.permanent ? 'FAILED' : 'QUEUED',
    reason: result.reason,
    status: result.status
  });
  return result.permanent ? 'FAILED' : 'QUEUED';
}

function createBridgeRetryHandler({
  environment = process.env,
  fetchImpl = globalThis.fetch,
  logger,
  now = () => Date.now(),
  blobsImport,
  storeFactory,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  timeoutMilliseconds = PROTOCOL.timeoutMilliseconds
} = {}) {
  const resolvedStoreFactory = typeof storeFactory === 'function'
    ? storeFactory
    : createProductionStoreFactory({ environment, blobsImport });

  return async function leadBridgeRetryHandler(event) {
    if (!isProductionContext(environment)) {
      return {
        statusCode: 200,
        headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ ok: true, outcome: 'SKIPPED', reason: 'non_production' })
      };
    }
    const config = readBridgeConfig(environment);
    if (!config) {
      return {
        statusCode: 200,
        headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ ok: true, outcome: 'SKIPPED', reason: 'missing_configuration' })
      };
    }

    const store = await openBridgeStore(resolvedStoreFactory, event);
    if (!store || typeof store.list !== 'function') {
      return {
        statusCode: 200,
        headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ ok: true, outcome: 'SKIPPED', reason: 'outbox_unavailable' })
      };
    }

    let listing;
    try {
      listing = await store.list({ prefix: OUTBOX.keyPrefix });
    } catch {
      return {
        statusCode: 200,
        headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ ok: true, outcome: 'SKIPPED', reason: 'outbox_unavailable' })
      };
    }

    const blobs = listing && Array.isArray(listing.blobs) ? listing.blobs : [];
    const nowMilliseconds = Number(now());
    const due = [];
    for (const item of blobs) {
      if (!item || typeof item.key !== 'string' || !item.key.startsWith(OUTBOX.keyPrefix)) continue;
      let record;
      try {
        record = await store.getWithMetadata(item.key);
      } catch {
        continue;
      }
      if (!record) continue;
      const state = String(record.metadata && record.metadata.state || 'PENDING');
      if (state === 'FAILED') continue;
      const nextAttemptAt = readOutboxDate(record.metadata, 'next_attempt_at', 0);
      if (state === 'PENDING' && nextAttemptAt > nowMilliseconds) continue;
      due.push(record);
      if (due.length >= OUTBOX.maximumBatchSize) break;
    }

    const outcomes = await Promise.all(due.map((record) => retryStoredLead({
      record,
      store,
      config,
      fetchImpl,
      logger,
      now,
      setTimer,
      clearTimer,
      timeoutMilliseconds
    })));

    return {
      statusCode: 200,
      headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: true,
        outcome: 'RECONCILED',
        processed: outcomes.length
      })
    };
  };
}

module.exports = {
  OUTBOX,
  PROTOCOL,
  buildWebsiteLeadPayload,
  createBridgeRetryHandler,
  createProductionStoreFactory,
  deliverWebsiteLead,
  isProductionContext,
  outboxKey,
  postWebsiteLead,
  readBridgeConfig,
  resolveBridgeEndpoint
};
