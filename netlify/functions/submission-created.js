// Netlify event: submission-created
// Runs after Netlify Forms accepts a submission.
// Get Help rows are forwarded to Hopper; other forms no-op.
// Hopper send flags stay fail-closed. Missing secret is a skip, not a throw.

const { forwardGetHelpToHopper } = require("./lib/hopper-ingest");

function formPayload(event) {
  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch (_) {
    return null;
  }
  const envelope = body.payload && typeof body.payload === "object" ? body.payload : body;
  const data = envelope.data && typeof envelope.data === "object" ? envelope.data : envelope;
  const formName = String(
    data["form-name"] || data.form_name || envelope.form_name || "",
  ).trim();
  return {
    ...data,
    "form-name": formName || data["form-name"] || data.form_name,
  };
}

exports.handler = async (event) => {
  const payload = formPayload(event);
  if (!payload || payload["form-name"] !== "get-help") {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true }) };
  }
  const result = await forwardGetHelpToHopper({
    payload,
    headers: event.headers || {},
    eventId: payload.event_id || null,
  });
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, hopper: result || null }),
  };
};
