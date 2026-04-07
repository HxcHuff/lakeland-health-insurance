// Netlify Function: /api/lead
// 1. Mints a server-side event_id (uuid)
// 2. Fires Meta Conversions API "Lead" event server-side with that event_id
// 3. Forwards the submission to Netlify Forms so submissions still get captured
// 4. Returns { event_id } so the browser can fire fbq('track','Lead',{},{eventID}) for dedup

const crypto = require('crypto');

const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE; // optional

const sha256 = (s) =>
  crypto.createHash('sha256').update(String(s).trim().toLowerCase()).digest('hex');

const normalizePhone = (p) => String(p || '').replace(/\D/g, '');

function pickCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (_) {
    return { statusCode: 400, headers: corsHeaders(), body: 'Invalid JSON' };
  }

  const headers = event.headers || {};
  const eventId = crypto.randomUUID();
  const eventTime = Math.floor(Date.now() / 1000);

  const clientIp = (headers['x-nf-client-connection-ip'] ||
                    headers['x-forwarded-for'] ||
                    '').split(',')[0].trim();
  const userAgent = headers['user-agent'] || '';
  const sourceUrl = payload.source_url || headers.referer || headers.referrer || '';
  const cookieHeader = headers.cookie || '';
  const fbp = pickCookie(cookieHeader, '_fbp');
  const fbc = pickCookie(cookieHeader, '_fbc');

  // Fire Meta Conversions API
  let capiOk = false;
  let capiError = null;
  if (PIXEL_ID && ACCESS_TOKEN) {
    try {
      const userData = {};
      if (clientIp) userData.client_ip_address = clientIp;
      if (userAgent) userData.client_user_agent = userAgent;
      if (payload.email) userData.em = [sha256(payload.email)];
      if (payload.phone) {
        const ph = normalizePhone(payload.phone);
        if (ph) userData.ph = [sha256(ph)];
      }
      if (payload.first_name) userData.fn = [sha256(payload.first_name)];
      if (payload.last_name) userData.ln = [sha256(payload.last_name)];
      if (payload.full_name && !payload.first_name && !payload.last_name) {
        const parts = String(payload.full_name).trim().split(/\s+/);
        if (parts[0]) userData.fn = [sha256(parts[0])];
        if (parts.length > 1) userData.ln = [sha256(parts.slice(1).join(' '))];
      }
      if (payload.zip) userData.zp = [sha256(String(payload.zip).slice(0, 5))];
      if (fbp) userData.fbp = fbp;
      if (fbc) userData.fbc = fbc;

      const body = {
        data: [{
          event_name: 'Lead',
          event_time: eventTime,
          event_id: eventId,
          action_source: 'website',
          event_source_url: sourceUrl,
          user_data: userData,
          custom_data: {
            content_name: payload.content_name || payload['form-name'] || 'lead',
            currency: 'USD',
            value: 0
          }
        }]
      };
      if (TEST_EVENT_CODE) body.test_event_code = TEST_EVENT_CODE;

      const url = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      capiOk = res.ok;
      if (!res.ok) {
        capiError = `CAPI ${res.status}: ${(await res.text()).slice(0, 500)}`;
        console.error(capiError);
      }
    } catch (e) {
      capiError = String(e);
      console.error('CAPI exception', e);
    }
  } else {
    capiError = 'META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set';
    console.warn(capiError);
  }

  // Forward to Netlify Forms so submissions are still captured
  let formsOk = false;
  let formsError = null;
  try {
    const formName = payload['form-name'] || payload.form_name;
    if (formName) {
      const params = new URLSearchParams();
      params.set('form-name', formName);
      Object.keys(payload).forEach((k) => {
        if (k === 'form-name' || k === 'form_name' || k === 'content_name' || k === 'source_url') return;
        const v = payload[k];
        if (v == null || v === '') return;
        params.set(k, String(v));
      });
      const host = headers.host || 'lakelandhealthinsurance.com';
      const proto = (headers['x-forwarded-proto'] || 'https').split(',')[0];
      const siteUrl = `${proto}://${host}/`;
      const res = await fetch(siteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      formsOk = res.ok;
      if (!res.ok) {
        formsError = `Forms ${res.status}`;
        console.error(formsError);
      }
    } else {
      formsError = 'no form-name in payload';
    }
  } catch (e) {
    formsError = String(e);
    console.error('Forms forward exception', e);
  }

  return {
    statusCode: 200,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_id: eventId,
      capi: capiOk,
      forms: formsOk,
      ...(capiError ? { capi_error: capiError } : {}),
      ...(formsError ? { forms_error: formsError } : {})
    })
  };
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
