/**
 * Meta Lead Ads Webhook — Netlify Serverless Function (v2 format)
 * Lakeland Health Insurance — David Huff
 *
 * Receives Meta leadgen webhook events, fetches full lead data,
 * forwards the lead to Lead Bridge (Hopper CRM),
 * and sends email/SMS notifications.
 *
 * Endpoint: https://lakelandhealthinsurance.com/api/meta-lead-webhook
 *
 * Do not use this URL for Google Ads lead form webhooks — Google does not send
 * Meta's x-hub-signature-256; requests will fail signature check (403).
 * Use /api/google-lead-webhook for Google Ads instead.
 */

import crypto from "crypto";

// --- HELPERS ---

function getEnv(key) {
  if (typeof Netlify !== "undefined" && Netlify?.env?.get) {
    return Netlify.env.get(key) || process.env[key] || "";
  }
  return process.env[key] || "";
}

const STANDARD_KEYS = new Set([
  "full_name",
  "first_name",
  "last_name",
  "email",
  "phone_number",
  "phone",
  "city",
  "state",
  "zip_code",
  "zip",
  "post_code",
]);

function splitFullName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

const MAX_BODY_BYTES = 128 * 1024;
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const GRAPH_ID_RE = /^\d{5,30}$/;
const RELAY_TOKEN_RE = /^[A-Za-z0-9._-]{16,512}$/;

const ZIP3_STATE_RANGES = [
  [5, 5, "NY"],
  [10, 27, "MA"],
  [28, 29, "RI"],
  [30, 38, "NH"],
  [39, 49, "ME"],
  [50, 54, "VT"],
  [55, 55, "MA"],
  [56, 59, "VT"],
  [60, 69, "CT"],
  [70, 89, "NJ"],
  [100, 149, "NY"],
  [150, 196, "PA"],
  [197, 199, "DE"],
  [200, 200, "DC"],
  [201, 201, "VA"],
  [202, 205, "DC"],
  [206, 219, "MD"],
  [220, 246, "VA"],
  [247, 268, "WV"],
  [270, 289, "NC"],
  [290, 299, "SC"],
  [300, 319, "GA"],
  [320, 349, "FL"],
  [350, 369, "AL"],
  [370, 385, "TN"],
  [386, 397, "MS"],
  [398, 399, "GA"],
  [400, 427, "KY"],
  [430, 459, "OH"],
  [460, 479, "IN"],
  [480, 499, "MI"],
  [500, 528, "IA"],
  [530, 549, "WI"],
  [550, 567, "MN"],
  [569, 569, "DC"],
  [570, 577, "SD"],
  [580, 588, "ND"],
  [590, 599, "MT"],
  [600, 629, "IL"],
  [630, 658, "MO"],
  [660, 679, "KS"],
  [680, 693, "NE"],
  [700, 714, "LA"],
  [716, 729, "AR"],
  [730, 731, "OK"],
  [733, 733, "TX"],
  [734, 749, "OK"],
  [750, 799, "TX"],
  [800, 816, "CO"],
  [820, 831, "WY"],
  [832, 838, "ID"],
  [840, 847, "UT"],
  [850, 865, "AZ"],
  [870, 884, "NM"],
  [885, 885, "TX"],
  [889, 898, "NV"],
  [900, 961, "CA"],
  [967, 968, "HI"],
  [970, 979, "OR"],
  [980, 994, "WA"],
  [995, 999, "AK"],
];

function stateFromZip(zip) {
  const digits = String(zip || "").replace(/\D+/g, "");
  if (digits.length < 3) return "";
  const prefix = parseInt(digits.slice(0, 3), 10);
  if (!Number.isFinite(prefix)) return "";
  for (const [lo, hi, st] of ZIP3_STATE_RANGES) {
    if (prefix >= lo && prefix <= hi) return st;
  }
  return "";
}

function timingSafeStringEqual(a, b) {
  const digestA = crypto.createHash("sha256").update(String(a || ""), "utf-8").digest();
  const digestB = crypto.createHash("sha256").update(String(b || ""), "utf-8").digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function noStoreResponse(body, status) {
  return new Response(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const signal =
    options.signal ||
    (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(timeoutMs)
      : undefined);
  return fetch(url, { ...options, ...(signal ? { signal } : {}) });
}

// --- WEBHOOK VERIFICATION (GET) ---
function handleVerification(url) {
  const expectedToken = String(getEnv("META_VERIFY_TOKEN") || "").trim();
  if (!expectedToken) {
    console.error("Webhook verification misconfigured: META_VERIFY_TOKEN missing");
    return noStoreResponse("Webhook verification not configured", 503);
  }

  const mode = url.searchParams.get("hub.mode");
  const token = String(url.searchParams.get("hub.verify_token") || "");
  const challenge = String(url.searchParams.get("hub.challenge") || "");

  if (mode === "subscribe" && token && timingSafeStringEqual(token, expectedToken)) {
    console.log("Webhook verified successfully");
    return noStoreResponse(challenge, 200);
  }

  console.error("Webhook verification failed", { mode: String(mode || "") });
  return noStoreResponse("Verification failed", 403);
}

// --- HMAC SIGNATURE VERIFICATION ---
function verifySignature(body, signature) {
  const secret = getEnv("META_APP_SECRET_4");
  if (!secret || !signature) return false;
  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(body, "utf-8")
    .digest("hex")}`;
  return timingSafeStringEqual(expected, String(signature));
}

// --- RESOLVE PAGE TOKEN IF SYSTEM USER TOKEN IS CONFIGURED ---
async function resolveMetaAccessToken(pageId, relayToken = "") {
  const fromRelay = String(relayToken || "").trim();
  if (fromRelay && RELAY_TOKEN_RE.test(fromRelay)) return fromRelay;
  const baseToken = getEnv("META_PAGE_ACCESS_TOKEN");
  const safePageId = String(pageId || "").trim();
  if (!baseToken || !GRAPH_ID_RE.test(safePageId)) return baseToken;
  try {
    const res = await fetchWithTimeout(
      `https://graph.facebook.com/v22.0/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(baseToken)}`
    );
    if (!res.ok) return baseToken;
    const data = await res.json();
    const matched = (data.data || []).find((p) => String(p.id) === safePageId);
    return matched?.access_token || baseToken;
  } catch {
    return baseToken;
  }
}

// --- FETCH FULL LEAD DATA FROM META ---
async function fetchLeadData(leadgenId, token) {
  const safeLeadgenId = String(leadgenId || "").trim();
  if (!GRAPH_ID_RE.test(safeLeadgenId)) {
    throw new Error("Invalid Meta leadgen_id format");
  }
  const authToken = token || getEnv("META_PAGE_ACCESS_TOKEN");
  const url = `https://graph.facebook.com/v22.0/${encodeURIComponent(safeLeadgenId)}?fields=id,created_time,field_data,ad_id,campaign_id,campaign_name,form_id&access_token=${encodeURIComponent(authToken)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new Error(`Meta Graph API HTTP ${res.status}`);
  }
  return res.json();
}

// --- FETCH FORM DETAILS ---
async function fetchFormName(formId, token) {
  const safeFormId = String(formId || "").trim();
  if (!GRAPH_ID_RE.test(safeFormId)) return "Unknown Form";
  const authToken = token || getEnv("META_PAGE_ACCESS_TOKEN");
  const url = `https://graph.facebook.com/v22.0/${encodeURIComponent(safeFormId)}?fields=name&access_token=${encodeURIComponent(authToken)}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return "Unknown Form";
    const data = await res.json();
    return data.name || "Unknown Form";
  } catch {
    return "Unknown Form";
  }
}

// --- PARSE LEAD FIELDS (INCLUDING CUSTOM QUALIFYING QUESTIONS) ---
export function parseLeadFields(fieldData) {
  const fields = {};
  const customAnswers = {};
  for (const item of fieldData || []) {
    const key = item.name?.toLowerCase().replace(/\s+/g, "_");
    const val = item.values?.[0] || "";
    if (!key) continue;
    fields[key] = val;
    if (!STANDARD_KEYS.has(key) && val) {
      customAnswers[key] = val;
    }
  }
  const fullName =
    fields.full_name || `${fields.first_name || ""} ${fields.last_name || ""}`.trim();
  const split = splitFullName(fullName);
  const firstName = fields.first_name || split.firstName;
  const lastName = fields.last_name || split.lastName;
  const zip = fields.zip_code || fields.zip || fields.post_code || "";
  const rawState = String(fields.state || "").trim().toUpperCase();
  const state = /^[A-Z]{2}$/.test(rawState) ? rawState : stateFromZip(zip);

  return {
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    email: fields.email || "",
    phone: fields.phone_number || fields.phone || "",
    city: fields.city || "",
    state,
    zip,
    custom_answers: customAnswers,
  };
}

function inferInsuranceType(formName = "", customAnswers = {}) {
  const combined = `${formName} ${JSON.stringify(customAnswers)}`.toLowerCase();
  if (combined.includes("medicare") || combined.includes("turning_65") || combined.includes("medigap")) {
    return "Medicare";
  }
  return "ACA / Marketplace";
}

function formatQualifyingAnswers(customAnswers = {}) {
  const entries = Object.entries(customAnswers || {}).filter(([, v]) => Boolean(v));
  if (!entries.length) return "";
  return entries
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
    .join(" | ");
}

// --- FORWARD TO LEAD BRIDGE (HOPPER CRM) ---
function validateBridgeEndpoint(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return null;
  }
  const isHttps = parsed.protocol === "https:";
  const isLocalHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (!isHttps && !isLocalHttp) return null;
  const clean = parsed.toString().replace(/\/+$/, "");
  return clean.endsWith("/website/lead") ? clean : `${clean}/website/lead`;
}

async function forwardLeadToBridge(lead) {
  const baseUrl = String(getEnv("LEAD_BRIDGE_URL") || "").trim().replace(/\/+$/, "");
  const bridgeKey = String(getEnv("LEAD_BRIDGE_KEY") || "").trim();
  if (!baseUrl || !bridgeKey) {
    console.log("LEAD_BRIDGE_URL / LEAD_BRIDGE_KEY not configured — skipping bridge forward");
    return { ok: false, skipped: true };
  }

  const endpoint = validateBridgeEndpoint(baseUrl);
  if (!endpoint) {
    console.error("Invalid LEAD_BRIDGE_URL protocol or format");
    return { ok: false, invalidConfig: true };
  }

  const qualifyingSummary = formatQualifyingAnswers(lead.custom_answers);
  const insuranceType = inferInsuranceType(lead.form_name, lead.custom_answers);
  const notes = [
    `Meta Instant Form: ${lead.form_name || lead.form_id || "Meta Lead Ad"}`,
    `Line of Business: ${insuranceType}`,
    qualifyingSummary ? `Qualifying Answers: ${qualifyingSummary}` : "",
    lead.ad_id ? `Ad ID: ${lead.ad_id}` : "",
    lead.campaign_id ? `Campaign ID: ${lead.campaign_id}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const payload = {
    source: "website_form",
    submission_id: String(lead.leadgen_id || ""),
    first_name: lead.first_name || "",
    last_name: lead.last_name || "",
    name: lead.full_name || "",
    email: lead.email || "",
    phone: lead.phone || "",
    zip: lead.zip || "",
    state: lead.state || "",
    form_name: lead.form_name || "meta_instant_form",
    intent: insuranceType,
    insurance_type: insuranceType,
    utm_source: "facebook",
    utm_medium: "paid_social",
    utm_campaign: lead.campaign_name || lead.campaign_id || "meta_instant_form",
    message: notes,
    notes,
    consent: {
      request: true,
      call: true,
      sms: false,
      email: Boolean(lead.email),
      granted: true,
    },
  };

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-key": bridgeKey,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Lead bridge forward failed: HTTP ${res.status}`);
      return { ok: false, status: res.status };
    }
    console.log("Lead forwarded to Lead Bridge (Hopper CRM)");
    return { ok: true, status: res.status };
  } catch (err) {
    console.error(`Lead bridge forward exception: ${err?.name || "Error"}`);
    return { ok: false, error: String(err?.name || "Error") };
  }
}

// --- SEND EMAIL NOTIFICATION ---
async function sendEmailNotification(lead) {
  const RESEND_API_KEY = getEnv("RESEND_API_KEY");
  const NOTIFY_EMAIL = getEnv("NOTIFY_EMAIL");

  if (!RESEND_API_KEY || !NOTIFY_EMAIL) {
    console.log("Email not configured — skipping");
    return;
  }

  const qualifyingSummary = formatQualifyingAnswers(lead.custom_answers);
  const insuranceType = inferInsuranceType(lead.form_name, lead.custom_answers);

  const body = [
    `NEW META INSTANT FORM LEAD — ${lead.full_name || "Unknown"}`,
    ``,
    `Source: Meta Lead Ad (${insuranceType})`,
    `Campaign: ${lead.campaign_name || lead.campaign_id || "Unknown"}`,
    `Form: ${lead.form_name || "Unknown"}`,
    qualifyingSummary ? `Qualifying Answers: ${qualifyingSummary}` : null,
    ``,
    `Name: ${lead.full_name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone}`,
    `Location: ${lead.city}, ${lead.state} ${lead.zip}`,
    ``,
    `Time: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`,
    ``,
    `ACTION: Call or text this lead ASAP (also synced to Hopper CRM).`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  try {
    const res = await fetchWithTimeout("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "LHI Bot <leads@lakelandhealthinsurance.com>",
        to: NOTIFY_EMAIL,
        subject: `New ${insuranceType} Lead: ${lead.full_name || "Meta Instant Form"}`,
        text: body,
      }),
    });

    if (res.ok) console.log("Email notification sent");
    else console.error(`Email failed: HTTP ${res.status}`);
  } catch (err) {
    console.error(`Email exception: ${err?.name || "Error"}`);
  }
}

// --- SEND SMS NOTIFICATION ---
async function sendSmsNotification(lead) {
  const TWILIO_SID = getEnv("TWILIO_SID");
  const TWILIO_AUTH = getEnv("TWILIO_AUTH");
  const TWILIO_FROM = getEnv("TWILIO_FROM");
  const TWILIO_TO = getEnv("TWILIO_TO");

  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM || !TWILIO_TO) {
    console.log("Twilio not configured — skipping SMS");
    return;
  }

  const qualifyingSummary = formatQualifyingAnswers(lead.custom_answers);
  const message = [
    `[LHI] New Lead: ${lead.full_name || "Unknown"}`,
    `Phone: ${lead.phone || "N/A"}`,
    `Form: ${lead.form_name || "Meta Instant Form"}`,
    qualifyingSummary ? `Details: ${qualifyingSummary}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    To: TWILIO_TO,
    From: TWILIO_FROM,
    Body: message,
  });

  try {
    const res = await fetchWithTimeout(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_SID)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_AUTH}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (res.ok) console.log("SMS notification sent");
    else console.error(`SMS failed: HTTP ${res.status}`);
  } catch (err) {
    console.error(`SMS exception: ${err?.name || "Error"}`);
  }
}

// --- MAIN HANDLER ---
export default async (req, context) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    return handleVerification(url);
  }

  if (req.method === "POST") {
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return noStoreResponse("Payload too large", 413);
    }

    const appSecret = String(getEnv("META_APP_SECRET_4") || "").trim();
    if (!appSecret) {
      console.error("Webhook misconfigured: META_APP_SECRET_4 missing");
      return noStoreResponse("Webhook signature secret not configured", 503);
    }

    const signature = req.headers.get("x-hub-signature-256");
    if (!verifySignature(rawBody, signature)) {
      console.error("Invalid signature");
      return noStoreResponse("Invalid signature", 403);
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return noStoreResponse("Invalid JSON payload", 400);
    }
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.entry)) {
      return noStoreResponse("Invalid webhook payload", 400);
    }

    const relayPageToken = (req.headers.get("x-meta-page-access-token") || "").trim();
    let hasRetryableFailure = false;

    for (const entry of payload.entry) {
      const changes = entry && Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        if (!change || change.field !== "leadgen") continue;

        const { leadgen_id, form_id, ad_id, created_time, page_id } = change.value || {};
        const safeLeadgenId = String(leadgen_id || "").trim();
        if (!GRAPH_ID_RE.test(safeLeadgenId)) {
          console.error("Skipping leadgen event with invalid leadgen_id");
          continue;
        }
        const effectivePageId = page_id || entry.id || null;
        console.log(`Processing lead: ${safeLeadgenId}`);

        try {
          const pageToken = await resolveMetaAccessToken(effectivePageId, relayPageToken);
          const leadData = await fetchLeadData(safeLeadgenId, pageToken);
          const parsed = parseLeadFields(leadData.field_data);
          const formName = await fetchFormName(form_id, pageToken);

          const lead = {
            source: "meta_lead_form",
            leadgen_id: safeLeadgenId,
            form_id,
            form_name: formName,
            ad_id: ad_id || leadData.ad_id || null,
            campaign_id: leadData.campaign_id || null,
            campaign_name: leadData.campaign_name || null,
            page_id: effectivePageId,
            created_time: created_time || leadData.created_time || null,
            ...parsed,
            raw_payload: leadData,
            status: "new",
            notified_at: new Date().toISOString(),
          };

          const [bridgeResult] = await Promise.allSettled([
            forwardLeadToBridge(lead),
            sendEmailNotification(lead),
            sendSmsNotification(lead),
          ]);
          const bridgeValue = bridgeResult.status === "fulfilled" ? bridgeResult.value : null;
          if (!bridgeValue || (!bridgeValue.ok && !bridgeValue.skipped)) {
            hasRetryableFailure = true;
          }

          console.log(`Lead processed: ${safeLeadgenId}`);
        } catch (err) {
          hasRetryableFailure = true;
          console.error(`Failed to process lead ${safeLeadgenId}: ${err?.name || "Error"}`);
        }
      }
    }

    if (hasRetryableFailure) {
      return noStoreResponse("Upstream delivery failure", 502);
    }

    return noStoreResponse("OK", 200);
  }

  return noStoreResponse("Method not allowed", 405);
};

// --- ROUTE CONFIG ---
export const config = {
  path: "/api/meta-lead-webhook",
};
