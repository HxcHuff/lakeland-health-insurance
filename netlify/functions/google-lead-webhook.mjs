/**
 * Google Ads Lead Form Webhook — Netlify Serverless Function (v2 format)
 * Lakeland Health Insurance — David Huff
 *
 * Receives Google Ads lead form extension webhook events,
 * stores in HuffHealthApp Supabase, and sends email/SMS notification.
 *
 * Endpoint: https://lakelandhealthinsurance.com/api/google-lead-webhook
 *
 * Google sends lead data as a JSON POST to the webhook URL configured
 * in the lead form extension settings. The payload includes a google_key
 * for verification and user-submitted field data.
 */

import crypto from "crypto";

// --- HELPERS ----

function getEnv(key) {
  return Netlify.env.get(key) || "";
}

// --- VERIFY GOOGLE WEBHOOK KEY ---
// Returns: { ok: true } | { ok: false, status, reason }
function verifyGoogleKey(payload) {
  const expectedKey = getEnv("GOOGLE_WEBHOOK_KEY");
  if (!expectedKey) {
    return { ok: false, status: 503, reason: "GOOGLE_WEBHOOK_KEY not configured" };
  }
  if (payload.google_key !== expectedKey) {
    return { ok: false, status: 403, reason: "Invalid google_key" };
  }
  return { ok: true };
}

// --- PARSE GOOGLE LEAD DATA ---
function parseGoogleLead(payload) {
  const data = payload.user_column_data || [];
  const fields = {};

  for (const item of data) {
    const key = item.column_id?.toLowerCase().replace(/\s+/g, "_");
    if (key) fields[key] = item.string_value || "";
  }

  return {
    full_name: fields.full_name || `${fields.first_name || ""} ${fields.last_name || ""}`.trim(),
    email: fields.email || "",
    phone: fields.phone_number || fields.phone || "",
    city: fields.city || "",
    state: fields.state || "FL",
    zip: fields.postal_code || fields.zip_code || fields.zip || "",
  };
}

// --- STORE IN HUFFHEALTHAPP SUPABASE ---
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

  // Idempotency: if Google retries with the same lead_id, skip the insert.
  if (lead.lead_id) {
    const dedupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/Lead?leadgenId=eq.${encodeURIComponent(lead.lead_id)}&select=id&limit=1`,
      { headers }
    );
    if (dedupRes.ok) {
      const existing = await dedupRes.json();
      if (existing.length > 0) {
        console.log("Lead already exists for lead_id, skipping insert:", lead.lead_id);
        return existing[0];
      }
    }
  }

  const leadRow = {
    id: crypto.randomUUID(),
    firstName: lead.full_name?.split(" ")[0] || "",
    lastName: lead.full_name?.split(" ").slice(1).join(" ") || "",
    email: lead.email || null,
    phone: lead.phone || null,
    source: "google_lead_ad",
    status: "NEW_LEAD",
    stageEnteredAt: new Date().toISOString(),
    city: lead.city || null,
    state: lead.state || "FL",
    zipCode: lead.zip || null,
    leadgenId: lead.lead_id || null,
    formId: lead.form_id || null,
    formName: lead.form_name || null,
    adId: lead.ad_id || null,
    campaignId: lead.campaign_id || null,
    campaignName: lead.campaign_name || null,
    pageId: null,
    rawPayload: lead.raw_payload || null,
    notifiedAt: new Date().toISOString(),
    customFields: {
      webhook_source: "google_lead_webhook",
      gcl_id: lead.gcl_id || null,
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
    const err = await res.text();
    console.error("Supabase Lead insert failed:", err);
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
        type: "GOOGLE_SYNC",
        description: `New lead from Google Ads: ${lead.full_name} (${lead.campaign_name || "Unknown campaign"})`,
        metadata: {
          lead_id: lead.lead_id,
          campaign_name: lead.campaign_name,
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

// --- SEND EMAIL NOTIFICATION ---
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
    `Campaign: ${lead.campaign_name || lead.campaign_id || "Unknown"}`,
    `Ad Group: ${lead.adgroup_name || "Unknown"}`,
    ``,
    `Name: ${lead.full_name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone}`,
    `Location: ${lead.city}, ${lead.state} ${lead.zip}`,
    ``,
    `Time: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`,
    ``,
    `ACTION: Call or text this lead ASAP.`,
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
      subject: `New Lead: ${lead.full_name || "Google Lead Form"}`,
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

  const message = [
    `[LHI] New Lead: ${lead.full_name || "Unknown"}`,
    `Phone: ${lead.phone || "N/A"}`,
    `Source: Google Ads Lead Form`,
    `Action: Call or text ASAP`,
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

// --- MAIN HANDLER ---
export default async (req, context) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  let payload;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("Invalid JSON payload");
    return new Response("Invalid JSON", { status: 400 });
  }

  console.log("Google webhook received — campaign:", payload.campaign_name || payload.campaign_id || "unknown", "lead_id:", payload.lead_id || "none");

  // Verify google_key
  const auth = verifyGoogleKey(payload);
  if (!auth.ok) {
    console.error(auth.reason);
    return new Response(auth.reason, { status: auth.status });
  }

  try {
    const parsed = parseGoogleLead(payload);

    const lead = {
      source: "google_lead_form",
      lead_id: payload.lead_id || null,
      form_id: payload.form_id || null,
      form_name: payload.form_name || null,
      ad_id: payload.ad_id || null,
      adgroup_id: payload.adgroup_id || null,
      adgroup_name: payload.adgroup_name || null,
      campaign_id: payload.campaign_id || null,
      campaign_name: payload.campaign_name || null,
      gcl_id: payload.gcl_id || null,
      ...parsed,
      raw_payload: payload,
      status: "new",
      notified_at: new Date().toISOString(),
    };

    // Store and notify in parallel — allSettled so a Twilio/Resend failure
    // doesn't 500 the response and trigger Google to retry the whole event
    // (which would duplicate-insert before we caught up via idempotency).
    const results = await Promise.allSettled([
      storeInSupabase(lead),
      sendEmailNotification(lead),
      sendSmsNotification(lead),
    ]);
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const step = ["storeInSupabase", "sendEmailNotification", "sendSmsNotification"][i];
        console.error(`${step} failed:`, r.reason);
      }
    });

    console.log(`Google lead processed: lead_id=${lead.lead_id || "none"}`);
  } catch (err) {
    console.error("Failed to process Google lead:", err);
    return new Response("Processing error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
};

// --- ROUTE CONFIG ---
export const config = {
  path: "/api/google-lead-webhook",
};
