/**
 * Google Ads Lead Form Webhook — Netlify Serverless Function
 * Lakeland Health Insurance — David Huff
 *
 * Receives Google Ads Lead Form submissions, validates the shared key,
 * records a durable receipt, and attempts internal email + SMS notifications.
 * Google-hosted leads never enter Mailchimp because the form does not collect
 * separate, verifiable marketing-email consent.
 *
 * Served at: https://lakelandhealthinsurance.com/api/google-lead-webhook
 * (netlify.toml rewrite → /.netlify/functions/google-lead-webhook)
 *
 * Required env vars:
 *   GOOGLE_LEAD_WEBHOOK_KEY — must equal the "Key" value pasted into the
 *                             Google Ads lead form webhook UI. It authenticates
 *                             the payload and is never stored.
 *
 * Optional env vars (each notification no-ops gracefully if unset):
 *   RESEND_API_KEY, NOTIFY_EMAIL
 *   TWILIO_SID, TWILIO_AUTH, TWILIO_FROM, TWILIO_TO
 *
 * Test-mode payloads (is_test=true) are acknowledged with 200 and skip all
 * storage and downstream I/O so Google's test button does not create a lead.
 */

import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_LEAD_ID_BYTES = 512;
const MAX_COLUMN_COUNT = 100;
const MAX_COLUMN_KEY_BYTES = 256;
const MAX_COLUMN_VALUE_BYTES = 8 * 1024;
const RECEIPT_STORE_NAME = "google-lead-webhook-receipts-v1";
const RECEIPT_KEY_DOMAIN = "lakeland-google-lead-receipt-v1\0";

function getEnv(key) {
  try {
    const netlifyValue = globalThis.Netlify?.env?.get?.(key);
    if (netlifyValue) return String(netlifyValue);
  } catch {
    // Fall through to process.env for local Netlify runtimes.
  }
  return String(process.env[key] || "");
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function utf8Length(value) {
  return Buffer.byteLength(value, "utf8");
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function logOperationalEvent(level, eventId, component, outcome, status) {
  const record = {
    type: "google_lead_webhook_outcome_v1",
    day: new Date().toISOString().slice(0, 10),
    event_id: eventId,
    component,
    outcome,
  };
  if (Number.isInteger(status)) record.status = status;
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else console.log(line);
}

function validateLeadId(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value !== value.trim() || utf8Length(value) > MAX_LEAD_ID_BYTES) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

function validateUserColumnData(value) {
  if (!Array.isArray(value) || value.length > MAX_COLUMN_COUNT) return false;

  return value.every((item) => {
    if (!isRecord(item)) return false;

    for (const key of ["column_id", "column_name"]) {
      if (item[key] === undefined) continue;
      if (typeof item[key] !== "string" || utf8Length(item[key]) > MAX_COLUMN_KEY_BYTES) {
        return false;
      }
    }

    if (item.string_value !== undefined) {
      if (
        typeof item.string_value !== "string" ||
        utf8Length(item.string_value) > MAX_COLUMN_VALUE_BYTES
      ) {
        return false;
      }
    }

    return true;
  });
}

function normalizeField(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeReference(value) {
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  if (typeof value !== "string") return "";
  const normalized = normalizeField(value);
  return utf8Length(normalized) <= MAX_COLUMN_KEY_BYTES ? normalized : "";
}

// Map Google Ads column_id values into the minimum internal notification shape.
// Unknown fields are ignored and are never persisted.
function parseLeadFields(userColumnData) {
  const raw = Object.create(null);
  for (const item of userColumnData) {
    const id = normalizeField(item.column_id).toUpperCase();
    const fallback = normalizeField(item.column_name).toLowerCase().replace(/\s+/g, "_");
    const key = id || fallback;
    if (key) raw[key] = normalizeField(item.string_value);
  }

  const fullName =
    raw.FULL_NAME ||
    raw.full_name ||
    [raw.FIRST_NAME || raw.first_name, raw.LAST_NAME || raw.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
  const nameParts = fullName ? fullName.split(/\s+/) : [];

  return {
    full_name: fullName,
    first_name: raw.FIRST_NAME || raw.first_name || nameParts[0] || "",
    last_name: raw.LAST_NAME || raw.last_name || nameParts.slice(1).join(" "),
    email: raw.EMAIL || raw.WORK_EMAIL || raw.email || "",
    phone: raw.PHONE_NUMBER || raw.WORK_PHONE || raw.phone_number || raw.phone || "",
    city: raw.CITY || raw.city || "",
    state: raw.REGION || raw.state || raw.region || "FL",
    zip: raw.POSTAL_CODE || raw.ZIP_CODE || raw.postal_code || raw.zip_code || raw.zip || "",
  };
}

function buildReceiptKey(leadId) {
  const digest = crypto
    .createHash("sha256")
    .update(RECEIPT_KEY_DOMAIN)
    .update(leadId)
    .digest("hex");
  return `lead/${digest}`;
}

async function sendEmailNotification(lead, eventId, env, fetchImpl, now) {
  try {
    const resendApiKey = env("RESEND_API_KEY");
    const notifyEmail = env("NOTIFY_EMAIL");
    if (!resendApiKey || !notifyEmail) {
      logOperationalEvent("info", eventId, "email", "skipped_not_configured");
      return "skipped";
    }

    const body = [
      `NEW LEAD — ${lead.full_name || "Unknown"}`,
      "",
      "Source: Google Ads Lead Form",
      `Campaign: ${lead.campaign_id || "Unknown"}`,
      `Ad Group: ${lead.adgroup_id || "Unknown"}`,
      `Creative: ${lead.creative_id || "Unknown"}`,
      "",
      `Name: ${lead.full_name}`,
      `Email: ${lead.email}`,
      `Phone: ${lead.phone}`,
      `Location: ${lead.city}, ${lead.state} ${lead.zip}`,
      "",
      `Time: ${now().toLocaleString("en-US", { timeZone: "America/New_York" })}`,
      "",
      "ACTION: Call/text this lead ASAP — Google Ads paid traffic.",
      "SLA target: < 2 hours from submission.",
    ].join("\n");

    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "LHI Bot <leads@lakelandhealthinsurance.com>",
        to: notifyEmail,
        subject: `New Lead: ${lead.full_name || "Google Ads Lead Form"}`,
        text: body,
      }),
    });

    if (response.ok) {
      logOperationalEvent("info", eventId, "email", "completed");
      return "completed";
    }
    logOperationalEvent("error", eventId, "email", "failed", response.status);
    return "failed";
  } catch {
    logOperationalEvent("error", eventId, "email", "exception");
    return "exception";
  }
}

async function sendSmsNotification(lead, eventId, env, fetchImpl) {
  try {
    const twilioSid = env("TWILIO_SID");
    const twilioAuth = env("TWILIO_AUTH");
    const twilioFrom = env("TWILIO_FROM");
    const twilioTo = env("TWILIO_TO");
    if (!twilioSid || !twilioAuth || !twilioFrom || !twilioTo) {
      logOperationalEvent("info", eventId, "sms", "skipped_not_configured");
      return "skipped";
    }

    const message = [
      `[LHI] New Google Ads Lead: ${lead.full_name || "Unknown"}`,
      `Phone: ${lead.phone || "N/A"}`,
      `Email: ${lead.email || "N/A"}`,
      `Campaign: ${lead.campaign_id || "?"}`,
    ].join("\n");
    const params = new URLSearchParams({
      To: twilioTo,
      From: twilioFrom,
      Body: message,
    });

    const response = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (response.ok) {
      logOperationalEvent("info", eventId, "sms", "completed");
      return "completed";
    }
    logOperationalEvent("error", eventId, "sms", "failed", response.status);
    return "failed";
  } catch {
    logOperationalEvent("error", eventId, "sms", "exception");
    return "exception";
  }
}

export function createGoogleLeadWebhook({
  getStoreFn = getStore,
  env = getEnv,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  randomUUID = () => crypto.randomUUID(),
} = {}) {
  return async function googleLeadWebhook(req) {
    if (req.method !== "POST") {
      return jsonResponse(405, { ok: false, error: "method_not_allowed" });
    }

    const eventId = randomUUID();
    const contentLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      logOperationalEvent("error", eventId, "request", "body_too_large");
      return jsonResponse(413, { ok: false, error: "payload_too_large" });
    }

    let rawBody;
    try {
      rawBody = await req.text();
    } catch {
      logOperationalEvent("error", eventId, "request", "body_unreadable");
      return jsonResponse(400, { ok: false, error: "invalid_request" });
    }
    if (utf8Length(rawBody) > MAX_BODY_BYTES) {
      logOperationalEvent("error", eventId, "request", "body_too_large");
      return jsonResponse(413, { ok: false, error: "payload_too_large" });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      logOperationalEvent("error", eventId, "request", "invalid_json");
      return jsonResponse(400, { ok: false, error: "invalid_json" });
    }
    if (!isRecord(payload)) {
      logOperationalEvent("error", eventId, "request", "invalid_payload_shape");
      return jsonResponse(400, { ok: false, error: "invalid_payload" });
    }

    // Validate the Google Ads shared key before accepting any lead fields.
    const expectedKey = env("GOOGLE_LEAD_WEBHOOK_KEY");
    if (!expectedKey) {
      logOperationalEvent("error", eventId, "authentication", "server_misconfigured");
      return jsonResponse(500, { ok: false, error: "webhook_misconfigured" });
    }
    if (!safeEqual(payload.google_key, expectedKey)) {
      logOperationalEvent("error", eventId, "authentication", "rejected");
      return jsonResponse(403, { ok: false, error: "invalid_key" });
    }

    // Google's test payload is intentionally excluded from storage and delivery.
    if (payload.is_test === true) {
      logOperationalEvent("info", eventId, "request", "test_acknowledged");
      return jsonResponse(200, { ok: true, test: true });
    }

    const leadId = validateLeadId(payload.lead_id);
    if (!leadId) {
      logOperationalEvent("error", eventId, "request", "invalid_lead_id");
      return jsonResponse(400, { ok: false, error: "invalid_lead_id" });
    }
    if (!validateUserColumnData(payload.user_column_data)) {
      logOperationalEvent("error", eventId, "request", "invalid_user_column_data");
      return jsonResponse(400, { ok: false, error: "invalid_user_column_data" });
    }

    // Google retries are not exactly once. This create-only write is the atomic
    // acceptance boundary: exactly one invocation can claim a lead_id. The key
    // is a one-way digest independent of the rotatable authentication key, and
    // the stored value contains no contact data or Ads IDs.
    let receipt;
    try {
      const store = getStoreFn(RECEIPT_STORE_NAME);
      receipt = await store.setJSON(
        buildReceiptKey(leadId),
        { version: 1 },
        { onlyIfNew: true }
      );
      if (!receipt || typeof receipt.modified !== "boolean") throw new Error("invalid_receipt");
    } catch {
      logOperationalEvent("error", eventId, "receipt_store", "unavailable");
      return jsonResponse(503, { ok: false, error: "temporarily_unavailable" });
    }

    if (!receipt.modified) {
      logOperationalEvent("info", eventId, "request", "duplicate_acknowledged");
      return jsonResponse(200, { ok: true, duplicate: true });
    }
    logOperationalEvent("info", eventId, "receipt_store", "claimed");

    const parsed = parseLeadFields(payload.user_column_data);
    const lead = {
      source: "google_lead_form",
      campaign_id: normalizeReference(payload.campaign_id),
      adgroup_id: normalizeReference(payload.adgroup_id),
      creative_id: normalizeReference(payload.creative_id),
      ...parsed,
    };

    // Google form disclosure covers follow-up on this request, not ongoing
    // marketing email. Fail closed even if Mailchimp credentials are present.
    logOperationalEvent("info", eventId, "mailchimp", "skipped_no_verified_marketing_consent");

    // Notification failures are operationally logged but do not make Google
    // retry an already-claimed lead and duplicate a successful sibling channel.
    await Promise.all([
      sendEmailNotification(lead, eventId, env, fetchImpl, now),
      sendSmsNotification(lead, eventId, env, fetchImpl),
    ]);

    logOperationalEvent("info", eventId, "request", "downstream_attempts_complete");
    return jsonResponse(200, { ok: true });
  };
}

export default createGoogleLeadWebhook();
