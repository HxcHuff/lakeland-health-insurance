// OpenAI Ads Conversions API. Pixel ID is public, API key is server-only.
const OPENAI_ADS_PIXEL_ID = process.env.OPENAI_ADS_PIXEL_ID;
const OPENAI_ADS_CAPI_KEY = process.env.OPENAI_ADS_CAPI_KEY;
const OPENAI_ADS_VALIDATE_ONLY = process.env.OPENAI_ADS_VALIDATE_ONLY === 'true';
const OPENAI_ADS_ALLOWED_ORIGINS = (process.env.OPENAI_ADS_ALLOWED_ORIGINS || 'https://lakelandhealthinsurance.com,https://www.lakelandhealthinsurance.com')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

function pickRawCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

function allowedOrigins(headers) {
  const origins = new Set(OPENAI_ADS_ALLOWED_ORIGINS);
  const host = headers.host || '';
  if (host && /^([a-z0-9.-]+)(?::\d+)?$/i.test(host)) {
    origins.add(`https://${host}`.replace(/\/+$/, ''));
  }
  return origins;
}

function sanitizeSourceUrl(rawUrl, headers) {
  const origins = allowedOrigins(headers);
  const fallbackOrigin = OPENAI_ADS_ALLOWED_ORIGINS[0] || 'https://lakelandhealthinsurance.com';
  try {
    const url = new URL(String(rawUrl || ''), fallbackOrigin);
    const origin = url.origin.replace(/\/+$/, '');
    if ((url.protocol === 'http:' || url.protocol === 'https:') && origins.has(origin)) {
      return `${origin}${url.pathname || '/'}`;
    }
  } catch (_) {}
  return `${fallbackOrigin}/`;
}

async function sendAdsLead({ eventId, headers, cookieHeader, sourceUrl }) {
  const netlifyContext = process.env.CONTEXT || 'production';
  if (netlifyContext !== 'production') {
    return { ok: false, skipped: true, error: `OpenAI Ads skipped: non-production Netlify context (${netlifyContext})` };
  }
  if (!OPENAI_ADS_PIXEL_ID || !OPENAI_ADS_CAPI_KEY) {
    return { ok: false, skipped: true, error: 'OPENAI_ADS_PIXEL_ID or OPENAI_ADS_CAPI_KEY not set' };
  }

  const user = {};
  const obref = pickRawCookie(cookieHeader, '__obref');
  if (obref) user.obref = obref;

  const leadEvent = {
    id: eventId,
    type: 'lead_created',
    timestamp_ms: Date.now(),
    source_url: sanitizeSourceUrl(sourceUrl, headers),
    action_source: 'web',
    data: { type: 'customer_action' }
  };

  const oppref = pickRawCookie(cookieHeader, '__oppref');
  if (oppref) leadEvent.oppref = oppref;
  if (Object.keys(user).length) leadEvent.user = user;

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 1500) : null;

  try {
    const res = await fetch(`https://bzr.openai.com/v1/events?pid=${encodeURIComponent(OPENAI_ADS_PIXEL_ID)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_ADS_CAPI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        validate_only: OPENAI_ADS_VALIDATE_ONLY,
        events: [leadEvent]
      }),
      ...(controller ? { signal: controller.signal } : {})
    });
    if (timeout) clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `OpenAI Ads CAPI ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    if (timeout) clearTimeout(timeout);
    return { ok: false, error: `OpenAI Ads CAPI exception: ${String(e)}` };
  }
}

module.exports = {
  sendAdsLead,
  _test: {
    sanitizeSourceUrl,
    pickRawCookie
  }
};
