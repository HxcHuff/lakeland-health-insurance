// Netlify Function: /api/lead
// 1. Mints a server-side event_id (uuid)
// 2. Fires Meta Conversions API "Lead" event server-side with that event_id
// 3. Forwards the submission to Netlify Forms so submissions still get captured
// 4. Returns { event_id } for downstream attribution/audit use

const crypto = require('crypto');

const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE; // optional
// Netlify injects CONTEXT=production|deploy-preview|branch-deploy|dev.
// Only fire CAPI on the production context — previews/branches must stay quiet.
const NETLIFY_CONTEXT = process.env.CONTEXT || 'production';
const IS_PROD_CONTEXT = NETLIFY_CONTEXT === 'production';

// Mailchimp — single audience, tag-segmented. All three vars must be set
// or the sync no-ops gracefully (matches the CAPI guard pattern above).
const MC_API_KEY = process.env.MAILCHIMP_API_KEY;
const MC_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;
const MC_SERVER = process.env.MAILCHIMP_SERVER_PREFIX; // e.g. "us12"

// form-name → Mailchimp behavior. Newsletter forms get pending (double opt-in);
// high-intent lead forms get subscribed (already gave phone + explicit consent).
// Existing subscribers are never downgraded — pending only applies to NEW contacts.
const FORM_MC_CONFIG = {
  'homepage-newsletter':           { status: 'pending',    tags: ['homepage', 'newsletter'] },
  'newsletter-signup':             { status: 'pending',    tags: ['newsletter', 'newsletter-page'] },
  'get-help':                      { status: 'subscribed', tags: ['lead', 'get-help', 'hot-lead'] },
  'lp-aca-lead':                   { status: 'subscribed', tags: ['aca', 'paid-ad', 'hot-lead'] },
  'lp-medicare-lead':              { status: 'subscribed', tags: ['medicare', 'paid-ad', 'hot-lead'] },
  'lp-gap-lead':                   { status: 'subscribed', tags: ['gap', 'paid-ad', 'hot-lead'] },
  'aca-lakeland-lead':             { status: 'subscribed', tags: ['aca', 'local-seo', 'lakeland', 'hot-lead'] },
  'tampa-health-insurance':        { status: 'subscribed', tags: ['aca', 'local-seo', 'tampa', 'hot-lead'] },
  'winter-haven-health-insurance': { status: 'subscribed', tags: ['aca', 'local-seo', 'winter-haven', 'hot-lead'] },
  'haines-city-health-insurance':  { status: 'subscribed', tags: ['aca', 'local-seo', 'haines-city', 'hot-lead'] },
  'lake-alfred-health-insurance':  { status: 'subscribed', tags: ['aca', 'local-seo', 'lake-alfred', 'hot-lead'] },
  'davenport-health-insurance':    { status: 'subscribed', tags: ['aca', 'local-seo', 'davenport', 'hot-lead'] },
  'brandon-health-insurance':      { status: 'subscribed', tags: ['aca', 'local-seo', 'brandon', 'hot-lead'] },
  'clearwater-health-insurance':   { status: 'subscribed', tags: ['aca', 'local-seo', 'clearwater', 'hot-lead'] },
  'largo-health-insurance':        { status: 'subscribed', tags: ['aca', 'local-seo', 'largo', 'hot-lead'] },
  'new-port-richey-health-insurance': { status: 'subscribed', tags: ['aca', 'local-seo', 'new-port-richey', 'hot-lead'] },
  'riverview-health-insurance':    { status: 'subscribed', tags: ['aca', 'local-seo', 'riverview', 'hot-lead'] },
  'st-petersburg-health-insurance': { status: 'subscribed', tags: ['aca', 'local-seo', 'st-petersburg', 'hot-lead'] },
  'wesley-chapel-health-insurance': { status: 'subscribed', tags: ['aca', 'local-seo', 'wesley-chapel', 'hot-lead'] },
  'subsidy-estimator-lead':        { status: 'subscribed', tags: ['aca', 'subsidy-estimator', 'tool-lead'] }
};

const INTENT_MC_TAGS = {
  'aca': ['intent-aca'],
  'medicare': ['intent-medicare'],
  'lost-coverage': ['intent-lost-coverage', 'sep-review'],
  'turning-26': ['intent-turning-26', 'sep-review'],
  'self-employed': ['intent-self-employed'],
  'current-client-review': ['intent-current-client-review', 'existing-client-service'],
  'provider-check': ['intent-provider-check', 'network-review'],
  'prescription-check': ['intent-prescription-check', 'rx-review'],
  'coverage-gap': ['intent-coverage-gap'],
  'employer-referral': ['intent-employer-referral', 'professional-referral'],
  'post-enrollment-review': ['intent-post-enrollment-review', 'existing-client-service']
};

const NEWSLETTER_FORMS = new Set(['homepage-newsletter', 'newsletter-signup']);

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

  const botCheck = checkBotSubmission(payload);
  if (!botCheck.ok) {
    return {
      statusCode: 422,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: botCheck.error })
    };
  }

  const headers = event.headers || {};
  const eventId = crypto.randomUUID();
  const eventTime = Math.floor(Date.now() / 1000);

  const clientIp = (headers['x-nf-client-connection-ip'] ||
                    headers['x-forwarded-for'] ||
                    '').split(',')[0].trim();
  const userAgent = headers['user-agent'] || '';
  const sourceUrl = payload.source_url || headers.referer || headers.referrer || '';
  const formName = payload['form-name'] || payload.form_name || '';
  const isNewsletter = NEWSLETTER_FORMS.has(formName) || payload.event_name === 'Subscriber';
  const cookieHeader = headers.cookie || '';
  const fbp = pickCookie(cookieHeader, '_fbp');
  const fbc = pickCookie(cookieHeader, '_fbc');

  // Fire Meta Conversions API — production context only
  let capiOk = false;
  let capiError = null;
  if (isNewsletter) {
    capiError = 'CAPI skipped: newsletter subscriber is not a sales lead';
  } else if (!IS_PROD_CONTEXT) {
    capiError = `CAPI skipped: non-production Netlify context (${NETLIFY_CONTEXT})`;
  } else if (PIXEL_ID && ACCESS_TOKEN) {
    try {
      const userData = {};
      if (clientIp) userData.client_ip_address = clientIp;
      if (userAgent) userData.client_user_agent = userAgent;
      const email = payload.email;
      const phone = payload.phone || payload.phone_number;
      const zip = payload.zip || payload.zip_code || payload.postal_code;
      if (email) userData.em = [sha256(email)];
      if (phone) {
        const ph = normalizePhone(phone);
        if (ph) userData.ph = [sha256(ph)];
      }
      if (payload.first_name) userData.fn = [sha256(payload.first_name)];
      if (payload.last_name) userData.ln = [sha256(payload.last_name)];
      if (payload.full_name && !payload.first_name && !payload.last_name) {
        const parts = String(payload.full_name).trim().split(/\s+/);
        if (parts[0]) userData.fn = [sha256(parts[0])];
        if (parts.length > 1) userData.ln = [sha256(parts.slice(1).join(' '))];
      }
      if (zip) userData.zp = [sha256(String(zip).slice(0, 5))];
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
            value: 0,
            normalized_intent: payload.normalized_intent || null,
            line_of_business: payload.line_of_business || null
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

  // Sync to Mailchimp — non-blocking, errors logged but don't fail the response.
  // Runs after Forms forward so a Mailchimp outage can't drop submissions.
  let mcOk = false;
  let mcError = null;
  try {
    const result = await syncToMailchimp(payload);
    mcOk = result.ok;
    if (result.error) {
      mcError = result.error;
      console.error('Mailchimp sync error:', result.error);
    }
  } catch (e) {
    mcError = String(e);
    console.error('Mailchimp sync exception', e);
  }

  const responseBody = {
    event_id: eventId,
    capi: capiOk,
    forms: formsOk,
    mailchimp: mcOk,
    ...(capiError ? { capi_error: capiError } : {}),
    ...(formsError ? { forms_error: formsError } : {}),
    ...(mcError ? { mc_error: mcError } : {})
  };

  if (!formsOk) {
    return {
      statusCode: 502,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'forms forward failed', ...responseBody })
    };
  }

  return {
    statusCode: 200,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, ...responseBody })
  };
};

function checkBotSubmission(payload) {
  const formName = payload['form-name'] || payload.form_name || '';
  const trapFilled = ['bot-field', 'website', 'company'].some((key) => String(payload[key] || '').trim());
  if (trapFilled) return { ok: false, error: 'bot trap field filled' };

  if (formName !== 'get-help') return { ok: true };

  const startedAt = Number(payload.started_at);
  const humanCheck = String(payload.human_check || '');
  const expectedCheck = Buffer.from(`${payload.started_at}:lakeland-human`).toString('base64');
  const elapsedMs = Date.now() - startedAt;

  if (!Number.isFinite(startedAt) || humanCheck !== expectedCheck) {
    return { ok: false, error: 'human check failed' };
  }
  if (elapsedMs < 1200) {
    return { ok: false, error: 'submitted too quickly' };
  }
  if (elapsedMs > 2 * 60 * 60 * 1000) {
    return { ok: false, error: 'stale submission' };
  }

  return { ok: true };
}

async function syncToMailchimp(payload) {
  if (!MC_API_KEY || !MC_AUDIENCE_ID || !MC_SERVER) {
    return { ok: false, error: 'Mailchimp env vars not set (MAILCHIMP_API_KEY / MAILCHIMP_AUDIENCE_ID / MAILCHIMP_SERVER_PREFIX)' };
  }
  const email = payload.email && String(payload.email).trim();
  if (!email) return { ok: false, error: 'no email in payload' };

  const formName = payload['form-name'] || payload.form_name || '';
  const config = mailchimpConfigFor(payload, formName);

  // subscriber_hash is MD5 of lowercased email — used for upsert by email.
  const hash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
  const baseUrl = `https://${MC_SERVER}.api.mailchimp.com/3.0/lists/${MC_AUDIENCE_ID}/members/${hash}`;
  const auth = 'Basic ' + Buffer.from('any:' + MC_API_KEY).toString('base64');

  const mergeFields = {};
  if (payload.first_name) mergeFields.FNAME = payload.first_name;
  if (payload.last_name) mergeFields.LNAME = payload.last_name;
  if (payload.full_name && !payload.first_name) {
    const parts = String(payload.full_name).trim().split(/\s+/);
    if (parts[0]) mergeFields.FNAME = parts[0];
    if (parts.length > 1) mergeFields.LNAME = parts.slice(1).join(' ');
  }
  if (payload.phone || payload.phone_number) mergeFields.PHONE = payload.phone || payload.phone_number;

  // status (force) for high-intent forms upgrades existing pending contacts.
  // status_if_new (don't downgrade) for newsletter signups preserves existing subscribed status.
  const upsertBody = { email_address: email, merge_fields: mergeFields };
  if (config.status === 'subscribed') {
    upsertBody.status = 'subscribed';
  } else {
    upsertBody.status_if_new = 'pending';
  }

  try {
    const res = await fetch(baseUrl, {
      method: 'PUT',
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(upsertBody)
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `MC upsert ${res.status}: ${errText.slice(0, 300)}` };
    }
  } catch (e) {
    return { ok: false, error: `MC upsert exception: ${String(e)}` };
  }

  // Tags via separate endpoint — this ADDS without clobbering existing tags.
  // (Tags inside the PUT body would replace the full tag list.)
  if (config.tags.length) {
    try {
      const tagBody = { tags: config.tags.map(name => ({ name, status: 'active' })) };
      const tagRes = await fetch(`${baseUrl}/tags`, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(tagBody)
      });
      if (!tagRes.ok) {
        const errText = await tagRes.text();
        return { ok: true, error: `MC tags ${tagRes.status}: ${errText.slice(0, 300)}` };
      }
    } catch (e) {
      return { ok: true, error: `MC tags exception: ${String(e)}` };
    }
  }

  return { ok: true };
}

function mailchimpConfigFor(payload, formName) {
  const base = FORM_MC_CONFIG[formName] || { status: 'pending', tags: ['unmapped', formName || 'unknown-form'] };
  const normalizedIntent = String(payload.normalized_intent || '').trim();
  const tags = new Set(base.tags);
  if (normalizedIntent && INTENT_MC_TAGS[normalizedIntent]) {
    INTENT_MC_TAGS[normalizedIntent].forEach(tag => tags.add(tag));
  }
  if (payload.line_of_business) tags.add(String(payload.line_of_business).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  if (normalizedIntent === 'current-client-review' || normalizedIntent === 'post-enrollment-review') {
    tags.delete('hot-lead');
    tags.add('service-request');
  }
  return { status: base.status, tags: Array.from(tags).filter(Boolean) };
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
