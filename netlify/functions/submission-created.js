'use strict';

/**
 * Legacy Netlify Forms event function.
 *
 * Netlify invokes this file after a submission has already been accepted and
 * retained. Allowlisted sales forms are minimized and forwarded as an HMAC
 * envelope to the administrator-owned HuffSherpa Apps Script staging endpoint
 * (IMPORT STAGING). The function never sends a Google Ads conversion and never
 * changes campaign configuration.
 *
 * Delivery prefers the site-scoped Blob outbox plus scheduled retry. If the
 * outbox cannot open in a Forms event (Lambda Blobs context missing), or if a
 * pre-POST outbox write fails after getStore succeeds (including
 * BlobsConsistencyError from set), the same signed envelope is posted
 * directly so the lead still reaches the spreadsheet. Preview, branch, and
 * non-production CONTEXT values remain fail-closed.
 *
 * HuffSherpa activation remains blocked until both environment variables are
 * provisioned:
 *   HUFFSHERPA_LEAD_WEBHOOK_URL_V1
 *   HUFFSHERPA_LEAD_WEBHOOK_HMAC_SECRET_V1
 *
 * This file is a Lambda-compatibility handler (`exports.handler`). Netlify
 * Blobs ambient context is not auto-configured in that mode. The outbox
 * factory calls `connectLambda(event)` immediately before `getStore`.
 */

const crypto = require('node:crypto');
const { relaySchema } = require('./lead.js');

const PROTOCOL = Object.freeze({
  envelopeSource: 'netlify',
  envelopeVersion: 1,
  maximumEventBytes: 64 * 1024,
  maximumRequestBytes: 64 * 1024,
  maximumResponseBytes: 4096,
  nonceBytes: 32,
  timeoutMilliseconds: 8000
});

const OUTBOX = Object.freeze({
  storeName: 'huffsherpa-lead-relay-outbox-v1',
  keyPrefix: 'submission/',
  maximumAttempts: 12,
  maximumBatchSize: 10,
  retryBaseMilliseconds: 15 * 60 * 1000,
  retryMaximumMilliseconds: 6 * 60 * 60 * 1000,
  retentionMilliseconds: 7 * 24 * 60 * 60 * 1000
});

const SUBMISSION_ID = /^[a-f0-9]{24}$/i;
const CLICK_ID = /^[A-Za-z0-9._~-]{1,512}$/;
const CAMPAIGN_ID = /^\d{1,20}$/;
const CONTROL_TEXT = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const DEPLOYMENT_ID = /^[A-Za-z0-9_-]{20,200}$/;
const HMAC_SECRET = /^[A-Za-z0-9_-]{64}$/;
const PLACEHOLDER_SECRET = /(?:placeholder|changeme|replace[_-]me|example[_-]secret|your[_-]secret|test[_-]secret)/iu;
const SUCCESS_OUTCOMES = new Set(['STAGED', 'REPLAY_NOOP']);
const FAILURE_OUTCOMES = new Set(['CONFLICT_QUARANTINED', 'REJECTED']);
const CONTROLLED_RESPONSE_REASONS = new Set([
  'ambiguous_click_id',
  'attribution_source_conflict',
  'contact_point_required',
  'duplicate_existing_source_id',
  'form_not_allowlisted',
  'hmac_secret_unavailable',
  'invalid_click_id',
  'invalid_email',
  'invalid_google_ads_campaign_id',
  'invalid_netlify_data',
  'invalid_netlify_payload',
  'invalid_phone',
  'invalid_postal_code',
  'invalid_request',
  'invalid_source_id',
  'invalid_staging_record',
  'invalid_text',
  'invalid_timestamp',
  'invalid_webhook_body',
  'invalid_webhook_envelope',
  'invalid_webhook_signature',
  'netlify_event_not_accepted',
  'potential_match_formula_missing',
  'source_id_payload_drift',
  'staging_capacity_exhausted',
  'staging_headers_mismatch',
  'staging_lock_unavailable',
  'staging_row_race',
  'staging_sheet_missing',
  'stale_webhook_envelope'
]);

const OUTPUT_DATA_FIELDS = Object.freeze([
  'first_name',
  'last_name',
  'phone',
  'email',
  'zip',
  'product_interest',
  'gclid',
  'gbraid',
  'wbraid',
  'gad_campaignid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'first_gclid',
  'first_gbraid',
  'first_wbraid',
  'first_gad_campaignid',
  'first_utm_source',
  'first_utm_medium',
  'first_utm_campaign',
  'first_utm_term',
  'first_utm_content'
]);

const PRODUCTION_SITE_ID = 'b6ad2d8f-d771-44f4-89b5-7ab30350950e';
const SITE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAUSE_TOKEN = /^[A-Za-z0-9._-]{1,80}$/;

class SubmissionRelayError extends Error {
  constructor(code, statusCode, causeCode) {
    super(code);
    this.name = 'SubmissionRelayError';
    this.code = code;
    this.statusCode = statusCode || 502;
    if (CAUSE_TOKEN.test(String(causeCode || ''))) this.causeCode = causeCode;
  }
}

function fail(code, statusCode, causeCode) {
  throw new SubmissionRelayError(code, statusCode, causeCode);
}

function controlledErrorCause(error) {
  if (error instanceof SubmissionRelayError && CAUSE_TOKEN.test(String(error.causeCode || ''))) {
    return error.causeCode;
  }
  const name = String(error && error.name || '').trim();
  const code = String(error && error.code || '').trim();
  const parts = [];
  if (CAUSE_TOKEN.test(name) && name !== 'Error') parts.push(name);
  if (CAUSE_TOKEN.test(code) && code !== name) parts.push(code);
  return parts.join(':') || 'unknown';
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function byteLength(value) {
  return Buffer.byteLength(String(value || ''), 'utf8');
}

function cleanText(value, maximum) {
  const text = String(value == null ? '' : value).normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (text.length > maximum || CONTROL_TEXT.test(text)) fail('invalid_submission_data', 400);
  return text;
}

function firstField(data, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(data, name)) return data[name];
  }
  return '';
}

function normalizeEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) fail('invalid_submission_data', 400);
  return email;
}

function normalizePhone(value) {
  const text = cleanText(value, 32);
  if (!text) return '';
  const digits = text.replace(/\D/gu, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  fail('invalid_submission_data', 400);
}

function normalizePostalCode(value) {
  const postalCode = cleanText(value, 10);
  if (postalCode && !/^\d{5}(?:-\d{4})?$/.test(postalCode)) fail('invalid_submission_data', 400);
  return postalCode;
}

function normalizeNames(data) {
  const explicitFirst = cleanText(firstField(data, ['first_name']), 100);
  const explicitLast = cleanText(firstField(data, ['last_name']), 100);
  if (explicitFirst || explicitLast) return { firstName: explicitFirst, lastName: explicitLast };
  const fullName = cleanText(firstField(data, ['full_name']), 200);
  if (!fullName) return { firstName: '', lastName: '' };
  const parts = fullName.split(' ');
  return { firstName: parts.shift() || '', lastName: parts.join(' ') };
}

function normalizeAttributionValue(field, value) {
  const text = cleanText(value, field.includes('gclid') || field.includes('braid') ? 512 : 80);
  if (!text) return '';
  const base = field.replace(/^first_/, '');
  if (base === 'gclid' || base === 'gbraid' || base === 'wbraid') {
    if (!CLICK_ID.test(text)) fail('invalid_submission_data', 400);
    return text;
  }
  if (base === 'gad_campaignid') {
    if (!CAMPAIGN_ID.test(text)) fail('invalid_submission_data', 400);
    return text;
  }
  return text;
}

function normalizeRelayData(filtered) {
  const names = normalizeNames(filtered);
  const normalized = {
    first_name: names.firstName,
    last_name: names.lastName,
    phone: normalizePhone(firstField(filtered, ['phone', 'phone_number'])),
    email: normalizeEmail(firstField(filtered, ['email'])),
    zip: normalizePostalCode(firstField(filtered, ['zip_code'])),
    product_interest: cleanText(
      firstField(filtered, ['product_interest', 'coverage_type', 'line_of_business']),
      160
    )
  };

  for (const field of OUTPUT_DATA_FIELDS.slice(6)) {
    normalized[field] = normalizeAttributionValue(field, firstField(filtered, [field]));
  }
  if (!normalized.phone && !normalized.email) fail('contact_point_required', 400);

  return Object.freeze(Object.fromEntries(
    OUTPUT_DATA_FIELDS.map((field) => [field, normalized[field] || ''])
  ));
}

function normalizeTimestamp(value) {
  const text = cleanText(value, 40);
  const milliseconds = Date.parse(text);
  if (!text || !Number.isFinite(milliseconds)) fail('invalid_submission_timestamp', 400);
  return new Date(milliseconds).toISOString();
}

function parseNetlifyEvent(event) {
  if (!plainObject(event)) fail('invalid_netlify_event', 400);
  const encoded = typeof event.body === 'string' ? event.body : '';
  if (
    event.isBase64Encoded
    && encoded.length > Math.ceil(PROTOCOL.maximumEventBytes * 4 / 3) + 4
  ) {
    fail('invalid_netlify_event', 400);
  }
  const body = event.isBase64Encoded ? Buffer.from(encoded, 'base64').toString('utf8') : encoded;
  if (!body || byteLength(body) > PROTOCOL.maximumEventBytes) fail('invalid_netlify_event', 400);

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    fail('invalid_netlify_event', 400);
  }
  if (!plainObject(parsed) || !plainObject(parsed.payload)) fail('invalid_netlify_event', 400);
  const submission = parsed.payload;
  const formName = typeof submission.form_name === 'string' ? submission.form_name.trim() : '';
  if (!formName) fail('invalid_netlify_event', 400);
  if (relaySchema.newsletterFormNames.includes(formName)) {
    return Object.freeze({ eligible: false, formName });
  }
  if (!relaySchema.formNames.includes(formName)) fail('form_not_allowlisted', 400);
  if (!plainObject(submission.data)) fail('invalid_netlify_event', 400);
  const submissionId = typeof submission.id === 'string' ? submission.id.trim().toLowerCase() : '';
  if (!SUBMISSION_ID.test(submissionId)) fail('invalid_submission_id', 400);

  const filtered = relaySchema.filterLeadPayloadForRelay(submission.data, formName);
  if (!filtered.ok) fail('invalid_submission_data', 400);
  return Object.freeze({
    eligible: true,
    formName,
    payload: Object.freeze({
      created_at: normalizeTimestamp(submission.created_at),
      data: normalizeRelayData(filtered.payload),
      event_type: 'submission_accepted',
      form_name: formName,
      submission_id: submissionId
    })
  });
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

function repeatedSecretPattern(secret) {
  return [1, 2, 4, 8, 16, 32].some((length) => (
    secret === secret.slice(0, length).repeat(secret.length / length)
  ));
}

function validateHmacSecret(value) {
  if (typeof value !== 'string' || value !== value.trim() || !HMAC_SECRET.test(value)) {
    fail('configuration_unavailable', 503);
  }
  let decoded;
  try {
    decoded = Buffer.from(value, 'base64url');
  } catch {
    fail('configuration_unavailable', 503);
  }
  if (
    decoded.byteLength !== 48
    || decoded.toString('base64url') !== value
    || new Set(value).size < 16
    || PLACEHOLDER_SECRET.test(value)
    || repeatedSecretPattern(value)
  ) {
    fail('configuration_unavailable', 503);
  }
  return value;
}

function validateConfiguration(environment) {
  const endpoint = String(environment.HUFFSHERPA_LEAD_WEBHOOK_URL_V1 || '').trim();
  const secret = validateHmacSecret(environment.HUFFSHERPA_LEAD_WEBHOOK_HMAC_SECRET_V1);
  if (!endpoint || typeof secret !== 'string') fail('configuration_unavailable', 503);

  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    fail('configuration_invalid', 503);
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (
    parsed.protocol !== 'https:'
    || parsed.hostname !== 'script.google.com'
    || parsed.port
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || segments.length !== 4
    || segments[0] !== 'macros'
    || segments[1] !== 's'
    || !DEPLOYMENT_ID.test(segments[2])
    || segments[3] !== 'exec'
    || parsed.href !== endpoint
  ) {
    fail('configuration_invalid', 503);
  }
  return Object.freeze({ endpoint, secret });
}

function requireProductionContext(environment) {
  const siteEnv = String(environment.LHI_SITE_ENV || '').trim();
  const buildContext = String(environment.CONTEXT || '').trim();
  // Netlify Forms event functions and scheduled retries often omit CONTEXT.
  // LHI_SITE_ENV=production is the runtime gate. Empty CONTEXT is allowed.
  // Explicit non-production CONTEXT values fail closed.
  if (
    siteEnv !== 'production'
    || (buildContext && buildContext !== 'production')
  ) {
    fail('production_context_required', 503);
  }
}

function buildEnvelope(payload, secret, nowMilliseconds, randomBytes) {
  if (!Number.isFinite(nowMilliseconds)) fail('clock_unavailable', 503);
  const nonceMaterial = randomBytes(PROTOCOL.nonceBytes);
  if (!(nonceMaterial instanceof Uint8Array) || nonceMaterial.byteLength !== PROTOCOL.nonceBytes) {
    fail('nonce_unavailable', 503);
  }
  const unsigned = Object.freeze({
    issuedAt: new Date(nowMilliseconds).toISOString(),
    nonce: Buffer.from(nonceMaterial).toString('base64url'),
    payload,
    source: PROTOCOL.envelopeSource,
    version: PROTOCOL.envelopeVersion
  });
  const signature = crypto.createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(canonicalJson(unsigned), 'utf8')
    .digest('base64url');
  const body = canonicalJson(Object.freeze({ ...unsigned, signature }));
  if (byteLength(body) > PROTOCOL.maximumRequestBytes) fail('request_body_too_large', 400);
  return body;
}

function outboxKey(submissionId) {
  const digest = crypto.createHash('sha256')
    .update('lakeland-huffsherpa-relay-outbox-v1\0', 'utf8')
    .update(submissionId, 'utf8')
    .digest('hex');
  return `${OUTBOX.keyPrefix}${digest}`;
}

function parseStoredPayload(data) {
  if (typeof data !== 'string' || !data || byteLength(data) > PROTOCOL.maximumRequestBytes) {
    fail('outbox_record_invalid', 503);
  }
  let value;
  try {
    value = JSON.parse(data);
  } catch {
    fail('outbox_record_invalid', 503);
  }
  if (
    !plainObject(value)
    || Object.keys(value).sort().join('\u0000') !== [
      'created_at', 'data', 'event_type', 'form_name', 'submission_id'
    ].join('\u0000')
    || value.event_type !== 'submission_accepted'
    || !relaySchema.formNames.includes(value.form_name)
    || !SUBMISSION_ID.test(String(value.submission_id || ''))
    || !plainObject(value.data)
  ) {
    fail('outbox_record_invalid', 503);
  }
  if (
    Object.keys(value.data).sort().join('\u0000')
    !== [...OUTPUT_DATA_FIELDS].sort().join('\u0000')
    || OUTPUT_DATA_FIELDS.some((field) => typeof value.data[field] !== 'string')
  ) {
    fail('outbox_record_invalid', 503);
  }
  const normalizedData = {
    first_name: cleanText(value.data.first_name, 100),
    last_name: cleanText(value.data.last_name, 100),
    phone: normalizePhone(value.data.phone),
    email: normalizeEmail(value.data.email),
    zip: normalizePostalCode(value.data.zip),
    product_interest: cleanText(value.data.product_interest, 160)
  };
  for (const field of OUTPUT_DATA_FIELDS.slice(6)) {
    normalizedData[field] = normalizeAttributionValue(field, value.data[field]);
  }
  if (!normalizedData.phone && !normalizedData.email) fail('outbox_record_invalid', 503);
  const normalized = Object.freeze({
    created_at: normalizeTimestamp(value.created_at),
    data: Object.freeze(Object.fromEntries(
      OUTPUT_DATA_FIELDS.map((field) => [field, normalizedData[field] || ''])
    )),
    event_type: 'submission_accepted',
    form_name: value.form_name,
    submission_id: String(value.submission_id).toLowerCase()
  });
  if (canonicalJson(normalized) !== data) fail('outbox_record_invalid', 503);
  return normalized;
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
    if (!plainObject(value)) return null;
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
    let lastCause = 'unknown';
    let blobs;
    try {
      blobs = await blobsImport();
    } catch (error) {
      fail('outbox_unavailable', 503, controlledErrorCause(error));
    }
    if (!blobs || typeof blobs.getStore !== 'function') {
      fail('outbox_unavailable', 503, 'getStore_unavailable');
    }

    // Lambda-compatibility handlers (exports.handler) do not receive ambient
    // NETLIFY_BLOBS_CONTEXT. Netlify requires connectLambda(event) immediately
    // before getStore. Both submission-created and huffsherpa-relay-retry use
    // that invoke style and pass the Lambda event through.
    const lambdaEvent = Boolean(event && typeof event === 'object' && !Array.isArray(event));
    if (lambdaEvent && typeof blobs.connectLambda === 'function') {
      try {
        blobs.connectLambda(event);
        return blobs.getStore({ name: OUTBOX.storeName, consistency: 'strong' });
      } catch (error) {
        lastCause = controlledErrorCause(error);
      }
    } else {
      try {
        return blobs.getStore({ name: OUTBOX.storeName, consistency: 'strong' });
      } catch (error) {
        lastCause = controlledErrorCause(error);
      }
    }

    const explicit = explicitBlobsStoreOptions(environment, event);
    if (explicit) {
      try {
        return blobs.getStore(explicit);
      } catch (error) {
        lastCause = controlledErrorCause(error);
      }
    }

    fail('outbox_unavailable', 503, lastCause);
  };
}

async function requireOutboxStore(storeFactory, needsList, event) {
  let store;
  try {
    store = await storeFactory(event);
  } catch (error) {
    if (error instanceof SubmissionRelayError) throw error;
    fail('outbox_unavailable', 503, controlledErrorCause(error));
  }
  const methods = ['getWithMetadata', 'set', 'delete'].concat(needsList ? ['list'] : []);
  if (!store || methods.some((method) => typeof store[method] !== 'function')) {
    fail('outbox_unavailable', 503, 'store_methods_unavailable');
  }
  return store;
}

async function readOutboxRecord(store, key) {
  try {
    return await store.getWithMetadata(key);
  } catch (error) {
    fail('outbox_unavailable', 503, controlledErrorCause(error));
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

function outboxMetadata({
  attemptCount,
  createdAt,
  expiresAt,
  formName,
  lastReason,
  nextAttemptAt,
  state,
  alertedAt
}) {
  const metadata = {
    attempt_count: String(attemptCount),
    created_at: new Date(createdAt).toISOString(),
    expires_at: new Date(expiresAt).toISOString(),
    form_name: formName,
    last_reason: lastReason || '',
    next_attempt_at: nextAttemptAt ? new Date(nextAttemptAt).toISOString() : '',
    state
  };
  if (alertedAt) metadata.alerted_at = new Date(alertedAt).toISOString();
  return Object.freeze(metadata);
}

async function writeOutboxRecord(store, key, body, metadata) {
  try {
    await store.set(key, body, { metadata });
    const persisted = await store.getWithMetadata(key);
    if (!persisted || persisted.data !== body) fail('outbox_write_unconfirmed', 503);
  } catch (error) {
    if (error instanceof SubmissionRelayError) throw error;
    fail('outbox_unavailable', 503, controlledErrorCause(error));
  }
}

async function deleteOutboxRecord(store, key) {
  try {
    await store.delete(key);
  } catch {
    fail('outbox_delete_failed', 503);
  }
}

function retryDelay(attemptCount) {
  return Math.min(
    OUTBOX.retryBaseMilliseconds * Math.pow(2, Math.max(0, attemptCount - 1)),
    OUTBOX.retryMaximumMilliseconds
  );
}

async function prepareOutboxAttempt({
  store,
  payload,
  secret,
  nowMilliseconds,
  randomBytes
}) {
  const key = outboxKey(payload.submission_id);
  const existing = await readOutboxRecord(store, key);
  let createdAt = nowMilliseconds;
  let expiresAt = nowMilliseconds + OUTBOX.retentionMilliseconds;
  let attemptCount = 0;
  if (existing) {
    const existingState = String(existing.metadata && existing.metadata.state || 'PENDING');
    if (
      existingState === 'QUARANTINED'
      || existingState === 'FAILED'
      || existing.metadata && existing.metadata.pii_purged === 'true'
    ) {
      fail('outbox_terminal_record', 409);
    }
    const storedPayload = parseStoredPayload(existing.data);
    if (canonicalJson(storedPayload) !== canonicalJson(payload)) {
      fail('source_id_payload_drift', 409);
    }
    attemptCount = readAttemptCount(existing.metadata);
    createdAt = readOutboxDate(existing.metadata, 'created_at', nowMilliseconds);
    expiresAt = readOutboxDate(
      existing.metadata,
      'expires_at',
      createdAt + OUTBOX.retentionMilliseconds
    );
  }
  const storedData = canonicalJson(payload);
  const requestBody = buildEnvelope(payload, secret, nowMilliseconds, randomBytes);
  const metadata = outboxMetadata({
    attemptCount: attemptCount + 1,
    createdAt,
    expiresAt,
    formName: payload.form_name,
    lastReason: '',
    nextAttemptAt: null,
    state: 'ATTEMPTING'
  });
  await writeOutboxRecord(store, key, storedData, metadata);
  return Object.freeze({ key, metadata, payload, requestBody, storedData });
}

async function markOutboxFailure({ store, attempt, reason, permanent, nowMilliseconds }) {
  const attemptCount = readAttemptCount(attempt.metadata);
  const state = permanent
    ? 'QUARANTINED'
    : attemptCount >= OUTBOX.maximumAttempts ? 'FAILED' : 'PENDING';
  const metadata = outboxMetadata({
    attemptCount,
    createdAt: readOutboxDate(attempt.metadata, 'created_at', nowMilliseconds),
    expiresAt: readOutboxDate(
      attempt.metadata,
      'expires_at',
      nowMilliseconds + OUTBOX.retentionMilliseconds
    ),
    formName: attempt.payload.form_name,
    lastReason: reason,
    nextAttemptAt: state === 'PENDING' ? nowMilliseconds + retryDelay(attemptCount) : null,
    state
  });
  await writeOutboxRecord(store, attempt.key, attempt.storedData, metadata);
  return Object.freeze({ ...attempt, metadata, state });
}

async function productionAlert({ environment, fetchImpl, formName, state, reason, attemptCount }) {
  const apiKey = String(environment.RESEND_API_KEY || '').trim();
  const to = String(environment.HUFFSHERPA_RELAY_ALERT_EMAIL || environment.NOTIFY_EMAIL || '').trim();
  if (!apiKey || !to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(to)) return false;
  try {
    const result = await fetchImpl('https://api.resend.com/emails', {
      body: JSON.stringify({
        from: 'LHI Bot <leads@lakelandhealthinsurance.com>',
        subject: `HuffSherpa relay requires attention: ${state}`,
        text: [
          'A minimized lead relay record requires operational review.',
          `Form: ${formName}`,
          `State: ${state}`,
          `Reason: ${reason}`,
          `Attempts: ${attemptCount}`,
          'Review the Netlify Forms submission and the site-scoped relay outbox.'
        ].join('\n'),
        to
      }),
      cache: 'no-store',
      credentials: 'omit',
      headers: Object.freeze({
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      }),
      method: 'POST',
      redirect: 'error',
      referrerPolicy: 'no-referrer'
    });
    return Boolean(result && result.ok);
  } catch {
    return false;
  }
}

async function alertIfNeeded({
  attempt,
  alertImpl,
  environment,
  fetchImpl,
  nowMilliseconds,
  store
}) {
  if (!['QUARANTINED', 'FAILED'].includes(attempt.state)) return attempt;
  if (attempt.metadata.alerted_at) return attempt;
  let alerted = false;
  try {
    alerted = await alertImpl({
      environment: Object.freeze({
        HUFFSHERPA_RELAY_ALERT_EMAIL: environment.HUFFSHERPA_RELAY_ALERT_EMAIL,
        NOTIFY_EMAIL: environment.NOTIFY_EMAIL,
        RESEND_API_KEY: environment.RESEND_API_KEY
      }),
      fetchImpl,
      formName: attempt.payload.form_name,
      state: attempt.state,
      reason: attempt.metadata.last_reason || 'relay_failed',
      attemptCount: readAttemptCount(attempt.metadata)
    });
  } catch {
    alerted = false;
  }
  if (!alerted) return attempt;
  const metadata = Object.freeze({
    ...attempt.metadata,
    alerted_at: new Date(nowMilliseconds).toISOString()
  });
  await writeOutboxRecord(store, attempt.key, attempt.storedData, metadata);
  return Object.freeze({ ...attempt, metadata });
}

async function purgeExpiredOutboxPayload({
  alertImpl,
  environment,
  fetchImpl,
  formName,
  key,
  metadata,
  nowMilliseconds,
  payload,
  store,
  storedData
}) {
  const reason = String(metadata.state || '') === 'QUARANTINED'
    ? 'quarantine_retention_expired'
    : 'retry_retention_expired';
  let attempt = Object.freeze({
    key,
    metadata: outboxMetadata({
      alertedAt: readOutboxDate(metadata, 'alerted_at', null),
      attemptCount: readAttemptCount(metadata),
      createdAt: readOutboxDate(metadata, 'created_at', nowMilliseconds),
      expiresAt: readOutboxDate(metadata, 'expires_at', nowMilliseconds),
      formName,
      lastReason: reason,
      nextAttemptAt: null,
      state: 'FAILED'
    }),
    payload,
    state: 'FAILED',
    storedData
  });
  attempt = await alertIfNeeded({
    attempt,
    alertImpl,
    environment,
    fetchImpl,
    nowMilliseconds,
    store
  });
  const tombstoneMetadata = Object.freeze({
    ...attempt.metadata,
    pii_purged: 'true',
    pii_purged_at: new Date(nowMilliseconds).toISOString(),
    terminal_at: new Date(nowMilliseconds).toISOString()
  });
  await writeOutboxRecord(store, key, canonicalJson({ version: 1 }), tombstoneMetadata);
  return Object.freeze({ ...attempt, metadata: tombstoneMetadata, storedData: canonicalJson({ version: 1 }) });
}

function validateContentServiceRedirect(response) {
  if (!response || typeof response !== 'object' || !response.headers || typeof response.headers.get !== 'function') {
    fail('upstream_response_unsafe');
  }
  if (response.redirected || (response.status !== 302 && response.status !== 303)) {
    fail('upstream_redirect_rejected');
  }
  const location = String(response.headers.get('location') || '');
  if (!location || location.length > 4096) fail('upstream_redirect_rejected');

  let parsed;
  try {
    parsed = new URL(location);
  } catch {
    fail('upstream_redirect_rejected');
  }
  const keys = Array.from(parsed.searchParams.keys()).sort();
  if (
    parsed.protocol !== 'https:'
    || parsed.hostname !== 'script.googleusercontent.com'
    || parsed.port
    || parsed.username
    || parsed.password
    || parsed.hash
    || !parsed.pathname.startsWith('/')
    || parsed.pathname.length > 2048
    || parsed.search.length > 2048
    || keys.length > 32
  ) {
    fail('upstream_redirect_rejected');
  }
  return parsed.href;
}

async function boundedResponseText(response) {
  if (!response || typeof response !== 'object' || response.redirected || response.status !== 200) {
    fail('upstream_response_unsafe');
  }
  if (!response.headers || typeof response.headers.get !== 'function') fail('upstream_response_unsafe');
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const cacheControl = String(response.headers.get('cache-control') || '').toLowerCase();
  if (!/^application\/json(?:\s*;|$)/u.test(contentType)) fail('upstream_response_unsafe');
  if (/(?:^|,)\s*public(?:\s*(?:,|$))/u.test(cacheControl) || /max-age\s*=\s*[1-9]/u.test(cacheControl)) {
    fail('upstream_response_unsafe');
  }
  const declaredLength = response.headers.get('content-length');
  if (
    declaredLength != null
    && (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > PROTOCOL.maximumResponseBytes)
  ) {
    fail('upstream_response_unsafe');
  }
  if (!response.body || typeof response.body.getReader !== 'function') fail('upstream_response_unsafe');

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    if (!(part.value instanceof Uint8Array)) fail('upstream_response_unsafe');
    total += part.value.byteLength;
    if (total > PROTOCOL.maximumResponseBytes) {
      try { await reader.cancel(); } catch {}
      fail('upstream_response_unsafe');
    }
    chunks.push(part.value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(merged);
  } catch {
    fail('upstream_response_unsafe');
  }
}

function parseUpstreamResponse(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail('upstream_response_unsafe');
  }
  if (
    !plainObject(value)
    || Object.keys(value).sort().join('\u0000') !== ['ok', 'outcome', 'reason'].join('\u0000')
    || typeof value.ok !== 'boolean'
  ) {
    fail('upstream_response_unsafe');
  }
  if (SUCCESS_OUTCOMES.has(value.outcome)) {
    if (!value.ok || value.reason !== null) fail('upstream_response_unsafe');
  } else if (FAILURE_OUTCOMES.has(value.outcome)) {
    if (
      value.ok
      || typeof value.reason !== 'string'
      || !CONTROLLED_RESPONSE_REASONS.has(value.reason)
    ) {
      fail('upstream_response_unsafe');
    }
  } else {
    fail('upstream_response_unsafe');
  }
  return Object.freeze({ ok: value.ok, outcome: value.outcome, reason: value.reason });
}

async function postEnvelope({
  body,
  endpoint,
  fetchImpl,
  setTimer,
  clearTimer,
  timeoutMilliseconds
}) {
  const controller = new AbortController();
  let timer;
  const operation = (async () => {
    const redirectResponse = await fetchImpl(endpoint, {
      body,
      cache: 'no-store',
      credentials: 'omit',
      headers: Object.freeze({
        accept: 'application/json',
        'cache-control': 'no-store',
        'content-type': 'application/json'
      }),
      method: 'POST',
      redirect: 'manual',
      referrerPolicy: 'no-referrer',
      signal: controller.signal
    });
    const redirectUrl = validateContentServiceRedirect(redirectResponse);
    const finalResponse = await fetchImpl(redirectUrl, {
      cache: 'no-store',
      credentials: 'omit',
      headers: Object.freeze({
        accept: 'application/json',
        'cache-control': 'no-store'
      }),
      method: 'GET',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal
    });
    return parseUpstreamResponse(await boundedResponseText(finalResponse));
  })();

  const timeout = new Promise((resolve, reject) => {
    timer = setTimer(() => {
      controller.abort();
      reject(new SubmissionRelayError('upstream_timeout', 504));
    }, timeoutMilliseconds);
  });

  try {
    return await Promise.race([operation, timeout]);
  } catch (error) {
    if (error instanceof SubmissionRelayError) throw error;
    if (controller.signal.aborted || error && error.name === 'AbortError') fail('upstream_timeout', 504);
    fail('upstream_network_error');
  } finally {
    if (timer) clearTimer(timer);
  }
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(body)
  };
}

function productionLogger(entry) {
  const line = JSON.stringify(entry);
  if (
    entry.outcome === 'FAILED'
    || entry.outcome === 'REJECTED'
    || entry.outcome === 'CONFLICT_QUARANTINED'
    || entry.outcome === 'QUARANTINED'
    || entry.outcome === 'EXPIRED'
  ) {
    console.error(line);
  } else {
    console.info(line);
  }
}

function safeLog(logger, formName, outcome, reason, cause) {
  const entry = {
    event: 'huffsherpa_netlify_submission_relay',
    form_name: relaySchema.formNames.includes(formName) ? formName : null,
    outcome,
    reason: reason || null
  };
  if (CAUSE_TOKEN.test(String(cause || ''))) entry.cause = cause;
  try {
    logger(Object.freeze(entry));
  } catch {
    // Observability must never alter delivery or disclose submission material.
  }
}

function createCrmRelayHandler({
  environment = process.env,
  fetchImpl = globalThis.fetch,
  logger = productionLogger,
  now = () => Date.now(),
  randomBytes = crypto.randomBytes,
  blobsImport,
  storeFactory,
  alertImpl = productionAlert,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  timeoutMilliseconds = PROTOCOL.timeoutMilliseconds
} = {}) {
  const resolvedStoreFactory = typeof storeFactory === 'function'
    ? storeFactory
    : createProductionStoreFactory({ environment, blobsImport });
  return async function crmRelayHandler(event) {
    let formName = null;
    let attempt = null;
    let store = null;
    let failureRecorded = false;
    let outboxCause = null;
    try {
      const normalized = parseNetlifyEvent(event);
      if (!normalized.eligible) {
        safeLog(logger, null, 'SKIPPED', 'newsletter_form');
        return response(200, { ok: true, outcome: 'SKIPPED' });
      }
      formName = normalized.formName;
      requireProductionContext(environment);
      const configuration = validateConfiguration(environment);
      const nowMilliseconds = Number(now());
      try {
        store = await requireOutboxStore(resolvedStoreFactory, false, event);
      } catch (error) {
        const controlled = error instanceof SubmissionRelayError
          ? error
          : new SubmissionRelayError('outbox_unavailable', 503, controlledErrorCause(error));
        if (controlled.code !== 'outbox_unavailable') throw controlled;
        outboxCause = CAUSE_TOKEN.test(String(controlled.causeCode || ''))
          ? controlled.causeCode
          : 'unknown';
      }
      if (store) {
        try {
          attempt = await prepareOutboxAttempt({
            store,
            payload: normalized.payload,
            secret: configuration.secret,
            nowMilliseconds,
            randomBytes
          });
        } catch (error) {
          // Only Blobs/outbox availability failures skip durable retry.
          // Signature, config, context, payload-drift, and terminal-record
          // errors must not fall through to a direct POST.
          if (!(error instanceof SubmissionRelayError) || error.code !== 'outbox_unavailable') {
            throw error;
          }
          outboxCause = CAUSE_TOKEN.test(String(error.causeCode || ''))
            ? error.causeCode
            : 'unknown';
          store = null;
          attempt = null;
        }
      }
      if (!store) {
        const requestBody = buildEnvelope(
          normalized.payload,
          configuration.secret,
          nowMilliseconds,
          randomBytes
        );
        const result = await postEnvelope({
          body: requestBody,
          endpoint: configuration.endpoint,
          fetchImpl,
          setTimer,
          clearTimer,
          timeoutMilliseconds
        });
        if (!result.ok) {
          throw new SubmissionRelayError(result.reason, 502);
        }
        safeLog(logger, formName, result.outcome, 'direct_without_outbox', outboxCause);
        return response(200, { ok: true, outcome: result.outcome });
      }
      let result;
      try {
        result = await postEnvelope({
          body: attempt.requestBody,
          endpoint: configuration.endpoint,
          fetchImpl,
          setTimer,
          clearTimer,
          timeoutMilliseconds
        });
      } catch (error) {
        const controlled = error instanceof SubmissionRelayError
          ? error
          : new SubmissionRelayError('upstream_network_error', 502);
        attempt = await markOutboxFailure({
          store,
          attempt,
          reason: controlled.code,
          permanent: false,
          nowMilliseconds
        });
        failureRecorded = true;
        attempt = await alertIfNeeded({
          attempt,
          alertImpl,
          environment,
          fetchImpl,
          nowMilliseconds,
          store
        });
        throw controlled;
      }
      safeLog(logger, formName, result.outcome, result.reason);
      if (!result.ok) {
        attempt = await markOutboxFailure({
          store,
          attempt,
          reason: result.reason,
          permanent: true,
          nowMilliseconds
        });
        failureRecorded = true;
        attempt = await alertIfNeeded({
          attempt,
          alertImpl,
          environment,
          fetchImpl,
          nowMilliseconds,
          store
        });
        throw new SubmissionRelayError(result.reason, 502);
      }
      await deleteOutboxRecord(store, attempt.key);
      return response(200, { ok: true, outcome: result.outcome });
    } catch (error) {
      const controlled = error instanceof SubmissionRelayError
        ? error
        : new SubmissionRelayError('relay_internal_error', 500);
      if (attempt && store && !failureRecorded) {
        try {
          const nowMilliseconds = Number(now());
          attempt = await markOutboxFailure({
            store,
            attempt,
            reason: controlled.code,
            permanent: false,
            nowMilliseconds
          });
          await alertIfNeeded({
            attempt,
            alertImpl,
            environment,
            fetchImpl,
            nowMilliseconds,
            store
          });
        } catch {
          // The minimized canonical payload remains in the site-scoped store.
        }
      }
      const failureCause = CAUSE_TOKEN.test(String(controlled.causeCode || ''))
        ? controlled.causeCode
        : outboxCause;
      safeLog(logger, formName, 'FAILED', controlled.code, failureCause);
      // Netlify ignores event-function response values. Rejecting the
      // invocation makes an eligible lead delivery failure visible in the
      // Functions UI/logs. The durable outbox retains minimized data when it
      // was available; direct-without-outbox failures have no retry record.
      throw new SubmissionRelayError(controlled.code, controlled.statusCode, failureCause);
    }
  };
}

function createSubmissionCreatedHandler(deps = {}) {
  return createCrmRelayHandler(deps);
}

async function retryStoredAttempt({
  record,
  configuration,
  store,
  environment,
  fetchImpl,
  logger,
  now,
  randomBytes,
  alertImpl,
  setTimer,
  clearTimer,
  timeoutMilliseconds
}) {
  let attempt;
  const nowMilliseconds = Number(now());
  const storedPayload = parseStoredPayload(record.data);
  const formName = relaySchema.formNames.includes(storedPayload.form_name)
    ? storedPayload.form_name
    : null;
  if (!formName || !SUBMISSION_ID.test(String(storedPayload.submission_id || ''))) {
    fail('outbox_record_invalid', 503);
  }
  attempt = await prepareOutboxAttempt({
    store,
    payload: storedPayload,
    secret: configuration.secret,
    nowMilliseconds,
    randomBytes
  });
  try {
    const result = await postEnvelope({
      body: attempt.requestBody,
      endpoint: configuration.endpoint,
      fetchImpl,
      setTimer,
      clearTimer,
      timeoutMilliseconds
    });
    safeLog(logger, formName, result.outcome, result.reason);
    if (result.ok) {
      await deleteOutboxRecord(store, attempt.key);
      return 'DELIVERED';
    }
    attempt = await markOutboxFailure({
      store,
      attempt,
      reason: result.reason,
      permanent: true,
      nowMilliseconds
    });
  } catch (error) {
    const controlled = error instanceof SubmissionRelayError
      ? error
      : new SubmissionRelayError('upstream_network_error', 502);
    attempt = await markOutboxFailure({
      store,
      attempt,
      reason: controlled.code,
      permanent: false,
      nowMilliseconds
    });
  }
  attempt = await alertIfNeeded({
    attempt,
    alertImpl,
    environment,
    fetchImpl,
    nowMilliseconds,
    store
  });
  safeLog(logger, formName, attempt.state, attempt.metadata.last_reason);
  return attempt.state;
}

function createRetryHandler({
  environment = process.env,
  fetchImpl = globalThis.fetch,
  logger = productionLogger,
  now = () => Date.now(),
  randomBytes = crypto.randomBytes,
  blobsImport,
  storeFactory,
  alertImpl = productionAlert,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  timeoutMilliseconds = PROTOCOL.timeoutMilliseconds
} = {}) {
  const resolvedStoreFactory = typeof storeFactory === 'function'
    ? storeFactory
    : createProductionStoreFactory({ environment, blobsImport });
  return async function huffSherpaRelayRetryHandler(event) {
    requireProductionContext(environment);
    const configuration = validateConfiguration(environment);
    const store = await requireOutboxStore(resolvedStoreFactory, true, event);
    let listing;
    try {
      listing = await store.list({ prefix: OUTBOX.keyPrefix });
    } catch (error) {
      throw new SubmissionRelayError(
        'outbox_unavailable',
        503,
        error instanceof SubmissionRelayError ? error.causeCode : controlledErrorCause(error)
      );
    }
    const blobs = listing && Array.isArray(listing.blobs) ? listing.blobs : [];
    const nowMilliseconds = Number(now());
    const due = [];
    for (const item of blobs) {
      if (!item || typeof item.key !== 'string' || !item.key.startsWith(OUTBOX.keyPrefix)) continue;
      let record;
      try {
        record = await readOutboxRecord(store, item.key);
        if (!record) continue;
        const metadata = record.metadata || {};
        const state = String(metadata.state || 'PENDING');
        const metadataFormName = relaySchema.formNames.includes(metadata.form_name)
          ? metadata.form_name
          : null;
        if (metadata.pii_purged === 'true') {
          if (state !== 'FAILED' || !metadataFormName) fail('outbox_record_invalid', 503);
          continue;
        }
        const storedPayload = parseStoredPayload(record.data);
        const formName = relaySchema.formNames.includes(storedPayload.form_name)
          ? storedPayload.form_name
          : null;
        if (!formName) fail('outbox_record_invalid', 503);
        const expiresAt = readOutboxDate(metadata, 'expires_at', 0);
        if (!expiresAt || expiresAt <= nowMilliseconds) {
          await purgeExpiredOutboxPayload({
            alertImpl,
            environment,
            fetchImpl,
            formName,
            key: item.key,
            metadata,
            nowMilliseconds,
            payload: storedPayload,
            store,
            storedData: record.data
          });
          safeLog(logger, formName, 'FAILED', 'retention_expired');
          continue;
        }
        if (state === 'QUARANTINED' || state === 'FAILED') {
          await alertIfNeeded({
            attempt: Object.freeze({
              key: item.key,
              metadata,
              payload: storedPayload,
              state,
              storedData: record.data
            }),
            alertImpl,
            environment,
            fetchImpl,
            nowMilliseconds,
            store
          });
          continue;
        }
        if (state !== 'ATTEMPTING' && state !== 'PENDING') fail('outbox_record_invalid', 503);
        const nextAttemptAt = readOutboxDate(metadata, 'next_attempt_at', 0);
        if (state === 'ATTEMPTING' || state === 'PENDING' && nextAttemptAt <= nowMilliseconds) {
          due.push(record);
          if (due.length >= OUTBOX.maximumBatchSize) break;
        }
      } catch (error) {
        const reason = error instanceof SubmissionRelayError ? error.code : 'relay_internal_error';
        safeLog(logger, null, 'FAILED', reason);
      }
    }
    const outcomes = await Promise.all(due.map((record) => retryStoredAttempt({
      record,
      configuration,
      store,
      environment,
      fetchImpl,
      logger,
      now,
      randomBytes,
      alertImpl,
      setTimer,
      clearTimer,
      timeoutMilliseconds
    })));
    return response(200, {
      ok: true,
      outcome: 'RECONCILED',
      processed: outcomes.length
    });
  };
}

exports.handler = createSubmissionCreatedHandler();
exports.createSubmissionCreatedHandler = createSubmissionCreatedHandler;
exports.createRetryHandler = createRetryHandler;
exports._test = Object.freeze({
  OUTBOX,
  PROTOCOL,
  SubmissionRelayError,
  alertIfNeeded,
  buildEnvelope,
  canonicalJson,
  controlledErrorCause,
  createProductionStoreFactory,
  explicitBlobsStoreOptions,
  markOutboxFailure,
  normalizeRelayData,
  outboxKey,
  parseStoredPayload,
  parseNetlifyEvent,
  parseUpstreamResponse,
  prepareOutboxAttempt,
  retryDelay,
  requireProductionContext,
  validateConfiguration,
  validateContentServiceRedirect,
  validateHmacSecret
});
