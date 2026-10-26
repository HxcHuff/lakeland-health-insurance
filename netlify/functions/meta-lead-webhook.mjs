/**
 * Meta Lead Ads Webhook — Netlify Serverless Function (v2 format)
 * Lakeland Health Insurance — David Huff
 *
 * Receives Meta leadgen webhook events, fetches full lead data,
 * forwards the lead to Lead Bridge (HubSpot 247504188 + Hopper CRM),
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

// --- WEBHOOK VERIFICATION (GET) ---
function handleVerification(url) {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === getEnv("META_VERIFY_TOKEN")) {
    console.log("Webhook verified successfully");
    return new Response(challenge, { status: 200 });
  }

  console.error("Webhook verification failed", { mode, token });
  return new Response("Verification failed", { status: 403 });
}

// --- HMAC SIGNATURE VERIFICATION ---
function verifySignature(body, signature) {
  const secret = getEnv("META_APP_SECRET_4");
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body, "utf-8")
    .digest("hex");
  return `sha256=${expected}` === signature;
}

// --- RESOLVE PAGE TOKEN IF SYSTEM USER TOKEN IS CONFIGURED ---
async function resolveMetaAccessToken(pageId, relayToken = "") {
  const fromRelay = String(relayToken || "").trim();
  if (fromRelay) return fromRelay;
  const baseToken = getEnv("META_PAGE_ACCESS_TOKEN");
  if (!baseToken || !pageId) return baseToken;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(baseToken)}`
    );
    if (!res.ok) return baseToken;
    const data = await res.json();
    const matched = (data.data || []).find((p) => String(p.id) === String(pageId));
    return matched?.access_token || baseToken;
  } catch {
    return baseToken;
  }
}

// --- FETCH FULL LEAD DATA FROM META ---
async function fetchLeadData(leadgenId, token) {
  const authToken = token || getEnv("META_PAGE_ACCESS_TOKEN");
  const url = `https://graph.facebook.com/v22.0/${leadgenId}?fields=id,created_time,field_data,ad_id,campaign_id,campaign_name,form_id&access_token=${encodeURIComponent(authToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meta API error: ${res.status} — ${err}`);
  }
  return res.json();
}

// --- FETCH FORM DETAILS ---
async function fetchFormName(formId, token) {
  const authToken = token || getEnv("META_PAGE_ACCESS_TOKEN");
  const url = `https://graph.facebook.com/v22.0/${formId}?fields=name&access_token=${encodeURIComponent(authToken)}`;
  try {
    const res = await fetch(url);
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

  return {
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    email: fields.email || "",
    phone: fields.phone_number || fields.phone || "",
    city: fields.city || "",
    state: fields.state || "FL",
    zip: fields.zip_code || fields.zip || fields.post_code || "",
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

// --- FORWARD TO LEAD BRIDGE (HUBSPOT 247504188 + HOPPER CRM) ---
async function forwardLeadToBridge(lead) {
  const baseUrl = String(getEnv("LEAD_BRIDGE_URL") || "").trim().replace(/\/+$/, "");
  const bridgeKey = String(getEnv("LEAD_BRIDGE_KEY") || "").trim();
  if (!baseUrl || !bridgeKey) {
    console.log("LEAD_BRIDGE_URL / LEAD_BRIDGE_KEY not configured — skipping bridge forward");
    return { ok: false, skipped: true };
  }

  const endpoint = baseUrl.endsWith("/website/lead")
    ? baseUrl
    : `${baseUrl}/website/lead`;
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
    state: lead.state || "FL",
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
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-key": bridgeKey,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("Lead bridge forward failed:", res.status, await res.text());
      return { ok: false, status: res.status };
    }
    console.log("Lead forwarded to Lead Bridge (HubSpot + Hopper CRM)");
    return { ok: true, status: res.status };
  } catch (err) {
    console.error("Lead bridge forward exception:", err);
    return { ok: false, error: String(err?.message || err) };
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
    `ACTION: Call or text this lead ASAP (also synced to Hopper CRM & HubSpot).`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const res = await fetch("https://api.resend.com/emails", {
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
  else console.error("Email failed:", await res.text());
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

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
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
  else console.error("SMS failed:", await res.text());
}

// --- MAIN HANDLER ---
export default async (req, context) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    return handleVerification(url);
  }

  if (req.method === "POST") {
    const rawBody = await req.text();

    const signature = req.headers.get("x-hub-signature-256");
    if (getEnv("META_APP_SECRET_4") && !verifySignature(rawBody, signature)) {
      console.error("Invalid signature");
      return new Response("Invalid signature", { status: 403 });
    }

    const relayPageToken = (req.headers.get("x-meta-page-access-token") || "").trim();
    const payload = JSON.parse(rawBody);
    console.log("Webhook received:", JSON.stringify(payload, null, 2));

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "leadgen") continue;

        const { leadgen_id, form_id, ad_id, created_time, page_id } = change.value;
        const effectivePageId = page_id || entry.id || null;
        console.log(`Processing lead: ${leadgen_id}`);

        try {
          const pageToken = await resolveMetaAccessToken(effectivePageId, relayPageToken);
          const leadData = await fetchLeadData(leadgen_id, pageToken);
          const parsed = parseLeadFields(leadData.field_data);
          const formName = await fetchFormName(form_id, pageToken);

          const lead = {
            source: "meta_lead_form",
            leadgen_id,
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

          await Promise.all([
            forwardLeadToBridge(lead),
            sendEmailNotification(lead),
            sendSmsNotification(lead),
          ]);

          console.log(`Lead processed: ${lead.full_name} (${lead.email})`);
        } catch (err) {
          console.error(`Failed to process lead ${leadgen_id}:`, err);
        }
      }
    }

    return new Response("OK", { status: 200 });
  }

  return new Response("Method not allowed", { status: 405 });
};

// --- ROUTE CONFIG ---
export const config = {
  path: "/api/meta-lead-webhook",
};
