/**
 * Google Ads Lead Form Webhook — Netlify Serverless Function
 * Lakeland Health Insurance — David Huff
 *
 * Receives Google Ads Lead Form submissions, validates the shared key,
 * stores the lead in HuffHealthApp Supabase, syncs to Mailchimp,
 * and fires email + SMS notifications.
 *
 * Served at: https://lakelandhealthinsurance.com/api/google-lead-webhook
 * (netlify.toml rewrite → /.netlify/functions/google-lead-webhook)
 *
 * Required env vars:
 *   GOOGLE_LEAD_WEBHOOK_KEY  — must equal the "Key" value pasted into the
 *                              Google Ads lead form webhook UI. Validated via
 *                              constant-time compare against payload.google_key.
 *
 * Optional env vars (each block no-ops gracefully if unset):
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY, DEFAULT_USER_ID
 *   RESEND_API_KEY, NOTIFY_EMAIL
 *   TWILIO_SID, TWILIO_AUTH, TWILIO_FROM, TWILIO_TO
 *   MAILCHIMP_API_KEY, MAILCHIMP_AUDIENCE_ID, MAILCHIMP_SERVER_PREFIX
 *
 * Google Ads spec (POST application/json):
 *   {
 *     "lead_id": "...", "api_version": "1.0", "google_key": "<shared-secret>",
 *     "is_test": false, "gcl_id": "...", "form_id": ..., "campaign_id": ...,
 *     "adgroup_id": ..., "creative_id": ...,
 *     "user_column_data": [
 *       { "column_name": "...", "string_value": "...", "column_id": "FULL_NAME" },
 *       ...
 *     ]
 *   }
 *
 * Test-mode payloads (is_test=true) are acknowledged with 200 and skip all
 * I/O so Google's "Send test data" button doesn't pollute the CRM.
 */

import crypto from "crypto";

function getEnv(key) {
  return Netlify.env.get(key) || "";
}

function safeEqual(a, b) {
  if (!a || !b) return false;
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Map Google Ads column_id values into our internal lead shape.
// Falls back to column_name (lowercased, snake_cased) when column_id is absent.
function parseLeadFields(userColumnData) {
  const raw = {};
  for (const item of userColumnData || []) {
    const id = (item.column_id || "").toUpperCase();
    const fallback = (item.column_name || "").toLowerCase().replace(/\s+/g, "_");
    const key = id || fallback;
    if (key) raw[key] = item.string_value || "";
  }

  const fullName =
    raw.FULL_NAME ||
    raw.full_name ||
    [raw.FIRST_NAME || raw.first_name, raw.LAST_NAME || raw.last_name].filter(Boolean).join(" ").trim();

  return {
    full_name: fullName,
    first_name: raw.FIRST_NAME || raw.first_name || (fullName.split(" ")[0] || ""),
    last_name:
      raw.LAST_NAME || raw.last_name || (fullName.split(" ").slice(1).join(" ") || ""),
    email: raw.EMAIL || raw.WORK_EMAIL || raw.email || "",
    phone: raw.PHONE_NUMBER || raw.WORK_PHONE || raw.phone_number || raw.phone || "",
    city: raw.CITY || raw.city || "",
    state: raw.REGION || raw.state || raw.region || "FL",
    zip: raw.POSTAL_CODE || raw.ZIP_CODE || raw.postal_code || raw.zip_code || raw.zip || "",
    company: raw.COMPANY_NAME || raw.company_name || "",
    job_title: raw.JOB_TITLE || raw.job_title || "",
  };
}

async function storeInSupabase(lead) {
  const SUPABASE_URL = getEnv("SUPABASE_URL");
  const SUPABASE_SERVICE_KEY = getEnv("SUPABASE_SERVICE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log("Supabase not configured — skipping storage");
    return null;
  }

  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    Prefer: "return=representation",
  };

  const leadRow = {
    id: crypto.randomUUID(),
    firstName: lead.first_name || "",
    lastName: lead.last_name || "",
    email: lead.email || null,
    phone: lead.phone || null,
    source: "google_lead_form",
    status: "NEW_LEAD",
    stageEnteredAt: new Date().toISOString(),
    city: lead.city || null,
    state: lead.state || "FL",
    zipCode: lead.zip || null,
    leadgenId: lead.lead_id,
    formId: lead.form_id != null ? String(lead.form_id) : null,
    formName: lead.form_name || null,
    adId: lead.creative_id != null ? String(lead.creative_id) : null,
    campaignId: lead.campaign_id != null ? String(lead.campaign_id) : null,
    campaignName: null,
    pageId: null,
    rawPayload: lead.raw_payload || null,
    notifiedAt: new Date().toISOString(),
    customFields: {
      webhook_source: "google_lead_webhook",
      adgroup_id: lead.adgroup_id != null ? String(lead.adgroup_id) : null,
      gcl_id: lead.gcl_id || null,
      api_version: lead.api_version || null,
      received_at: new Date().toISOString(),
    },
    createdById: getEnv("DEFAULT_USER_ID") || "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/Lead`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(leadRow),
  });

  if (!res.ok) {
    console.error("Supabase Lead insert failed:", await res.text());
    return null;
  }

  const [inserted] = await res.json();
  console.log("Lead stored in HuffHealthApp:", inserted?.id);

  if (inserted?.id) {
    await fetch(`${SUPABASE_URL}/rest/v1/Activity`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: crypto.randomUUID(),
        type: "GOOGLE_ADS_SYNC",
        description: `New lead from Google Ads lead form: ${lead.full_name || "Unknown"} (campaign ${lead.campaign_id || "?"})`,
        metadata: {
          lead_id: lead.lead_id,
          campaign_id: lead.campaign_id,
          adgroup_id: lead.adgroup_id,
          creative_id: lead.creative_id,
          form_id: lead.form_id,
          gcl_id: lead.gcl_id,
          source: "google_lead_webhook",
        },
        performedById: getEnv("DEFAULT_USER_ID") || "system",
        leadId: inserted.id,
        createdAt: new Date().toISOString(),
      }),
    });
  }

  return inserted;
}

// Mailchimp upsert — mirrors lead.js behavior for hot paid leads.
// Tags: google-ads, paid-ad, hot-lead. Status: subscribed (already gave
// explicit consent + phone via Google's lead form).
async function syncToMailchimp(lead) {
  const MC_API_KEY = getEnv("MAILCHIMP_API_KEY");
  const MC_AUDIENCE_ID = getEnv("MAILCHIMP_AUDIENCE_ID");
  const MC_SERVER = getEnv("MAILCHIMP_SERVER_PREFIX");
  if (!MC_API_KEY || !MC_AUDIENCE_ID || !MC_SERVER) {
    console.log("Mailchimp not configured — skipping sync");
    return;
  }
  const email = (lead.email || "").trim();
  if (!email) {
    console.log("No email on Google lead — skipping Mailchimp");
    return;
  }

  const hash = crypto.createHash("md5").update(email.toLowerCase()).digest("hex");
  const baseUrl = `https://${MC_SERVER}.api.mailchimp.com/3.0/lists/${MC_AUDIENCE_ID}/members/${hash}`;
  const auth = "Basic " + Buffer.from("any:" + MC_API_KEY).toString("base64");

  const mergeFields = {};
  if (lead.first_name) mergeFields.FNAME = lead.first_name;
  if (lead.last_name) mergeFields.LNAME = lead.last_name;
  if (lead.phone) mergeFields.PHONE = lead.phone;

  try {
    const upsert = await fetch(baseUrl, {
      method: "PUT",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        email_address: email,
        merge_fields: mergeFields,
        status: "subscribed",
      }),
    });
    if (!upsert.ok) {
      console.error(`Mailchimp upsert ${upsert.status}:`, (await upsert.text()).slice(0, 300));
      return;
    }
    const tagRes = await fetch(`${baseUrl}/tags`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        tags: [
          { name: "google-ads", status: "active" },
          { name: "paid-ad", status: "active" },
          { name: "hot-lead", status: "active" },
        ],
      }),
    });
    if (!tagRes.ok) {
      console.error(`Mailchimp tag ${tagRes.status}:`, (await tagRes.text()).slice(0, 300));
    }
  } catch (e) {
    console.error("Mailchimp sync exception:", e);
  }
}

async function sendEmailNotification(lead) {
  const RESEND_API_KEY = getEnv("RESEND_API_KEY");
  const NOTIFY_EMAIL = getEnv("NOTIFY_EMAIL");
  if (!RESEND_API_KEY || !NOTIFY_EMAIL) {
    console.log("Email not configured — skipping");
    return;
  }

  const body = [
    `NEW LEAD — ${lead.full_name || "Unknown"}`,
    ``,
    `Source: Google Ads Lead Form`,
    `Campaign: ${lead.campaign_id || "Unknown"}`,
    `Ad Group: ${lead.adgroup_id || "Unknown"}`,
    `Creative: ${lead.creative_id || "Unknown"}`,
    ``,
    `Name: ${lead.full_name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone}`,
    `Location: ${lead.city}, ${lead.state} ${lead.zip}`,
    ``,
    `Time: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`,
    ``,
    `ACTION: Call/text this lead ASAP — Google Ads paid traffic.`,
    `SLA target: < 2 hours from submission.`,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "LHI Bot <leads@lakelandhealthinsurance.com>",
      to: NOTIFY_EMAIL,
      subject: `New Lead: ${lead.full_name || "Google Ads Lead Form"}`,
      text: body,
    }),
  });

  if (res.ok) console.log("Email notification sent");
  else console.error("Email failed:", await res.text());
}

async function sendSmsNotification(lead) {
  const TWILIO_SID = getEnv("TWILIO_SID");
  const TWILIO_AUTH = getEnv("TWILIO_AUTH");
  const TWILIO_FROM = getEnv("TWILIO_FROM");
  const TWILIO_TO = getEnv("TWILIO_TO");
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM || !TWILIO_TO) {
    console.log("Twilio not configured — skipping SMS");
    return;
  }

  const message = [
    `[LHI] New Google Ads Lead: ${lead.full_name || "Unknown"}`,
    `Phone: ${lead.phone || "N/A"}`,
    `Email: ${lead.email || "N/A"}`,
    `Campaign: ${lead.campaign_id || "?"}`,
  ].join("\n");

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

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("Invalid JSON from Google Ads webhook");
    return new Response("Invalid JSON", { status: 400 });
  }

  // Shared-key validation (Google Ads sends the configured key in the body).
  // Constant-time compare to avoid timing oracles.
  const expectedKey = getEnv("GOOGLE_LEAD_WEBHOOK_KEY");
  if (!expectedKey) {
    console.error("GOOGLE_LEAD_WEBHOOK_KEY not set — refusing to process");
    return new Response("Webhook misconfigured", { status: 500 });
  }
  if (!safeEqual(payload.google_key, expectedKey)) {
    console.error("Invalid google_key on lead webhook");
    return new Response("Invalid key", { status: 403 });
  }

  // Test payloads from the Google Ads "Send test data" button: ack 200 and
  // skip all downstream I/O so the CRM stays clean.
  if (payload.is_test === true) {
    console.log("Google Ads test payload received — acknowledged, skipping I/O");
    return new Response("OK (test)", { status: 200 });
  }

  const parsed = parseLeadFields(payload.user_column_data);
  const lead = {
    source: "google_lead_form",
    lead_id: payload.lead_id,
    api_version: payload.api_version,
    form_id: payload.form_id,
    campaign_id: payload.campaign_id,
    adgroup_id: payload.adgroup_id,
    creative_id: payload.creative_id,
    gcl_id: payload.gcl_id,
    ...parsed,
    raw_payload: payload,
    status: "new",
    notified_at: new Date().toISOString(),
  };

  // Run downstream I/O concurrently. Errors are logged inside each helper —
  // none of them throw, so a Mailchimp/Twilio outage can't break the 200.
  await Promise.all([
    storeInSupabase(lead),
    syncToMailchimp(lead),
    sendEmailNotification(lead),
    sendSmsNotification(lead),
  ]);

  console.log(`Google Ads lead processed: ${lead.full_name} (${lead.email})`);
  return new Response("OK", { status: 200 });
};
