const crypto = require('crypto');

const HONEYPOT_FIELD_NAMES = ['bot-field'];
const HUMAN_CHECK_SECRET = 'lakeland-human';
const GET_HELP_FORM = 'get-help';
const MIN_SUBMIT_MS_DEFAULT = 2000;
const MIN_SUBMIT_MS_GET_HELP = 1200;
const MAX_SUBMIT_AGE_MS = 2 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 40;
const RATE_LIMIT_BURST_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_BURST_MAX = 8;

const rateLimitBuckets = new Map();

function hashIdentifier(value, salt = 'lhi-lead-spam-v1') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  return crypto.createHash('sha256').update(`${salt}:${normalized}`).digest('hex').slice(0, 16);
}

function extractClientIp(headers = {}) {
  const nf = String(headers['x-nf-client-connection-ip'] || headers['X-Nf-Client-Connection-Ip'] || '').trim();
  if (nf) return nf;
  const forwarded = String(headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '').trim();
  if (!forwarded) return null;
  const first = forwarded.split(',')[0].trim();
  return first || null;
}

function pruneRateLimitBucket(bucket, now) {
  if (!bucket) return { hits: [], burst: [] };
  bucket.hits = bucket.hits.filter((ts) => now - ts <= RATE_LIMIT_WINDOW_MS);
  bucket.burst = bucket.burst.filter((ts) => now - ts <= RATE_LIMIT_BURST_WINDOW_MS);
  return bucket;
}

function checkRateLimit(headers) {
  const ip = extractClientIp(headers);
  if (!ip) return { limited: false, ipHash: null };

  const ipHash = hashIdentifier(ip, 'lhi-lead-ip-v1');
  const now = Date.now();
  const bucket = pruneRateLimitBucket(rateLimitBuckets.get(ipHash) || { hits: [], burst: [] }, now);
  bucket.burst.push(now);
  bucket.hits.push(now);
  rateLimitBuckets.set(ipHash, bucket);

  if (bucket.burst.length > RATE_LIMIT_BURST_MAX || bucket.hits.length > RATE_LIMIT_MAX_REQUESTS) {
    return { limited: true, ipHash };
  }
  return { limited: false, ipHash };
}

function honeypotFilled(payload) {
  return HONEYPOT_FIELD_NAMES.some((key) => String(payload[key] || '').trim());
}

function spamGuardFieldMissing(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function isLegacySpamGuardClient(payload) {
  return spamGuardFieldMissing(payload.started_at) && spamGuardFieldMissing(payload.human_check);
}

function validateHumanTiming(payload, formName) {
  if (isLegacySpamGuardClient(payload)) {
    return { ok: true, legacy: true };
  }

  const startedAt = Number(payload.started_at);
  const humanCheck = String(payload.human_check || '');
  const expectedCheck = Buffer.from(`${payload.started_at}:${HUMAN_CHECK_SECRET}`).toString('base64');
  const minMs = formName === GET_HELP_FORM ? MIN_SUBMIT_MS_GET_HELP : MIN_SUBMIT_MS_DEFAULT;

  if (!Number.isFinite(startedAt) || !humanCheck || humanCheck !== expectedCheck) {
    return { ok: false, reason: 'human_check_failed' };
  }

  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs < minMs) return { ok: false, reason: 'submitted_too_quickly' };
  if (elapsedMs > MAX_SUBMIT_AGE_MS) return { ok: false, reason: 'stale_submission' };
  return { ok: true, elapsedMs };
}

function extractEmailForHash(payload) {
  return payload.email || payload.email_address || null;
}

function evaluateLeadSpam(payload, formName, headers) {
  const emailHash = hashIdentifier(extractEmailForHash(payload));
  const rate = checkRateLimit(headers);

  if (honeypotFilled(payload)) {
    return { spam: true, reason: 'honeypot_filled', emailHash, ipHash: rate.ipHash };
  }

  const timing = validateHumanTiming(payload, formName);
  if (!timing.ok) {
    return { spam: true, reason: timing.reason, emailHash, ipHash: rate.ipHash };
  }

  if (rate.limited) {
    return { spam: true, reason: 'rate_limited', ipHash: rate.ipHash, emailHash };
  }

  return {
    spam: false,
    ipHash: rate.ipHash,
    emailHash,
    elapsedMs: timing.elapsedMs
  };
}

function buildSpamDropLog(formName, eventId, evaluation, context = {}) {
  return {
    type: 'lead_spam_drop_v1',
    event_id: eventId,
    day: new Date().toISOString().slice(0, 10),
    context: context.netlifyContext || 'unknown',
    form: String(formName || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown',
    reason: evaluation.reason || 'unknown',
    ip_hash: evaluation.ipHash || null,
    email_hash: evaluation.emailHash || null
  };
}

module.exports = {
  HONEYPOT_FIELD_NAMES,
  MIN_SUBMIT_MS_DEFAULT,
  MIN_SUBMIT_MS_GET_HELP,
  evaluateLeadSpam,
  buildSpamDropLog,
  hashIdentifier,
  extractClientIp,
  validateHumanTiming,
  honeypotFilled,
  _test: {
    checkRateLimit,
    pruneRateLimitBucket,
    rateLimitBuckets
  }
};
