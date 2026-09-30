'use strict';

/**
 * Legacy Netlify Forms event function.
 *
 * Netlify invokes this file after a submission has already been accepted and
 * retained. Allowlisted sales/service forms are minimized and posted to
 * `{LEAD_BRIDGE_URL}/website/lead` when `LEAD_BRIDGE_URL` and
 * `LEAD_BRIDGE_KEY` are set. A failed bridge POST is written to the
 * `website-lead-bridge-outbox-v1` Blobs store and retried by
 * `lead-bridge-retry`.
 *
 * Missing bridge configuration skips delivery without changing Netlify Forms
 * storage. Bridge failures never change Forms storage. This path never texts
 * or emails a lead. NOTIFY_EMAIL and meta-lead-webhook remain independent of
 * this function.
 *
 * Preview, branch, and explicit non-production CONTEXT values fail closed.
 *
 * This file is a Lambda-compatibility handler (`exports.handler`).
 */

const { relaySchema } = require('./lead.js');
const { buildWebsiteLeadPayload, deliverWebsiteLead } = require('./lib/lead-bridge');

const PROTOCOL = Object.freeze({
  maximumEventBytes: 64 * 1024
});

const SUBMISSION_ID = /^[a-f0-9]{24}$/i;
const CONTROL_TEXT = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
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
  const createdAt = normalizeTimestamp(submission.created_at);
  const websiteLead = buildWebsiteLeadPayload({
    formName,
    submissionId,
    createdAt,
    data: submission.data,
    filtered: filtered.payload
  });
  if (!websiteLead) fail('contact_point_required', 400);
  return Object.freeze({
    eligible: true,
    formName,
    websiteLead
  });
}

function requireProductionContext(environment) {
  const siteEnv = String(environment.LHI_SITE_ENV || '').trim();
  const buildContext = String(environment.CONTEXT || '').trim();
  // Netlify Forms event functions often omit CONTEXT.
  // LHI_SITE_ENV=production is the runtime gate. Empty CONTEXT is allowed.
  // Explicit non-production CONTEXT values fail closed.
  if (
    siteEnv !== 'production'
    || (buildContext && buildContext !== 'production')
  ) {
    fail('production_context_required', 503);
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
  if (entry.outcome === 'FAILED') {
    console.error(line);
  } else {
    console.info(line);
  }
}

function safeLog(logger, formName, outcome, reason, cause) {
  const entry = {
    event: 'website_form_lead_relay',
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

function createSubmissionCreatedHandler({
  environment = process.env,
  fetchImpl = globalThis.fetch,
  logger = productionLogger,
  now = () => Date.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  timeoutMilliseconds,
  bridgeStoreFactory,
  bridgeBlobsImport
} = {}) {
  return async function submissionCreatedHandler(event) {
    let formName = null;
    try {
      const normalized = parseNetlifyEvent(event);
      if (!normalized.eligible) {
        safeLog(logger, null, 'SKIPPED', 'newsletter_form');
        return response(200, { ok: true, outcome: 'SKIPPED' });
      }
      formName = normalized.formName;
      requireProductionContext(environment);
      const delivery = await deliverWebsiteLead({
        lead: normalized.websiteLead,
        environment,
        fetchImpl,
        logger,
        now,
        event,
        storeFactory: bridgeStoreFactory,
        blobsImport: bridgeBlobsImport,
        setTimer,
        clearTimer,
        timeoutMilliseconds
      });
      const reason = delivery && delivery.skipped
        ? delivery.reason
        : delivery && delivery.ok
          ? 'direct'
          : delivery && delivery.queued
            ? 'queued'
            : delivery && delivery.reason || 'bridge_failed';
      safeLog(logger, formName, 'ACCEPTED', reason);
      return response(200, { ok: true, outcome: 'ACCEPTED' });
    } catch (error) {
      const controlled = error instanceof SubmissionRelayError
        ? error
        : new SubmissionRelayError('relay_internal_error', 500);
      const failureCause = CAUSE_TOKEN.test(String(controlled.causeCode || ''))
        ? controlled.causeCode
        : undefined;
      safeLog(logger, formName, 'FAILED', controlled.code, failureCause);
      // Netlify ignores event-function response values. Rejecting the
      // invocation makes an eligible lead delivery failure visible in the
      // Functions UI/logs. The original Netlify Forms submission remains
      // the source of truth.
      throw new SubmissionRelayError(controlled.code, controlled.statusCode, failureCause);
    }
  };
}

exports.handler = createSubmissionCreatedHandler();
exports.createSubmissionCreatedHandler = createSubmissionCreatedHandler;
exports._test = Object.freeze({
  PROTOCOL,
  SubmissionRelayError,
  parseNetlifyEvent,
  requireProductionContext
});
