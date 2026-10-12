/** @typedef {'allow' | 'block'} GeoAction */

export const INDEXNOW_KEY = '7c8d24b6c73373168edb06a95e957240';

export const US_GEO_CODES = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'MP']);

/** User-agent tokens; matched case-insensitively as substrings (no reverse-DNS at edge). */
export const CRAWLER_USER_AGENT_TOKENS = [
  'Googlebot',
  'Google-InspectionTool',
  'GoogleOther',
  'AdsBot-Google',
  'Mediapartners-Google',
  'Google-Extended',
  'Storebot-Google',
  'APIs-Google',
  'FeedFetcher-Google',
  'Bingbot',
  'AdIdxBot',
  'BingPreview',
  'DuckDuckBot',
  'Applebot',
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'PerplexityBot',
  'CCBot',
  'YandexBot',
  'facebookexternalhit',
  'meta-externalagent',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot',
];

export const BLOCK_MESSAGE =
  'This site serves U.S. residents. Call (863) 640-3102.';

/**
 * @param {string | null | undefined} enabledEnv
 */
export function isGeoBlockEnabled(enabledEnv) {
  return enabledEnv === 'true';
}

/**
 * @param {string} userAgent
 */
export function isAllowlistedCrawlerUserAgent(userAgent) {
  const ua = String(userAgent || '');
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return CRAWLER_USER_AGENT_TOKENS.some((token) => lower.includes(token.toLowerCase()));
}

/**
 * @param {string} pathname
 */
export function isAllowlistedPath(pathname) {
  const path = pathname || '/';
  if (path.startsWith('/.netlify/functions/')) return true;
  if (path.startsWith('/.netlify/')) return true;
  if (path.startsWith('/api/')) return true;
  if (path === '/robots.txt') return true;
  if (/^\/sitemap[^/]*\.xml$/i.test(path)) return true;
  if (/^\/llms[^/]*\.txt$/i.test(path)) return true;
  if (path === `/${INDEXNOW_KEY}.txt`) return true;
  if (path === '/google79927e3ae56b9c82.html') return true;
  if (path.startsWith('/.well-known/')) return true;
  if (path.startsWith('/assets/ads/')) return true;
  if (path === '/favicon.ico' || path === '/favicon.svg') return true;
  if (path.startsWith('/icons/')) return true;
  return false;
}

/**
 * @param {string | null | undefined} countryCode
 */
export function isAllowedCountry(countryCode) {
  const code = String(countryCode || '').trim().toUpperCase();
  if (!code) return true;
  return US_GEO_CODES.has(code);
}

/**
 * @param {{
 *   enabled: boolean;
 *   countryCode?: string | null;
 *   pathname: string;
 *   method: string;
 *   userAgent?: string | null;
 * }} input
 * @returns {{ action: GeoAction; reason: string }}
 */
export function decideGeoBlock(input) {
  if (!input.enabled) {
    return { action: 'allow', reason: 'disabled' };
  }
  if (String(input.method || 'GET').toUpperCase() === 'POST') {
    return { action: 'allow', reason: 'post' };
  }
  if (isAllowlistedPath(input.pathname)) {
    return { action: 'allow', reason: 'path' };
  }
  if (isAllowlistedCrawlerUserAgent(input.userAgent)) {
    return { action: 'allow', reason: 'crawler' };
  }
  if (isAllowedCountry(input.countryCode)) {
    return { action: 'allow', reason: 'geo' };
  }
  return { action: 'block', reason: 'geo' };
}

export function buildBlockedResponse() {
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, nofollow">
  <title>Unavailable in your region</title>
</head>
<body>
  <p>${BLOCK_MESSAGE}</p>
</body>
</html>`;
  return {
    status: 403,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
      'x-lhi-geo': 'block',
    },
    body,
  };
}

/**
 * @param {Response} response
 * @param {'allow' | 'block'} value
 */
export function withGeoDebugHeader(response, value) {
  const headers = new Headers(response.headers);
  headers.set('x-lhi-geo', value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
