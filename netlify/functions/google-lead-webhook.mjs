/**
 * Google Ads lead-form intake and durable CRM relay.
 *
 * The Google-facing shared key authenticates intake only. A separate HMAC
 * secret signs the minimized payload delivered to the pinned Apps Script CRM
 * endpoint. No Mailchimp, Twilio, customer messaging, or PII-bearing
 * notification is performed by this function.
 */

import crypto from "node:crypto";
import {
  GoogleAdsRelayError,
  RELAY_PROTOCOL,
  acceptOperationalPayload,
  attemptOperationalDelivery,
  authenticateGooglePayload,
  deliverTestPayload,
  googleWebhookKeyForPayload,
  normalizeGoogleAdsPayload,
  productionStoreFactory,
  requireProductionContext,
  validateGoogleAdsConfiguration,
} from "./lib/google-ads-crm-relay.mjs";

const MAX_BODY_BYTES = 64 * 1024;

function getEnv(key) {
  try {
    const value = globalThis.Netlify?.env?.get?.(key);
    if (value !== undefined && value !== null && value !== "") return String(value);
  } catch {
    // process.env is the supported fallback for local and scheduled runtimes.
  }
  return String(process.env[key] || "");
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

function defaultLogger(entry) {
  const line = JSON.stringify(entry);
  if (["REJECTED", "FAILED", "QUARANTINED", "CHANGED_REPLAY"].includes(entry.outcome)) {
    console.error(line);
  } else {
    console.info(line);
  }
}

function safeLog(logger, outcome, reason = null) {
  try {
    logger(Object.freeze({
      event: "google_ads_lead_crm_relay",
      outcome,
      reason,
    }));
  } catch {
    // Observability must not affect acceptance or disclose lead material.
  }
}

async function parseRequestBody(req) {
  const contentLength = req.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES) {
      throw new GoogleAdsRelayError("payload_too_large", 413);
    }
  }
  let rawBody;
  try {
    rawBody = await req.text();
  } catch {
    throw new GoogleAdsRelayError("invalid_request", 400);
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    throw new GoogleAdsRelayError("payload_too_large", 413);
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new GoogleAdsRelayError("invalid_json", 400);
  }
}

export function createGoogleLeadWebhook({
  env = getEnv,
  storeFactory = productionStoreFactory,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  randomBytes = crypto.randomBytes,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  timeoutMilliseconds = RELAY_PROTOCOL.timeoutMilliseconds,
  logger = defaultLogger,
} = {}) {
  return async function googleLeadWebhook(req) {
    if (req.method !== "POST") {
      return jsonResponse(405, { message: "method_not_allowed" });
    }

    try {
      const rawPayload = await parseRequestBody(req);
      const googleAdsConfiguration = validateGoogleAdsConfiguration(env);
      const googleWebhookKey = googleWebhookKeyForPayload(rawPayload, googleAdsConfiguration);
      authenticateGooglePayload(rawPayload, googleWebhookKey);
      const payload = normalizeGoogleAdsPayload(rawPayload, googleAdsConfiguration);
      requireProductionContext(env);
      const nowMilliseconds = Number(now());

      if (payload.is_test) {
        await deliverTestPayload({
          payload,
          env,
          googleAdsConfiguration,
          fetchImpl,
          nowMilliseconds,
          randomBytes,
          setTimer,
          clearTimer,
          timeoutMilliseconds,
        });
        safeLog(logger, "TEST_ACKNOWLEDGED");
        return jsonResponse(200, {});
      }

      const intake = await acceptOperationalPayload({ storeFactory, payload, nowMilliseconds });
      if (intake.kind === "CHANGED_REPLAY") {
        safeLog(logger, "CHANGED_REPLAY", "source_id_payload_drift");
        return jsonResponse(409, { message: "source_id_payload_drift" });
      }
      if (intake.kind === "EXACT_REPLAY") {
        safeLog(logger, "EXACT_REPLAY");
        return jsonResponse(200, {});
      }

      safeLog(logger, "DURABLY_ACCEPTED");
      let delivery;
      try {
        delivery = await attemptOperationalDelivery({
          store: intake.store,
          key: intake.key,
          env,
          fetchImpl,
          nowMilliseconds,
          randomBytes,
          setTimer,
          clearTimer,
          timeoutMilliseconds,
        });
      } catch (error) {
        const reason = error instanceof GoogleAdsRelayError ? error.code : "relay_internal_error";
        safeLog(logger, "DELIVERY_DEFERRED", reason);
        return jsonResponse(200, {});
      }
      safeLog(logger, delivery.kind, delivery.entry?.record?.last_reason || null);
      return jsonResponse(200, {});
    } catch (error) {
      const controlled = error instanceof GoogleAdsRelayError
        ? error
        : new GoogleAdsRelayError("relay_internal_error", 500);
      safeLog(logger, "REJECTED", controlled.code);
      return jsonResponse(controlled.statusCode, { message: controlled.code });
    }
  };
}

export default createGoogleLeadWebhook();
