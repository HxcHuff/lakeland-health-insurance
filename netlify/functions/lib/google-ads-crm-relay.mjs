import crypto from "node:crypto";

export const RELAY_PROTOCOL = Object.freeze({
  envelopeSource: "google_ads",
  envelopeVersion: 1,
  eventType: "google_ads_lead_form_accepted",
  maximumRequestBytes: 64 * 1024,
  maximumResponseBytes: 4096,
  nonceBytes: 32,
  timeoutMilliseconds: 8000,
});

export const OUTBOX = Object.freeze({
  storeName: "google-ads-crm-relay-outbox-v1",
  keyPrefix: "lead/",
  scanCursorKey: "control/reconcile-cursor-v1",
  maximumAttempts: 12,
  maximumBatchSize: 10,
  maximumScanSize: 32,
  maximumConcurrentRecordReads: 8,
  maximumConcurrentMaintenanceActions: 5,
  maximumListedKeysPerShard: 128,
  maximumPagesPerShard: 1,
  maximumMaintenanceActions: 25,
  retryBaseMilliseconds: 15 * 60 * 1000,
  retryMaximumMilliseconds: 6 * 60 * 60 * 1000,
  retentionMilliseconds: 7 * 24 * 60 * 60 * 1000,
  tombstoneRetentionMilliseconds: 30 * 24 * 60 * 60 * 1000,
  attemptLeaseMilliseconds: 10 * 60 * 1000,
  deletionLeaseMilliseconds: 5 * 60 * 1000,
});

export const GOOGLE_ADS_ROUTING = Object.freeze({
  accountId: "7880085811",
  accountIdEnv: "GOOGLE_ADS_ACCOUNT_ID",
  formAllowlistEnv: "GOOGLE_LEAD_FORM_ID_ALLOWLIST",
  formIds: Object.freeze(["357496832026", "398917236265"]),
  siteId: "b6ad2d8f-d771-44f4-89b5-7ab30350950e",
  webhookKeyEnvByFormId: Object.freeze({
    "357496832026": "GOOGLE_LEAD_WEBHOOK_KEY_357496832026",
    "398917236265": "GOOGLE_LEAD_WEBHOOK_KEY_398917236265",
  }),
});

const MAX_COLUMN_COUNT = 100;
const MAX_COLUMN_ID_BYTES = 128;
const MAX_COLUMN_VALUE_BYTES = 8 * 1024;
const MAX_LEAD_ID_BYTES = 512;
const CONTROL_TEXT = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const CLICK_ID = /^[A-Za-z0-9._~-]{1,512}$/;
const ADS_ID = /^\d{1,32}$/;
const CAMPAIGN_ID = /^\d{1,20}$/;
const DEPLOYMENT_ID = /^[A-Za-z0-9_-]{20,200}$/;
const HMAC_SECRET = /^[A-Za-z0-9_-]{64}$/;
const GOOGLE_WEBHOOK_KEY_MINIMUM_BYTES = 32;
const GOOGLE_WEBHOOK_KEY_MAXIMUM_BYTES = 512;
const PLACEHOLDER_SECRET = /(?:placeholder|changeme|replace[_-]me|example[_-]secret|your[_-]secret|test[_-]secret)/iu;
const OPERATIONAL_SUCCESS_OUTCOMES = new Set(["STAGED", "REPLAY_NOOP"]);
const TEST_SUCCESS_OUTCOMES = new Set(["TEST_ACKNOWLEDGED"]);
const FAILURE_OUTCOMES = new Set(["CONFLICT_QUARANTINED", "REJECTED"]);
const TRANSIENT_RESPONSE_REASONS = new Set([
  "google_ads_account_not_allowlisted",
  "google_ads_form_not_allowlisted",
  "google_ads_identity_mismatch",
  "hmac_secret_unavailable",
  "invalid_event_type",
  "invalid_google_ads_event",
  "invalid_google_ads_payload",
  "invalid_request",
  "invalid_source_fingerprint",
  "invalid_webhook_body",
  "invalid_webhook_envelope",
  "invalid_webhook_signature",
  "lead_formula_mismatch",
  "potential_match_formula_missing",
  "staging_sheet_missing",
  "staging_capacity_exhausted",
  "staging_headers_mismatch",
  "staging_lock_unavailable",
  "staging_row_race",
  "stale_webhook_envelope",
  "test_payload_rejected",
]);
const CONTROLLED_RESPONSE_REASONS = new Set([
  "ambiguous_click_id",
  "attribution_evidence_stale",
  "contact_point_required",
  "duplicate_existing_source_id",
  "form_not_allowlisted",
  "google_ads_account_not_allowlisted",
  "google_ads_form_not_allowlisted",
  "google_ads_identity_mismatch",
  "hmac_secret_unavailable",
  "invalid_attribution_evidence",
  "invalid_attribution_evidence_hmac",
  "invalid_click_id",
  "invalid_email",
  "invalid_event_type",
  "invalid_google_ads_data",
  "invalid_google_ads_campaign_id",
  "invalid_google_ads_event",
  "invalid_google_ads_id",
  "invalid_google_ads_lead_id",
  "invalid_google_ads_payload",
  "invalid_lead_id",
  "invalid_linked_lead_id",
  "invalid_netlify_data",
  "invalid_netlify_payload",
  "invalid_phone",
  "invalid_postal_code",
  "invalid_request",
  "invalid_source_fingerprint",
  "invalid_source_id",
  "invalid_staging_record",
  "invalid_text",
  "invalid_timestamp",
  "invalid_webhook_body",
  "invalid_webhook_envelope",
  "invalid_webhook_signature",
  "lead_attribution_conflict",
  "lead_formula_mismatch",
  "lead_headers_mismatch",
  "lead_identity_mismatch",
  "lead_match_ambiguous",
  "lead_match_missing",
  "netlify_event_not_accepted",
  "potential_match_formula_missing",
  "reconciliation_snapshot_drift",
  "source_id_payload_drift",
  "staging_capacity_exhausted",
  "staging_headers_mismatch",
  "staging_lock_unavailable",
  "staging_row_race",
  "staging_sheet_missing",
  "stale_webhook_envelope",
  "test_payload_rejected",
]);
const STORED_REASON_CODES = new Set([
  "",
  ...OPERATIONAL_SUCCESS_OUTCOMES,
  ...CONTROLLED_RESPONSE_REASONS,
  "clock_unavailable",
  "google_ads_routing_configuration_unavailable",
  "google_webhook_configuration_unavailable",
  "nonce_unavailable",
  "outbox_record_invalid",
  "relay_configuration_invalid",
  "relay_configuration_unavailable",
  "relay_secret_must_be_independent",
  "request_body_too_large",
  "retention_expired",
  "tombstone_expired",
  "retry_limit_exhausted",
  "upstream_network_error",
  "upstream_redirect_rejected",
  "upstream_response_unsafe",
  "upstream_timeout",
]);
const APPROVED_COLUMN_IDS = new Set([
  "FIRST_NAME",
  "LAST_NAME",
  "FULL_NAME",
  "EMAIL",
  "PHONE_NUMBER",
  "POSTAL_CODE",
]);
const PAYLOAD_KEYS = Object.freeze([
  "account_id",
  "adgroup_id",
  "asset_group_id",
  "campaign_id",
  "creative_id",
  "email",
  "event_type",
  "first_name",
  "form_id",
  "gcl_id",
  "is_test",
  "last_name",
  "lead_id",
  "lead_source",
  "lead_stage",
  "lead_submit_time",
  "phone_number",
  "postal_code",
]);
const RECORD_KEYS = Object.freeze([
  "attempt_count",
  "created_at",
  "expires_at",
  "incoming_payload_sha256",
  "last_reason",
  "next_attempt_at",
  "payload",
  "payload_sha256",
  "state",
  "terminal_at",
  "updated_at",
  "version",
]);
const SCAN_CURSOR_KEYS = Object.freeze(["cursor", "updated_at", "version"]);
const RECORD_STATES = new Set(["PENDING", "ATTEMPTING", "CLOSED", "QUARANTINED", "FAILED", "DELETING"]);
const KEY_DOMAIN = "lakeland-google-ads-crm-relay-key-v1\0";
const PAYLOAD_DIGEST_DOMAIN = "lakeland-google-ads-crm-relay-payload-v1\0";
const INVALID_RECORD_DIGEST_DOMAIN = "lakeland-google-ads-crm-relay-invalid-record-v1\0";
const OUTBOX_KEY = /^lead\/[a-f0-9]{64}$/;
const OUTBOX_SHARDS = Object.freeze("0123456789abcdef".split(""));

export class GoogleAdsRelayError extends Error {
  constructor(code, statusCode = 502) {
    super(code);
    this.name = "GoogleAdsRelayError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function fail(code, statusCode) {
  throw new GoogleAdsRelayError(code, statusCode);
}

function isRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function utf8Length(value) {
  return Buffer.byteLength(String(value), "utf8");
}

function exactKeys(value, keys) {
  return isRecord(value) && Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.byteLength !== right.byteLength) return false;
  return crypto.timingSafeEqual(left, right);
}

function exactBoundedText(value, maximumBytes, required = false) {
  if (typeof value !== "string") fail("invalid_google_ads_payload", 400);
  if (value !== value.trim() || utf8Length(value) > maximumBytes || CONTROL_TEXT.test(value)) {
    fail("invalid_google_ads_payload", 400);
  }
  if (required && value.length === 0) fail("invalid_google_ads_payload", 400);
  return value;
}

function normalizedContactText(value, maximumBytes) {
  const normalized = String(value || "").normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (utf8Length(normalized) > maximumBytes || CONTROL_TEXT.test(normalized)) {
    fail("invalid_user_column_data", 400);
  }
  return normalized;
}

function normalizeEmail(value) {
  const email = normalizedContactText(value, 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    fail("invalid_user_column_data", 400);
  }
  return email;
}

function normalizePhone(value) {
  const phone = normalizedContactText(value, 32);
  if (!phone) return "";
  if (!/^[0-9+(). x-]+$/u.test(phone)) fail("invalid_user_column_data", 400);
  let digits = phone.replace(/\D/gu, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) fail("invalid_user_column_data", 400);
  return digits;
}

function normalizePostalCode(value) {
  const postalCode = normalizedContactText(value, 10);
  if (postalCode && !/^\d{5}(?:-\d{4})?$/.test(postalCode)) {
    fail("invalid_user_column_data", 400);
  }
  return postalCode;
}

function normalizeAdsId(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) fail("invalid_google_ads_payload", 400);
    value = String(value);
  }
  if (typeof value !== "string" || !ADS_ID.test(value)) fail("invalid_google_ads_payload", 400);
  return value;
}

function normalizeCampaignId(value) {
  const campaignId = normalizeAdsId(value);
  if (campaignId && !CAMPAIGN_ID.test(campaignId)) fail("invalid_google_ads_payload", 400);
  return campaignId;
}

function normalizeClickId(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || !CLICK_ID.test(value)) fail("invalid_google_ads_payload", 400);
  return value;
}

function normalizeLeadSubmitTime(value) {
  const text = exactBoundedText(value, 40, true);
  if (!Number.isFinite(Date.parse(text))) fail("invalid_google_ads_payload", 400);
  return text;
}

function normalizeOptionalSourceField(value) {
  if (value === undefined || value === null) return "";
  return exactBoundedText(value, 64, false);
}

function normalizeLeadSource(value) {
  const source = exactBoundedText(value, 64, true);
  if (source !== "LEAD_FORM" && source !== "CONVERSATIONAL_AGENT") {
    fail("invalid_google_ads_payload", 400);
  }
  return source;
}

function normalizeLeadId(value) {
  return exactBoundedText(value, MAX_LEAD_ID_BYTES, true);
}

function normalizeColumnData(value) {
  if (!Array.isArray(value) || value.length > MAX_COLUMN_COUNT) {
    fail("invalid_user_column_data", 400);
  }
  const approved = Object.create(null);
  for (const item of value) {
    if (!isRecord(item) || typeof item.column_id !== "string") {
      fail("invalid_user_column_data", 400);
    }
    const columnId = exactBoundedText(item.column_id, MAX_COLUMN_ID_BYTES, true).toUpperCase();
    if (item.string_value !== undefined && typeof item.string_value !== "string") {
      fail("invalid_user_column_data", 400);
    }
    if (typeof item.string_value === "string" && utf8Length(item.string_value) > MAX_COLUMN_VALUE_BYTES) {
      fail("invalid_user_column_data", 400);
    }
    if (!APPROVED_COLUMN_IDS.has(columnId)) continue;
    if (Object.prototype.hasOwnProperty.call(approved, columnId)) {
      fail("invalid_user_column_data", 400);
    }
    approved[columnId] = item.string_value || "";
  }

  const fullName = normalizedContactText(approved.FULL_NAME, 200);
  const fullNameParts = fullName ? fullName.split(" ") : [];
  const firstName = normalizedContactText(
    normalizedContactText(approved.FIRST_NAME, 100) || fullNameParts[0] || "",
    100,
  );
  const lastName = normalizedContactText(
    normalizedContactText(approved.LAST_NAME, 100) || fullNameParts.slice(1).join(" "),
    100,
  );
  const email = normalizeEmail(approved.EMAIL);
  const phoneNumber = normalizePhone(approved.PHONE_NUMBER);
  const postalCode = normalizePostalCode(approved.POSTAL_CODE);
  if (!email && !phoneNumber) fail("contact_point_required", 400);

  return Object.freeze({
    first_name: firstName,
    last_name: lastName,
    email,
    phone_number: phoneNumber,
    postal_code: postalCode,
  });
}

function configuredValue(env, key, errorCode) {
  let value;
  try {
    value = env(key);
  } catch {
    fail(errorCode, 503);
  }
  return typeof value === "string" ? value : String(value || "");
}

function validateGoogleWebhookKey(value) {
  if (
    typeof value !== "string"
    || value !== value.trim()
    || utf8Length(value) < GOOGLE_WEBHOOK_KEY_MINIMUM_BYTES
    || utf8Length(value) > GOOGLE_WEBHOOK_KEY_MAXIMUM_BYTES
    || CONTROL_TEXT.test(value)
    || PLACEHOLDER_SECRET.test(value)
    || new Set(value).size < 16
    || repeatedSecretPattern(value)
  ) {
    fail("google_webhook_configuration_unavailable", 503);
  }
  return value;
}

export function validateGoogleAdsConfiguration(env) {
  if (typeof env !== "function") fail("google_ads_routing_configuration_unavailable", 503);
  const accountId = configuredValue(env, GOOGLE_ADS_ROUTING.accountIdEnv, "google_ads_routing_configuration_unavailable");
  if (accountId !== GOOGLE_ADS_ROUTING.accountId) {
    fail("google_ads_routing_configuration_unavailable", 503);
  }
  const formAllowlist = configuredValue(
    env,
    GOOGLE_ADS_ROUTING.formAllowlistEnv,
    "google_ads_routing_configuration_unavailable",
  );
  if (formAllowlist !== GOOGLE_ADS_ROUTING.formIds.join(",")) {
    fail("google_ads_routing_configuration_unavailable", 503);
  }

  const webhookKeysByFormId = Object.create(null);
  for (const formId of GOOGLE_ADS_ROUTING.formIds) {
    const envName = GOOGLE_ADS_ROUTING.webhookKeyEnvByFormId[formId];
    webhookKeysByFormId[formId] = validateGoogleWebhookKey(
      configuredValue(env, envName, "google_webhook_configuration_unavailable"),
    );
  }
  if (safeEqual(
    webhookKeysByFormId[GOOGLE_ADS_ROUTING.formIds[0]],
    webhookKeysByFormId[GOOGLE_ADS_ROUTING.formIds[1]],
  )) {
    fail("google_webhook_configuration_unavailable", 503);
  }
  return Object.freeze({
    accountId,
    formIds: GOOGLE_ADS_ROUTING.formIds,
    webhookKeysByFormId: Object.freeze(webhookKeysByFormId),
  });
}

export function googleWebhookKeyForPayload(payload, configuration) {
  if (!isRecord(payload) || !configuration || !isRecord(configuration.webhookKeysByFormId)) {
    fail("invalid_google_ads_payload", 400);
  }
  const formId = normalizeAdsId(payload.form_id);
  if (!configuration.formIds.includes(formId)) fail("google_ads_form_not_approved", 403);
  return configuration.webhookKeysByFormId[formId];
}

export function authenticateGooglePayload(payload, expectedKey) {
  if (!isRecord(payload)) fail("invalid_google_ads_payload", 400);
  if (!expectedKey) fail("google_webhook_configuration_unavailable", 500);
  if (!safeEqual(payload.google_key, expectedKey)) fail("invalid_google_key", 403);
}

export function normalizeGoogleAdsPayload(payload, configuration) {
  if (!isRecord(payload) || (payload.is_test !== undefined && typeof payload.is_test !== "boolean")) {
    fail("invalid_google_ads_payload", 400);
  }
  if (
    !configuration
    || configuration.accountId !== GOOGLE_ADS_ROUTING.accountId
    || configuration.formIds !== GOOGLE_ADS_ROUTING.formIds
  ) {
    fail("google_ads_routing_configuration_unavailable", 503);
  }
  if (payload.api_version !== undefined) exactBoundedText(payload.api_version, 32, true);
  const contact = normalizeColumnData(payload.user_column_data);
  const formId = normalizeAdsId(payload.form_id);
  if (!configuration.formIds.includes(formId)) fail("google_ads_form_not_approved", 403);
  const normalized = Object.freeze({
    account_id: configuration.accountId,
    event_type: RELAY_PROTOCOL.eventType,
    lead_id: normalizeLeadId(payload.lead_id),
    lead_submit_time: normalizeLeadSubmitTime(payload.lead_submit_time),
    gcl_id: normalizeClickId(payload.gcl_id),
    form_id: formId,
    campaign_id: normalizeCampaignId(payload.campaign_id),
    adgroup_id: normalizeAdsId(payload.adgroup_id),
    creative_id: normalizeAdsId(payload.creative_id),
    asset_group_id: normalizeAdsId(payload.asset_group_id),
    lead_source: normalizeLeadSource(payload.lead_source),
    lead_stage: normalizeOptionalSourceField(payload.lead_stage),
    is_test: payload.is_test === true,
    ...contact,
  });
  if (!exactKeys(normalized, PAYLOAD_KEYS)) fail("invalid_google_ads_payload", 400);
  return normalized;
}

function repeatedSecretPattern(secret) {
  return [1, 2, 4, 8, 16, 32].some((length) => secret === secret.slice(0, length).repeat(secret.length / length));
}

export function validateHmacSecret(value) {
  if (typeof value !== "string" || value !== value.trim() || !HMAC_SECRET.test(value)) {
    fail("relay_configuration_unavailable", 503);
  }
  let decoded;
  try {
    decoded = Buffer.from(value, "base64url");
  } catch {
    fail("relay_configuration_unavailable", 503);
  }
  if (
    decoded.byteLength !== 48
    || decoded.toString("base64url") !== value
    || new Set(value).size < 16
    || PLACEHOLDER_SECRET.test(value)
    || repeatedSecretPattern(value)
  ) {
    fail("relay_configuration_unavailable", 503);
  }
  return value;
}

export function requireProductionContext(env) {
  const buildContext = env("CONTEXT");
  if (
    env("LHI_SITE_ENV") !== "production"
    || env("SITE_ID") !== GOOGLE_ADS_ROUTING.siteId
    || (buildContext && buildContext !== "production")
  ) {
    fail("production_context_required", 503);
  }
}

export function validateRelayConfiguration(env, googleWebhookKeys = []) {
  const endpoint = String(env("HUFFSHERPA_LEAD_WEBHOOK_URL_V1") || "").trim();
  const secret = validateHmacSecret(env("HUFFSHERPA_LEAD_WEBHOOK_HMAC_SECRET_V1"));
  const intakeKeys = Array.isArray(googleWebhookKeys) ? googleWebhookKeys : [googleWebhookKeys];
  if (intakeKeys.some((key) => key && safeEqual(secret, key))) {
    fail("relay_secret_must_be_independent", 503);
  }
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    fail("relay_configuration_invalid", 503);
  }
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (
    parsed.protocol !== "https:"
    || parsed.hostname !== "script.google.com"
    || parsed.port
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || segments.length !== 4
    || segments[0] !== "macros"
    || segments[1] !== "s"
    || !DEPLOYMENT_ID.test(segments[2])
    || segments[3] !== "exec"
    || parsed.href !== endpoint
  ) {
    fail("relay_configuration_invalid", 503);
  }
  return Object.freeze({ endpoint, secret });
}

export function buildEnvelope(payload, secret, nowMilliseconds, randomBytes = crypto.randomBytes) {
  if (!Number.isFinite(nowMilliseconds)) fail("clock_unavailable", 503);
  const nonceMaterial = randomBytes(RELAY_PROTOCOL.nonceBytes);
  if (!(nonceMaterial instanceof Uint8Array) || nonceMaterial.byteLength !== RELAY_PROTOCOL.nonceBytes) {
    fail("nonce_unavailable", 503);
  }
  const unsigned = Object.freeze({
    version: RELAY_PROTOCOL.envelopeVersion,
    source: RELAY_PROTOCOL.envelopeSource,
    issuedAt: new Date(nowMilliseconds).toISOString(),
    nonce: Buffer.from(nonceMaterial).toString("base64url"),
    payload,
  });
  const signature = crypto.createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(canonicalJson(unsigned), "utf8")
    .digest("base64url");
  const body = canonicalJson(Object.freeze({ ...unsigned, signature }));
  if (utf8Length(body) > RELAY_PROTOCOL.maximumRequestBytes) fail("request_body_too_large", 400);
  return body;
}

function validateContentServiceRedirect(response) {
  if (!response || response.redirected || (response.status !== 302 && response.status !== 303)) {
    fail("upstream_redirect_rejected");
  }
  const location = String(response.headers?.get?.("location") || "");
  if (!location || location.length > 4096) fail("upstream_redirect_rejected");
  let parsed;
  try {
    parsed = new URL(location);
  } catch {
    fail("upstream_redirect_rejected");
  }
  const queryKeys = [...parsed.searchParams.keys()];
  if (
    parsed.protocol !== "https:"
    || parsed.hostname !== "script.googleusercontent.com"
    || parsed.port
    || parsed.username
    || parsed.password
    || parsed.hash
    || !parsed.pathname.startsWith("/")
    || parsed.pathname.length > 2048
    || parsed.search.length > 2048
    || queryKeys.length > 32
  ) {
    fail("upstream_redirect_rejected");
  }
  return parsed.href;
}

async function boundedResponseText(response) {
  if (!response || response.redirected || response.status !== 200 || !response.headers?.get) {
    fail("upstream_response_unsafe");
  }
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const cacheControl = String(response.headers.get("cache-control") || "").toLowerCase();
  if (!/^application\/json(?:\s*;|$)/u.test(contentType)) fail("upstream_response_unsafe");
  if (/(?:^|,)\s*public(?:\s*(?:,|$))/u.test(cacheControl) || /max-age\s*=\s*[1-9]/u.test(cacheControl)) {
    fail("upstream_response_unsafe");
  }
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > RELAY_PROTOCOL.maximumResponseBytes)) {
    fail("upstream_response_unsafe");
  }
  if (!response.body?.getReader) fail("upstream_response_unsafe");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    if (!(part.value instanceof Uint8Array)) fail("upstream_response_unsafe");
    total += part.value.byteLength;
    if (total > RELAY_PROTOCOL.maximumResponseBytes) {
      try { await reader.cancel(); } catch {}
      fail("upstream_response_unsafe");
    }
    chunks.push(part.value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(combined);
  } catch {
    fail("upstream_response_unsafe");
  }
}

export function parseUpstreamResponse(text, testMode) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail("upstream_response_unsafe");
  }
  if (!exactKeys(value, ["ok", "outcome", "reason"]) || typeof value.ok !== "boolean") {
    fail("upstream_response_unsafe");
  }
  const permittedSuccess = testMode ? TEST_SUCCESS_OUTCOMES : OPERATIONAL_SUCCESS_OUTCOMES;
  if (permittedSuccess.has(value.outcome)) {
    if (!value.ok || value.reason !== null) fail("upstream_response_unsafe");
    return Object.freeze(value);
  }
  if (
    FAILURE_OUTCOMES.has(value.outcome)
    && !value.ok
    && typeof value.reason === "string"
    && CONTROLLED_RESPONSE_REASONS.has(value.reason)
  ) {
    return Object.freeze(value);
  }
  fail("upstream_response_unsafe");
}

export async function postEnvelope({
  body,
  endpoint,
  fetchImpl = globalThis.fetch,
  testMode = false,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  timeoutMilliseconds = RELAY_PROTOCOL.timeoutMilliseconds,
}) {
  const controller = new AbortController();
  let timer;
  const operation = (async () => {
    const redirectResponse = await fetchImpl(endpoint, {
      method: "POST",
      body,
      cache: "no-store",
      credentials: "omit",
      headers: Object.freeze({
        accept: "application/json",
        "cache-control": "no-store",
        "content-type": "application/json",
      }),
      redirect: "manual",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    const redirectUrl = validateContentServiceRedirect(redirectResponse);
    const finalResponse = await fetchImpl(redirectUrl, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      headers: Object.freeze({ accept: "application/json", "cache-control": "no-store" }),
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    return parseUpstreamResponse(await boundedResponseText(finalResponse), testMode);
  })();
  const timeout = new Promise((resolve, reject) => {
    timer = setTimer(() => {
      controller.abort();
      reject(new GoogleAdsRelayError("upstream_timeout", 504));
    }, timeoutMilliseconds);
  });
  try {
    return await Promise.race([operation, timeout]);
  } catch (error) {
    if (error instanceof GoogleAdsRelayError) throw error;
    if (controller.signal.aborted || error?.name === "AbortError") fail("upstream_timeout", 504);
    fail("upstream_network_error");
  } finally {
    if (timer) clearTimer(timer);
  }
}

export function buildOutboxKey(leadId) {
  const digest = crypto.createHash("sha256").update(KEY_DOMAIN, "utf8").update(leadId, "utf8").digest("hex");
  return `${OUTBOX.keyPrefix}${digest}`;
}

export function payloadDigest(payload) {
  return crypto.createHash("sha256")
    .update(PAYLOAD_DIGEST_DOMAIN, "utf8")
    .update(canonicalJson(payload), "utf8")
    .digest("hex");
}

function isoTime(milliseconds) {
  if (!Number.isFinite(milliseconds)) fail("clock_unavailable", 503);
  return new Date(milliseconds).toISOString();
}

function initialRecord(payload, nowMilliseconds) {
  const timestamp = isoTime(nowMilliseconds);
  return Object.freeze({
    version: 1,
    state: "PENDING",
    payload,
    payload_sha256: payloadDigest(payload),
    incoming_payload_sha256: "",
    attempt_count: 0,
    created_at: timestamp,
    updated_at: timestamp,
    next_attempt_at: timestamp,
    expires_at: isoTime(nowMilliseconds + OUTBOX.retentionMilliseconds),
    last_reason: "",
    terminal_at: "",
  });
}

function validateStoredPayload(payload) {
  if (!exactKeys(payload, PAYLOAD_KEYS)) fail("outbox_record_invalid", 503);
  if (payload.event_type !== RELAY_PROTOCOL.eventType || payload.is_test !== false) {
    fail("outbox_record_invalid", 503);
  }
  const normalized = normalizeGoogleAdsPayload({
    ...payload,
    user_column_data: [
      { column_id: "FIRST_NAME", string_value: payload.first_name },
      { column_id: "LAST_NAME", string_value: payload.last_name },
      { column_id: "EMAIL", string_value: payload.email },
      { column_id: "PHONE_NUMBER", string_value: payload.phone_number },
      { column_id: "POSTAL_CODE", string_value: payload.postal_code },
    ],
  }, {
    accountId: GOOGLE_ADS_ROUTING.accountId,
    formIds: GOOGLE_ADS_ROUTING.formIds,
  });
  if (canonicalJson(normalized) !== canonicalJson(payload)) fail("outbox_record_invalid", 503);
  return payload;
}

function parseStoredRecord(data) {
  if (typeof data !== "string" || !data || utf8Length(data) > RELAY_PROTOCOL.maximumRequestBytes) {
    fail("outbox_record_invalid", 503);
  }
  let record;
  try {
    record = JSON.parse(data);
  } catch {
    fail("outbox_record_invalid", 503);
  }
  if (!exactKeys(record, RECORD_KEYS) || record.version !== 1 || !RECORD_STATES.has(record.state)) {
    fail("outbox_record_invalid", 503);
  }
  if (
    !/^[a-f0-9]{64}$/.test(record.payload_sha256)
    || (record.incoming_payload_sha256 !== "" && !/^[a-f0-9]{64}$/.test(record.incoming_payload_sha256))
    || !Number.isSafeInteger(record.attempt_count)
    || record.attempt_count < 0
    || record.attempt_count > OUTBOX.maximumAttempts
  ) {
    fail("outbox_record_invalid", 503);
  }
  for (const key of ["created_at", "updated_at", "expires_at"]) {
    if (typeof record[key] !== "string" || !Number.isFinite(Date.parse(record[key]))) {
      fail("outbox_record_invalid", 503);
    }
  }
  for (const key of ["next_attempt_at", "terminal_at"]) {
    if (typeof record[key] !== "string" || (record[key] && !Number.isFinite(Date.parse(record[key])))) {
      fail("outbox_record_invalid", 503);
    }
  }
  if (
    typeof record.last_reason !== "string"
    || record.last_reason.length > 100
    || CONTROL_TEXT.test(record.last_reason)
    || !STORED_REASON_CODES.has(record.last_reason)
  ) {
    fail("outbox_record_invalid", 503);
  }
  if (record.payload === null) {
    if (!new Set(["CLOSED", "QUARANTINED", "FAILED", "DELETING"]).has(record.state)) {
      fail("outbox_record_invalid", 503);
    }
  } else {
    if (record.state === "DELETING") fail("outbox_record_invalid", 503);
    validateStoredPayload(record.payload);
    if (payloadDigest(record.payload) !== record.payload_sha256) fail("outbox_record_invalid", 503);
  }
  if (canonicalJson(record) !== data) fail("outbox_record_invalid", 503);
  return Object.freeze(record);
}

function recordMetadata(record) {
  return Object.freeze({
    state: record.state,
    attempt_count: String(record.attempt_count),
    created_at: record.created_at,
    updated_at: record.updated_at,
    next_attempt_at: record.next_attempt_at,
    expires_at: record.expires_at,
    last_reason: record.last_reason,
  });
}

export async function productionStoreFactory() {
  try {
    const { getStore } = await import("@netlify/blobs");
    return getStore({ name: OUTBOX.storeName, consistency: "strong" });
  } catch {
    fail("outbox_unavailable", 503);
  }
}

async function requireStore(storeFactory, needsList = false) {
  let store;
  try {
    store = await storeFactory();
  } catch (error) {
    if (error instanceof GoogleAdsRelayError) throw error;
    fail("outbox_unavailable", 503);
  }
  const methods = ["set", "getWithMetadata"].concat(needsList ? ["list", "delete"] : []);
  if (!store || methods.some((method) => typeof store[method] !== "function")) {
    fail("outbox_unavailable", 503);
  }
  return store;
}

async function readRawEntry(store, key) {
  let entry;
  try {
    entry = await store.getWithMetadata(key, { consistency: "strong", type: "text" });
  } catch {
    fail("outbox_unavailable", 503);
  }
  if (!entry) return null;
  if (typeof entry.etag !== "string" || !entry.etag) fail("outbox_record_invalid", 503);
  return Object.freeze(entry);
}

async function readEntry(store, key) {
  const entry = await readRawEntry(store, key);
  if (!entry) return null;
  try {
    return Object.freeze({ ...entry, record: parseStoredRecord(entry.data) });
  } catch {
    // Stored data is an internal durability concern. It must never turn a valid,
    // authenticated Google retry into a non-retryable 4xx response.
    fail("outbox_record_invalid", 503);
  }
}

async function writeRecord(store, key, record, condition) {
  const data = canonicalJson(record);
  let result;
  try {
    result = await store.set(key, data, { metadata: recordMetadata(record), ...condition });
  } catch {
    fail("outbox_unavailable", 503);
  }
  if (!result || typeof result.modified !== "boolean") fail("outbox_unavailable", 503);
  return result;
}

async function compareAndSet(store, key, entry, record) {
  const result = await writeRecord(store, key, record, { onlyIfMatch: entry.etag });
  if (!result.modified) return null;
  if (typeof result.etag !== "string" || !result.etag) fail("outbox_unavailable", 503);
  return Object.freeze({ data: canonicalJson(record), etag: result.etag, metadata: recordMetadata(record), record });
}

function parseScanCursor(data) {
  if (typeof data !== "string" || !data || utf8Length(data) > 8192) {
    fail("outbox_cursor_invalid", 503);
  }
  let value;
  try {
    value = JSON.parse(data);
  } catch {
    fail("outbox_cursor_invalid", 503);
  }
  if (
    !exactKeys(value, SCAN_CURSOR_KEYS)
    || value.version !== 1
    || typeof value.cursor !== "string"
    || (value.cursor !== "" && !OUTBOX_KEY.test(value.cursor))
    || CONTROL_TEXT.test(value.cursor)
    || typeof value.updated_at !== "string"
    || !Number.isFinite(Date.parse(value.updated_at))
    || canonicalJson(value) !== data
  ) {
    fail("outbox_cursor_invalid", 503);
  }
  return Object.freeze(value);
}

async function readScanCursor(store) {
  let entry;
  try {
    entry = await store.getWithMetadata(OUTBOX.scanCursorKey, { consistency: "strong", type: "text" });
  } catch {
    fail("outbox_unavailable", 503);
  }
  if (!entry) return null;
  if (typeof entry.etag !== "string" || !entry.etag) fail("outbox_cursor_invalid", 503);
  try {
    return Object.freeze({ ...entry, invalid: false, value: parseScanCursor(entry.data) });
  } catch (error) {
    if (!(error instanceof GoogleAdsRelayError) || error.code !== "outbox_cursor_invalid") throw error;
    return Object.freeze({ ...entry, invalid: true, value: null });
  }
}

async function advanceScanCursor(store, entry, nextCursor, nowMilliseconds) {
  if (
    typeof nextCursor !== "string"
    || (nextCursor !== "" && !OUTBOX_KEY.test(nextCursor))
    || CONTROL_TEXT.test(nextCursor)
  ) {
    fail("outbox_cursor_invalid", 503);
  }
  const value = Object.freeze({ version: 1, cursor: nextCursor, updated_at: isoTime(nowMilliseconds) });
  let result;
  try {
    result = await store.set(
      OUTBOX.scanCursorKey,
      canonicalJson(value),
      entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true },
    );
  } catch {
    fail("outbox_unavailable", 503);
  }
  if (!result || typeof result.modified !== "boolean") fail("outbox_unavailable", 503);
  return result.modified;
}

function retryDelay(attemptCount) {
  return Math.min(
    OUTBOX.retryBaseMilliseconds * Math.pow(2, Math.max(0, attemptCount - 1)),
    OUTBOX.retryMaximumMilliseconds,
  );
}

export async function acceptOperationalPayload({ storeFactory, payload, nowMilliseconds }) {
  if (payload.is_test !== false) fail("test_payload_not_persistable", 400);
  const store = await requireStore(storeFactory, false);
  const key = buildOutboxKey(payload.lead_id);
  const record = initialRecord(payload, nowMilliseconds);
  const created = await writeRecord(store, key, record, { onlyIfNew: true });
  if (created.modified) {
    const confirmed = await readEntry(store, key);
    if (!confirmed || confirmed.record.payload_sha256 !== record.payload_sha256) {
      fail("outbox_write_unconfirmed", 503);
    }
    return Object.freeze({ kind: "CREATED", key, store, entry: confirmed });
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const existing = await readEntry(store, key);
    if (!existing) fail("outbox_race", 503);
    if (existing.record.payload_sha256 === record.payload_sha256) {
      return Object.freeze({ kind: "EXACT_REPLAY", key, store, entry: existing });
    }
    if (existing.record.state === "DELETING") {
      // An expired tombstone under a deletion lease is immutable. A changed
      // replay is still rejected, but cannot steal the lease or race deletion.
      return Object.freeze({ kind: "CHANGED_REPLAY", key, store, entry: existing });
    }
    const quarantined = Object.freeze({
      ...existing.record,
      state: "QUARANTINED",
      incoming_payload_sha256: record.payload_sha256,
      updated_at: isoTime(nowMilliseconds),
      next_attempt_at: "",
      last_reason: "source_id_payload_drift",
      terminal_at: isoTime(nowMilliseconds),
    });
    const changed = await compareAndSet(store, key, existing, quarantined);
    if (changed) return Object.freeze({ kind: "CHANGED_REPLAY", key, store, entry: changed });
  }
  fail("outbox_race", 503);
}

async function claimAttempt(store, key, nowMilliseconds) {
  for (let loop = 0; loop < 4; loop += 1) {
    const entry = await readEntry(store, key);
    if (!entry) fail("outbox_record_missing", 503);
    const { record } = entry;
    if (["CLOSED", "QUARANTINED", "FAILED", "DELETING"].includes(record.state)) {
      return Object.freeze({ kind: record.state, entry });
    }
    const now = Number(nowMilliseconds);
    const nextAttempt = record.next_attempt_at ? Date.parse(record.next_attempt_at) : 0;
    const leaseExpired = record.state === "ATTEMPTING"
      && Date.parse(record.updated_at) + OUTBOX.attemptLeaseMilliseconds <= now;
    if (record.state === "ATTEMPTING" && !leaseExpired) return Object.freeze({ kind: "BUSY", entry });
    if (record.state === "PENDING" && nextAttempt > now) return Object.freeze({ kind: "NOT_DUE", entry });
    if (record.attempt_count >= OUTBOX.maximumAttempts) {
      const failed = Object.freeze({
        ...record,
        state: "FAILED",
        updated_at: isoTime(now),
        next_attempt_at: "",
        last_reason: record.last_reason || "retry_limit_exhausted",
        terminal_at: isoTime(now),
      });
      const updated = await compareAndSet(store, key, entry, failed);
      if (updated) return Object.freeze({ kind: "FAILED", entry: updated });
      continue;
    }
    if (!record.payload) fail("outbox_record_invalid", 503);
    const claimed = Object.freeze({
      ...record,
      state: "ATTEMPTING",
      attempt_count: record.attempt_count + 1,
      updated_at: isoTime(now),
      next_attempt_at: "",
      last_reason: "",
      terminal_at: "",
    });
    const updated = await compareAndSet(store, key, entry, claimed);
    if (updated) return Object.freeze({ kind: "CLAIMED", entry: updated });
  }
  return Object.freeze({ kind: "BUSY", entry: null });
}

async function finalizeAttempt(store, key, claimed, { permanent, reason, outcome }, nowMilliseconds) {
  const { record } = claimed;
  const now = Number(nowMilliseconds);
  let updated;
  if (outcome && OPERATIONAL_SUCCESS_OUTCOMES.has(outcome)) {
    updated = Object.freeze({
      ...record,
      state: "CLOSED",
      payload: null,
      updated_at: isoTime(now),
      next_attempt_at: "",
      expires_at: isoTime(now + OUTBOX.tombstoneRetentionMilliseconds),
      last_reason: outcome,
      terminal_at: isoTime(now),
    });
  } else {
    const exhausted = record.attempt_count >= OUTBOX.maximumAttempts;
    const state = permanent ? "QUARANTINED" : exhausted ? "FAILED" : "PENDING";
    updated = Object.freeze({
      ...record,
      state,
      updated_at: isoTime(now),
      next_attempt_at: state === "PENDING" ? isoTime(now + retryDelay(record.attempt_count)) : "",
      last_reason: reason,
      terminal_at: state === "PENDING" ? "" : isoTime(now),
    });
  }
  const result = await compareAndSet(store, key, claimed, updated);
  if (result) return Object.freeze({ kind: result.record.state, entry: result });
  const current = await readEntry(store, key);
  return Object.freeze({ kind: current?.record?.state || "RACE", entry: current });
}

export async function attemptOperationalDelivery({
  store,
  key,
  env,
  fetchImpl,
  nowMilliseconds,
  randomBytes,
  setTimer,
  clearTimer,
  timeoutMilliseconds,
}) {
  const claimed = await claimAttempt(store, key, nowMilliseconds);
  if (claimed.kind !== "CLAIMED") return claimed;
  let configuration;
  try {
    const googleAdsConfiguration = validateGoogleAdsConfiguration(env);
    if (
      claimed.entry.record.payload.account_id !== googleAdsConfiguration.accountId
      || !googleAdsConfiguration.formIds.includes(claimed.entry.record.payload.form_id)
    ) {
      fail("google_ads_routing_configuration_unavailable", 503);
    }
    configuration = validateRelayConfiguration(
      env,
      Object.values(googleAdsConfiguration.webhookKeysByFormId),
    );
  } catch (error) {
    const controlled = error instanceof GoogleAdsRelayError ? error : new GoogleAdsRelayError("relay_configuration_invalid", 503);
    return finalizeAttempt(store, key, claimed.entry, {
      permanent: false,
      reason: controlled.code,
      outcome: "",
    }, nowMilliseconds);
  }
  try {
    const body = buildEnvelope(claimed.entry.record.payload, configuration.secret, nowMilliseconds, randomBytes);
    const response = await postEnvelope({
      body,
      endpoint: configuration.endpoint,
      fetchImpl,
      testMode: false,
      setTimer,
      clearTimer,
      timeoutMilliseconds,
    });
    if (!response.ok) {
      return finalizeAttempt(store, key, claimed.entry, {
        permanent: !TRANSIENT_RESPONSE_REASONS.has(response.reason),
        reason: response.reason,
        outcome: "",
      }, nowMilliseconds);
    }
    return finalizeAttempt(store, key, claimed.entry, {
      permanent: false,
      reason: "",
      outcome: response.outcome,
    }, nowMilliseconds);
  } catch (error) {
    const controlled = error instanceof GoogleAdsRelayError ? error : new GoogleAdsRelayError("upstream_network_error", 502);
    return finalizeAttempt(store, key, claimed.entry, {
      permanent: false,
      reason: controlled.code,
      outcome: "",
    }, nowMilliseconds);
  }
}

export async function deliverTestPayload({
  payload,
  env,
  googleAdsConfiguration,
  fetchImpl,
  nowMilliseconds,
  randomBytes,
  setTimer,
  clearTimer,
  timeoutMilliseconds,
}) {
  if (payload.is_test !== true) fail("test_payload_required", 400);
  const configuration = validateRelayConfiguration(
    env,
    Object.values(googleAdsConfiguration.webhookKeysByFormId),
  );
  const body = buildEnvelope(payload, configuration.secret, nowMilliseconds, randomBytes);
  const response = await postEnvelope({
    body,
    endpoint: configuration.endpoint,
    fetchImpl,
    testMode: true,
    setTimer,
    clearTimer,
    timeoutMilliseconds,
  });
  if (!response.ok || response.outcome !== "TEST_ACKNOWLEDGED") {
    fail(response.reason || "test_receiver_rejected", 502);
  }
  return response;
}

async function purgeExpiredRecord(store, key, entry, nowMilliseconds) {
  if (!entry.record.payload) return entry;
  const purged = Object.freeze({
    ...entry.record,
    state: entry.record.state === "QUARANTINED" ? "QUARANTINED" : "FAILED",
    payload: null,
    updated_at: isoTime(nowMilliseconds),
    next_attempt_at: "",
    expires_at: isoTime(nowMilliseconds + OUTBOX.tombstoneRetentionMilliseconds),
    last_reason: "retention_expired",
    terminal_at: entry.record.terminal_at || isoTime(nowMilliseconds),
  });
  return compareAndSet(store, key, entry, purged);
}

function invalidRecordTombstone(data, nowMilliseconds) {
  const timestamp = isoTime(nowMilliseconds);
  const digest = crypto.createHash("sha256")
    .update(INVALID_RECORD_DIGEST_DOMAIN, "utf8")
    .update(typeof data === "string" ? data : "", "utf8")
    .digest("hex");
  return Object.freeze({
    version: 1,
    state: "FAILED",
    payload: null,
    payload_sha256: digest,
    incoming_payload_sha256: "",
    attempt_count: 0,
    created_at: timestamp,
    updated_at: timestamp,
    next_attempt_at: "",
    expires_at: isoTime(nowMilliseconds + OUTBOX.tombstoneRetentionMilliseconds),
    last_reason: "outbox_record_invalid",
    terminal_at: timestamp,
  });
}

async function scrubInvalidRecord(store, key, entry, nowMilliseconds) {
  const tombstone = invalidRecordTombstone(entry.data, nowMilliseconds);
  return compareAndSet(store, key, entry, tombstone);
}

async function deleteExpiredTombstone(store, key, entry, nowMilliseconds) {
  if (
    entry.record.payload !== null
    || Date.parse(entry.record.expires_at) > nowMilliseconds
    || (
      entry.record.state === "DELETING"
      && Date.parse(entry.record.updated_at) + OUTBOX.deletionLeaseMilliseconds > nowMilliseconds
    )
  ) {
    return false;
  }
  const deletingRecord = Object.freeze({
    ...entry.record,
    state: "DELETING",
    updated_at: isoTime(nowMilliseconds),
    next_attempt_at: "",
    last_reason: "tombstone_expired",
    terminal_at: entry.record.terminal_at || isoTime(nowMilliseconds),
  });
  const deleting = await compareAndSet(store, key, entry, deletingRecord);
  if (!deleting) return false;
  const current = await readEntry(store, key);
  if (!current || current.etag !== deleting.etag || current.record.state !== "DELETING") return false;
  try {
    await store.delete(key);
  } catch {
    fail("outbox_unavailable", 503);
  }
  return true;
}

function safeMetadataLog(logger, entry) {
  try {
    logger(Object.freeze(entry));
  } catch {
    // Logging cannot block retention, retries, or acceptance.
  }
}

async function listShardCandidates(store, shard) {
  const prefix = `${OUTBOX.keyPrefix}${shard}`;
  let iterable;
  try {
    iterable = store.list({ prefix, paginate: true });
  } catch {
    fail("outbox_unavailable", 503);
  }
  if (!iterable || typeof iterable[Symbol.asyncIterator] !== "function") {
    fail("outbox_unavailable", 503);
  }
  const iterator = iterable[Symbol.asyncIterator]();
  const keys = [];
  let invalidItems = 0;
  let overflow = false;
  try {
    for (let pageIndex = 0; pageIndex < OUTBOX.maximumPagesPerShard; pageIndex += 1) {
      const page = await iterator.next();
      if (page.done) return Object.freeze({ invalidItems, keys: Object.freeze(keys), overflow });
      if (!page.value || !Array.isArray(page.value.blobs) || !Array.isArray(page.value.directories)) {
        fail("outbox_unavailable", 503);
      }
      for (const item of page.value.blobs) {
        const key = typeof item?.key === "string" ? item.key : "";
        if (!OUTBOX_KEY.test(key) || !key.startsWith(prefix)) {
          invalidItems += 1;
          continue;
        }
        if (keys.length < OUTBOX.maximumListedKeysPerShard) keys.push(key);
        else overflow = true;
      }
    }
    // The SDK does not expose its provider cursor. Probe exactly one additional
    // page so a shard that exceeds the bounded scan surface raises attention
    // instead of silently claiming complete coverage.
    const probe = await iterator.next();
    if (!probe.done) overflow = true;
  } catch (error) {
    if (error instanceof GoogleAdsRelayError) throw error;
    fail("outbox_unavailable", 503);
  } finally {
    try { await iterator.return?.(); } catch {}
  }
  return Object.freeze({ invalidItems, keys: Object.freeze(keys), overflow });
}

async function listBoundedCandidates(store) {
  const shards = await Promise.all(OUTBOX_SHARDS.map((shard) => listShardCandidates(store, shard)));
  const keys = [...new Set(shards.flatMap((result) => result.keys))].sort();
  return Object.freeze({
    keys: Object.freeze(keys),
    invalidItems: shards.reduce((total, result) => total + result.invalidItems, 0),
    overflow: shards.some((result) => result.overflow),
  });
}

function selectScanKeys(keys, cursor) {
  if (keys.length === 0) return Object.freeze([]);
  let start = keys.findIndex((key) => key > cursor);
  if (start < 0) start = 0;
  const count = Math.min(keys.length, OUTBOX.maximumScanSize);
  const selected = [];
  for (let offset = 0; offset < count; offset += 1) {
    selected.push(keys[(start + offset) % keys.length]);
  }
  return Object.freeze(selected);
}

async function mapWithConcurrency(values, maximumConcurrency, worker) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index], index);
    }
  }
  const workers = Array.from(
    { length: Math.min(maximumConcurrency, values.length) },
    () => run(),
  );
  await Promise.all(workers);
  return results;
}

export async function reconcileOutbox({
  storeFactory = productionStoreFactory,
  env,
  fetchImpl = globalThis.fetch,
  nowMilliseconds,
  randomBytes = crypto.randomBytes,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  timeoutMilliseconds = RELAY_PROTOCOL.timeoutMilliseconds,
  logger = () => {},
}) {
  requireProductionContext(env);
  const store = await requireStore(storeFactory, true);
  const scanCursorEntry = await readScanCursor(store);
  const cursorRecovered = Boolean(scanCursorEntry?.invalid);
  const currentCursor = scanCursorEntry?.value?.cursor || "";
  const listing = await listBoundedCandidates(store);
  const scanItems = selectScanKeys(listing.keys, currentCursor);
  const due = [];
  const maintenanceCandidates = [];
  const stateCounts = { PENDING: 0, ATTEMPTING: 0, CLOSED: 0, QUARANTINED: 0, FAILED: 0, DELETING: 0 };
  let scanned = 0;
  let invalidRecords = 0;
  let invalidRecordsScrubbed = 0;
  let purgedPayloads = 0;
  let deletedTombstones = 0;
  let maintenanceFailures = 0;
  let maintenanceDeferred = 0;
  let dueDeferred = 0;
  const scanResults = await mapWithConcurrency(
    scanItems,
    OUTBOX.maximumConcurrentRecordReads,
    async (key) => {
      try {
        const raw = await readRawEntry(store, key);
        if (!raw) return Object.freeze({ key, kind: "MISSING" });
        try {
          return Object.freeze({ key, kind: "VALID", entry: Object.freeze({ ...raw, record: parseStoredRecord(raw.data) }) });
        } catch {
          return Object.freeze({ key, kind: "INVALID", entry: raw });
        }
      } catch (error) {
        return Object.freeze({ key, kind: "ERROR", error });
      }
    },
  );
  for (const result of scanResults) {
    if (result.kind === "MISSING") continue;
    scanned += 1;
    if (result.kind === "ERROR") {
      invalidRecords += 1;
      safeMetadataLog(logger, {
        event: "google_ads_crm_relay_retry",
        outcome: "FAILED",
        reason: result.error instanceof GoogleAdsRelayError ? result.error.code : "relay_internal_error",
      });
      continue;
    }
    if (result.kind === "INVALID") {
      invalidRecords += 1;
      if (maintenanceCandidates.length >= OUTBOX.maximumMaintenanceActions) {
        maintenanceDeferred += 1;
      } else {
        maintenanceCandidates.push(Object.freeze({ kind: "SCRUB", key: result.key, entry: result.entry }));
      }
      continue;
    }
    const { entry } = result;
    try {
      stateCounts[entry.record.state] += 1;
      const expiresAt = Date.parse(entry.record.expires_at);
      if (expiresAt <= nowMilliseconds) {
        if (maintenanceCandidates.length >= OUTBOX.maximumMaintenanceActions) {
          maintenanceDeferred += 1;
        } else {
          maintenanceCandidates.push(Object.freeze({
            kind: entry.record.payload ? "PURGE" : "DELETE",
            key: result.key,
            entry,
          }));
        }
        continue;
      }
      const isDue = (
        entry.record.state === "PENDING"
        && Date.parse(entry.record.next_attempt_at) <= nowMilliseconds
      ) || (
        entry.record.state === "ATTEMPTING"
        && Date.parse(entry.record.updated_at) + OUTBOX.attemptLeaseMilliseconds <= nowMilliseconds
      );
      if (isDue && due.length < OUTBOX.maximumBatchSize) {
        due.push(result.key);
      } else if (isDue) {
        dueDeferred += 1;
      }
    } catch (error) {
      invalidRecords += 1;
      safeMetadataLog(logger, {
        event: "google_ads_crm_relay_retry",
        outcome: "FAILED",
        reason: error instanceof GoogleAdsRelayError ? error.code : "relay_internal_error",
      });
    }
  }

  const maintenanceOutcomes = await mapWithConcurrency(
    maintenanceCandidates,
    OUTBOX.maximumConcurrentMaintenanceActions,
    async ({ kind, key, entry }) => {
      try {
        if (kind === "SCRUB") {
          return await scrubInvalidRecord(store, key, entry, nowMilliseconds) ? "SCRUBBED" : "RACE";
        }
        if (kind === "PURGE") {
          return await purgeExpiredRecord(store, key, entry, nowMilliseconds) ? "PURGED" : "RACE";
        }
        return await deleteExpiredTombstone(store, key, entry, nowMilliseconds) ? "DELETED" : "RACE";
      } catch (error) {
        safeMetadataLog(logger, {
          event: "google_ads_crm_relay_retry",
          outcome: "FAILED",
          reason: error instanceof GoogleAdsRelayError ? error.code : "relay_internal_error",
        });
        return "FAILED";
      }
    },
  );
  invalidRecordsScrubbed = maintenanceOutcomes.filter((outcome) => outcome === "SCRUBBED").length;
  purgedPayloads = invalidRecordsScrubbed
    + maintenanceOutcomes.filter((outcome) => outcome === "PURGED").length;
  deletedTombstones = maintenanceOutcomes.filter((outcome) => outcome === "DELETED").length;
  maintenanceFailures = maintenanceOutcomes.filter((outcome) => outcome === "FAILED").length;

  let configurationReason = "";
  try {
    const googleAdsConfiguration = validateGoogleAdsConfiguration(env);
    validateRelayConfiguration(env, Object.values(googleAdsConfiguration.webhookKeysByFormId));
  } catch (error) {
    configurationReason = error instanceof GoogleAdsRelayError ? error.code : "relay_configuration_invalid";
  }

  const outcomes = configurationReason ? [] : await Promise.all(due.map(async (key) => {
    try {
      const result = await attemptOperationalDelivery({
        store,
        key,
        env,
        fetchImpl,
        nowMilliseconds,
        randomBytes,
        setTimer,
        clearTimer,
        timeoutMilliseconds,
      });
      const reason = result.entry?.record?.last_reason || null;
      safeMetadataLog(logger, { event: "google_ads_crm_relay_retry", outcome: result.kind, reason });
      return Object.freeze({ kind: result.kind, reason });
    } catch (error) {
      const reason = error instanceof GoogleAdsRelayError ? error.code : "relay_internal_error";
      safeMetadataLog(logger, { event: "google_ads_crm_relay_retry", outcome: "FAILED", reason });
      return Object.freeze({ kind: "FAILED", reason });
    }
  }));
  let cursorUpdateFailed = false;
  const nextCursor = scanItems.at(-1) || currentCursor;
  try {
    const updated = await advanceScanCursor(store, scanCursorEntry, nextCursor, nowMilliseconds);
    if (!updated) cursorUpdateFailed = true;
  } catch (error) {
    cursorUpdateFailed = true;
    safeMetadataLog(logger, {
      event: "google_ads_crm_relay_retry",
      outcome: "FAILED",
      reason: error instanceof GoogleAdsRelayError ? error.code : "outbox_cursor_invalid",
    });
  }
  const transientDeliveryFailures = outcomes.filter(({ kind, reason }) => kind === "PENDING" && reason).length;
  const failedDeliveries = outcomes.filter(({ kind }) => kind === "FAILED" || kind === "QUARANTINED").length;
  const scanRotated = listing.keys.length > scanItems.length;
  const scanLimited = listing.overflow || listing.invalidItems > 0;
  const attentionRequired = Boolean(
    configurationReason
    || invalidRecords
    || stateCounts.FAILED
    || stateCounts.QUARANTINED
    || transientDeliveryFailures
    || failedDeliveries
    || scanLimited
    || cursorRecovered
    || cursorUpdateFailed
    || maintenanceFailures
    || maintenanceDeferred
    || dueDeferred,
  );
  const summary = Object.freeze({
    event: "google_ads_crm_relay_summary",
    outcome: attentionRequired ? "ATTENTION_REQUIRED" : "HEALTHY",
    scanned,
    listed_candidates: listing.keys.length,
    scan_limited: scanLimited,
    scan_rotated: scanRotated,
    invalid_list_items: listing.invalidItems,
    cursor_recovered: cursorRecovered,
    cursor_update_failed: cursorUpdateFailed,
    processed: outcomes.length,
    due_deferred: dueDeferred + (configurationReason ? due.length : 0),
    payloads_purged: purgedPayloads,
    tombstones_deleted: deletedTombstones,
    maintenance_failures: maintenanceFailures,
    maintenance_deferred: maintenanceDeferred,
    invalid_records: invalidRecords,
    invalid_records_scrubbed: invalidRecordsScrubbed,
    transient_delivery_failures: transientDeliveryFailures,
    failed_deliveries: failedDeliveries,
    pending_records: stateCounts.PENDING,
    attempting_records: stateCounts.ATTEMPTING,
    failed_records: stateCounts.FAILED,
    quarantined_records: stateCounts.QUARANTINED,
    deleting_records: stateCounts.DELETING,
    configuration_reason: configurationReason || null,
  });
  safeMetadataLog(logger, summary);
  return Object.freeze({
    processed: outcomes.length,
    outcomes: Object.freeze(outcomes.map(({ kind }) => kind)),
    attentionRequired,
    summary,
  });
}

export function createRetryHandler({
  env,
  storeFactory = productionStoreFactory,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  randomBytes = crypto.randomBytes,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  timeoutMilliseconds = RELAY_PROTOCOL.timeoutMilliseconds,
  logger = () => {},
  failOnAttention = false,
} = {}) {
  return async function googleAdsCrmRetry() {
    try {
      const result = await reconcileOutbox({
        storeFactory,
        env,
        fetchImpl,
        nowMilliseconds: Number(now()),
        randomBytes,
        setTimer,
        clearTimer,
        timeoutMilliseconds,
        logger,
      });
      if (result.attentionRequired && failOnAttention) {
        throw new GoogleAdsRelayError("relay_attention_required", 503);
      }
      return new Response(JSON.stringify({ ok: true, processed: result.processed }), {
        status: 200,
        headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" },
      });
    } catch (error) {
      const controlled = error instanceof GoogleAdsRelayError ? error : new GoogleAdsRelayError("relay_internal_error", 500);
      safeMetadataLog(logger, { event: "google_ads_crm_relay_retry", outcome: "FAILED", reason: controlled.code });
      if (failOnAttention) throw controlled;
      return new Response(JSON.stringify({ ok: false, error: controlled.code }), {
        status: controlled.statusCode,
        headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" },
      });
    }
  };
}

export const _test = Object.freeze({
  CONTROLLED_RESPONSE_REASONS,
  PAYLOAD_KEYS,
  RECORD_KEYS,
  deleteExpiredTombstone,
  parseStoredRecord,
  retryDelay,
});
