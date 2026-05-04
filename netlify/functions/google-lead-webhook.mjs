/**
 * Google Ads Lead Form Extension — webhook receiver
 * https://developers.google.com/google-ads/webhook/docs/implementation
 *
 * Use this URL in Google Ads (not the Meta lead webhook). Meta's endpoint
 * requires x-hub-signature-256; Google's test POST does not → 403 and
 * "Your data management system didn't respond correctly" in Ads.
 *
 * Served at: https://lakelandhealthinsurance.com/api/google-lead-webhook
 * (netlify.toml rewrite → /.netlify/functions/google-lead-webhook)
 *
 * Env (optional):
 *   GOOGLE_LEAD_FORM_WEBHOOK_KEY — must match the key configured on the lead
 *   form in Google Ads. If unset, any google_key is accepted (easier first
 *   test; set the key in production).
 */

function getEnv(key) {
  return Netlify.env.get(key) || "";
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ message: "Method not allowed" }, 405);
  }

  const raw = await req.text();
  let body;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return jsonResponse({ message: "Invalid JSON" }, 400);
  }

  const expectedKey = getEnv("GOOGLE_LEAD_FORM_WEBHOOK_KEY");
  if (expectedKey) {
    if (body.google_key !== expectedKey) {
      console.error("Google lead webhook: google_key mismatch or missing");
      return jsonResponse({ message: "Unauthorized" }, 401);
    }
  }

  console.log(
    "Google lead webhook:",
    JSON.stringify({
      lead_id: body.lead_id,
      is_test: body.is_test,
      form_id: body.form_id,
      campaign_id: body.campaign_id,
      gcl_id: body.gcl_id,
      fields: Array.isArray(body.user_column_data)
        ? body.user_column_data.map((c) => c.column_id)
        : [],
    })
  );

  // Google expects HTTP 200 with JSON body {} for success.
  return new Response("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
