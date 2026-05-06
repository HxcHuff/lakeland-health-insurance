/**
 * Meta Lead Ads Webhook — Netlify Serverless Function (v2 format)
 * Lakeland Health Insurance — David Huff
 *
 * Receives Meta leadgen webhook events, fetches full lead data,
 * stores in HuffHealthApp Supabase, and sends email notification.
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
  return Netlify.env.get(key) || "";
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

// --- FETCH FULL LEAD DATA FROM META ---
async function fetchLeadData(leadgenId) {
  const token = getEnv("META_PAGE_ACCESS_TOKEN");
  const url = `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meta API error: ${res.status} — ${err}`);
  }
  return res.json();
}

// --- FETCH FORM DETAILS ---
async function fetchFormName(formId) {
  const token = getEnv("META_PAGE_ACCESS_TOKEN");
  const url = `https://graph.facebook.com/v19.0/${formId}?fields=name&access_token=${token}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.name || "Unknown Form";
  } catch {
    return "Unknown Form";
  }
}

// --- PARSE LEAD FIELDS ---
function parseLeadFields(fieldData) {
  const fields = {};
  for (const item of fieldData || []) {
    const key = item.name?.toLowerCase().replace(/\s+/g, "_");
    if (key) fields[key] = item.values?.[0] || "";
  }
  return {
    full_name: fields.full_name || `${fields.first_name || ""} ${fields.last_name || ""}`.trim(),
    email: fields.email || "",
    phone: fields.phone_number || fields.phone || "",
    city: fields.city || "",
    state: fields.state || "FL",
    zip: fields.zip_code || fields.zip || fields.post_code || "",
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

  const leadRow = {
    id: crypto.randomUUID(),
    firstName: lead.full_name?.split(" ")[0] || "",
    lastName: lead.full_name?.split(" ").slice(1).join(" ") || "",
    email: lead.email || null,
    phone: lead.phone || null,
    source: "facebook_lead_ad",
    status: "NEW_LEAD",
    stageEnteredAt: new Date().toISOString(),
    city: lead.city || null,
    state: lead.state || "FL",
    zipCode: lead.zip || null,
    leadgenId: lead.leadgen_id,
    formId: lead.form_id || null,
    formName: lead.form_name || null,
    adId: lead.ad_id || null,
    campaignId: lead.campaign_id || null,
    campaignName: lead.campaign_name || null,
    pageId: lead.page_id || null,
    rawPayload: lead.raw_payload || null,
    notifiedAt: new Date().toISOString(),
    customFields: {
      webhook_source: "meta_lead_webhook",
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
        type: "FACEBOOK_SYNC",
        description: `New lead from Meta lead ad: ${lead.full_name} (${lead.form_name || "Unknown form"})`,
        metadata: {
          leadgen_id: lead.leadgen_id,
          form_name: lead.form_name,
          campaign_name: lead.campaign_name,
          source: "meta_lead_webhook",
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
    `Source: Meta Lead Ad`,
    `Campaign: ${lead.campaign_name || lead.campaign_id || "Unknown"}`,
    `Form: ${lead.form_name || "Unknown"}`,
    ``,
    `Name: ${lead.full_name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone}`,
    `Location: ${lead.city}, ${lead.state} ${lead.zip}`,
    ``,
    `Time: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`,
    ``,
    `ACTION: Text this lead via FB Business Suite ASAP.`,
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
      subject: `New Lead: ${lead.full_name || "Meta Lead Form"}`,
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
    `Source: Meta Lead Ad`,
    `Action: Text via FB Business Suite`,
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

    const payload = JSON.parse(rawBody);
    console.log("Webhook received:", JSON.stringify(payload, null, 2));

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "leadgen") continue;

        const { leadgen_id, form_id, ad_id, created_time, page_id } = change.value;
        console.log(`Processing lead: ${leadgen_id}`);

        try {
          const leadData = await fetchLeadData(leadgen_id);
          const parsed = parseLeadFields(leadData.field_data);
          const formName = await fetchFormName(form_id);

          const lead = {
            source: "meta_lead_form",
            leadgen_id,
            form_id,
            form_name: formName,
            ad_id: ad_id || null,
            campaign_id: leadData.campaign_id || null,
            campaign_name: leadData.campaign_name || null,
            page_id,
            ...parsed,
            raw_payload: leadData,
            status: "new",
            notified_at: new Date().toISOString(),
          };

          await Promise.all([
            storeInSupabase(lead),
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