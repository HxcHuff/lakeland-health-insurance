/**
 * Forward an accepted LHI Get Help lead to Hopper CRM ingest.
 * Never throws to the caller. Skips when secret/URL missing.
 * Does not enable Twilio; Hopper stays fail-closed on its own flags.
 */

const TCPA_SMS_TEXT =
  "I authorize text messages about this request. Message frequency varies; message and data rates may apply. Reply STOP to cancel or HELP for help. See SMS Terms.";

function headerValue(headers, name) {
  if (!headers) return "";
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || "";
}

function splitName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "Lead" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

function numericOrUndefined(value) {
  if (value == null || value === "") return undefined;
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function zipOrUndefined(value) {
  const zip = String(value || "").replace(/\D/g, "").slice(0, 5);
  return /^\d{5}$/.test(zip) ? zip : undefined;
}

function isMedicare(payload) {
  const intent = String(payload.normalized_intent || payload.inquiry_type || payload.line_of_business || "")
    .trim()
    .toLowerCase();
  return intent === "medicare" || intent.includes("medicare");
}

function buildHopperPayload(payload, headers) {
  const { first_name, last_name } = splitName(payload.full_name);
  const email = String(payload.email || "").trim();
  const phone = String(payload.phone || "").trim();
  if (!first_name || !email || !phone) return null;

  const medicare = isMedicare(payload);
  const smsGranted = payload.consent_sms === "yes" && Boolean(phone) && !medicare;
  const timestamp =
    payload.consent_recorded_at ||
    payload.server_received_at ||
    new Date().toISOString();

  const body = {
    source: "website_form",
    campaign: "lhi-get-help",
    first_name,
    last_name,
    phone,
    email,
    tcpa_consent: smsGranted,
  };

  const zip = zipOrUndefined(payload.zip_code);
  if (zip) body.zip = zip;

  const household = numericOrUndefined(payload.household_size);
  if (household && Number.isInteger(household)) body.household_size = household;

  const income = numericOrUndefined(payload.income);
  if (income) body.estimated_income = income;

  const event = String(payload.normalized_intent || payload.inquiry_type || "").trim();
  if (event) body.qualifying_event = event.slice(0, 200);

  if (smsGranted) {
    body.tcpa_consent_text = TCPA_SMS_TEXT;
    body.tcpa_timestamp = timestamp;
  }

  if (payload.utm_source) body.utm_source = String(payload.utm_source).slice(0, 80);
  if (payload.utm_campaign) body.utm_campaign = String(payload.utm_campaign).slice(0, 80);
  if (payload.utm_content) body.utm_content = String(payload.utm_content).slice(0, 80);

  const ip = String(headerValue(headers, "x-forwarded-for") || "").split(",")[0].trim();
  if (ip) body.ip_address = ip.slice(0, 64);
  const ua = String(headerValue(headers, "user-agent") || "").trim();
  if (ua) body.user_agent = ua.slice(0, 500);

  return body;
}

async function forwardGetHelpToHopper({ payload, headers, eventId }) {
  try {
    if (!payload || payload["form-name"] !== "get-help") return { skipped: true, reason: "not_get_help" };

    const url = String(process.env.HOPPER_INGEST_URL || "").trim();
    const secret = String(process.env.HOPPER_LEAD_INGEST_SECRET || "").trim();
    if (!url || !secret) {
      console.info(JSON.stringify({
        type: "hopper_ingest_skipped_v1",
        event_id: eventId || null,
        reason: "missing_url_or_secret",
      }));
      return { skipped: true, reason: "missing_url_or_secret" };
    }

    const body = buildHopperPayload(payload, headers);
    if (!body) {
      console.info(JSON.stringify({
        type: "hopper_ingest_skipped_v1",
        event_id: eventId || null,
        reason: "incomplete_contact",
      }));
      return { skipped: true, reason: "incomplete_contact" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    console.info(JSON.stringify({
      type: "hopper_ingest_outcome_v1",
      event_id: eventId || null,
      status: res.status,
      tcpa: body.tcpa_consent,
    }));
    return { skipped: false, status: res.status };
  } catch (err) {
    console.error(JSON.stringify({
      type: "hopper_ingest_failed_v1",
      event_id: eventId || null,
      error: err && err.name ? err.name : "error",
    }));
    return { skipped: false, error: true };
  }
}

module.exports = {
  TCPA_SMS_TEXT,
  buildHopperPayload,
  forwardGetHelpToHopper,
};
