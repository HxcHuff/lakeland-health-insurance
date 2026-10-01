'use strict';

/**
 * Production-only IndexNow ping after a successful Netlify deploy.
 *
 * Netlify invokes this event function after deploy-succeeded. It never
 * throws, never fails the deploy, and needs no secrets: the IndexNow key
 * is the public root file /<key>.txt.
 *
 * Guards:
 *   - payload.context / CONTEXT must be "production"
 *   - LHI_SITE_ENV, when set, must be "production"
 *   - Deploy previews and branch deploys are skipped
 *   - Hostname, when known, must include lakelandhealthinsurance.com.
 *     A production branch alias such as main--lhi.netlify.app does not skip
 *     the ping when the deploy context (or production branch) is production.
 *
 * URL selection:
 *   - Fetch the live sitemap and submit URLs whose lastmod is on the
 *     deploy date (content/lastmod changed in this release window)
 *   - If that set is empty or unreadable, submit sitemap URLs capped
 *     well under the IndexNow 10,000-URL limit
 */

const INDEXNOW_HOST = 'lakelandhealthinsurance.com';
const INDEXNOW_KEY = '7c8d24b6c73373168edb06a95e957240';
const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const SITEMAP_URL = `https://${INDEXNOW_HOST}/sitemap.xml`;
const MAX_URLS = 500;
const PRODUCTION_HOSTS = new Set([
  'lakelandhealthinsurance.com',
  'www.lakelandhealthinsurance.com'
]);

function hostnameOf(value) {
  if (!value) return '';
  try {
    return new URL(String(value)).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function deployContext(payload = {}, env = process.env) {
  return String(payload.context || env.CONTEXT || '').trim().toLowerCase();
}

function deployBranch(payload = {}, env = process.env) {
  return String(payload.branch || env.BRANCH || env.HEAD || '').trim();
}

function productionBranchName(payload = {}, env = process.env) {
  return String(payload.production_branch || env.PRODUCTION_BRANCH || 'main').trim();
}

function isProductionLakelandDeploy(payload = {}, env = process.env) {
  const context = deployContext(payload, env);
  if (context === 'deploy-preview' || context === 'branch-deploy') {
    return { ok: false, reason: `context=${context}` };
  }

  const branch = deployBranch(payload, env);
  const productionBranch = productionBranchName(payload, env);
  const productionContext = context === 'production';
  const productionBranchMatch = Boolean(branch) && branch === productionBranch;
  if (!productionContext && !productionBranchMatch) {
    return { ok: false, reason: `context=${context || '(empty)'}` };
  }

  const siteEnv = String(env.LHI_SITE_ENV || '').trim().toLowerCase();
  if (siteEnv && siteEnv !== 'production') {
    return { ok: false, reason: `LHI_SITE_ENV=${siteEnv}` };
  }

  const hosts = [
    payload.url,
    payload.ssl_url,
    payload.deploy_ssl_url,
    env.URL,
    env.SITE_URL
  ].map(hostnameOf).filter(Boolean);

  // Production deploys include a main--*.netlify.app alias among their URLs.
  // That alias must not veto a production context with a canonical host.
  const productionHost = hosts.find((host) => PRODUCTION_HOSTS.has(host));
  if (hosts.length > 0 && !productionHost) {
    return { ok: false, reason: `non-production-host=${hosts.join(',')}` };
  }

  return { ok: true, reason: 'production' };
}

function parseSitemapUrls(xml) {
  const entries = [];
  const blocks = String(xml).match(/<url\b[\s\S]*?<\/url>/gi) || [];
  for (const block of blocks) {
    const loc = (block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/i) || [])[1];
    const lastmod = (block.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i) || [])[1] || '';
    if (!loc) continue;
    try {
      const url = new URL(loc);
      if (url.hostname.replace(/^www\./, '') !== INDEXNOW_HOST) continue;
      entries.push({ url: url.href, lastmod: lastmod.slice(0, 10) });
    } catch {
      // skip malformed loc
    }
  }
  return entries;
}

function selectUrls(entries, deployDate) {
  const changed = entries
    .filter((entry) => entry.lastmod && entry.lastmod === deployDate)
    .map((entry) => entry.url);
  const source = changed.length > 0 ? changed : entries.map((entry) => entry.url);
  const unique = [...new Set(source)].slice(0, MAX_URLS);
  return {
    urls: unique,
    mode: changed.length > 0 ? 'lastmod-changed' : 'sitemap-fallback',
    changedCount: changed.length,
    sitemapCount: entries.length
  };
}

async function postIndexNow(urls, fetchImpl) {
  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: INDEXNOW_HOST,
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: urls
    })
  });
  const text = await response.text().catch(() => '');
  return { status: response.status, ok: response.ok, body: text.slice(0, 500) };
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  };
}

function utcDate(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

async function pingIndexNow({
  payload = {},
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = new Date()
} = {}) {
  const gate = isProductionLakelandDeploy(payload, env);
  if (!gate.ok) {
    console.log(`indexnow skip: ${gate.reason}`);
    return { skipped: true, reason: gate.reason };
  }

  if (typeof fetchImpl !== 'function') {
    console.log('indexnow skip: fetch is unavailable');
    return { skipped: true, reason: 'fetch-unavailable' };
  }

  const sitemapResponse = await fetchImpl(SITEMAP_URL, { method: 'GET' });
  if (!sitemapResponse.ok) {
    console.log(`indexnow sitemap fetch failed: ${sitemapResponse.status}`);
    return { skipped: true, reason: `sitemap-http-${sitemapResponse.status}` };
  }

  const xml = await sitemapResponse.text();
  const selection = selectUrls(parseSitemapUrls(xml), utcDate(payload.published_at || now));
  if (selection.urls.length === 0) {
    console.log('indexnow skip: no sitemap URLs');
    return { skipped: true, reason: 'empty-url-list' };
  }

  const result = await postIndexNow(selection.urls, fetchImpl);
  const summary = {
    skipped: false,
    mode: selection.mode,
    submitted: selection.urls.length,
    changedCount: selection.changedCount,
    sitemapCount: selection.sitemapCount,
    status: result.status,
    ok: result.ok
  };
  if (result.ok) {
    console.log(`indexnow ok: ${JSON.stringify(summary)}`);
  } else {
    console.log(`indexnow request failed: ${JSON.stringify({ ...summary, body: result.body })}`);
  }
  return summary;
}

async function handler(event = {}) {
  try {
    let payload = {};
    if (event.body) {
      const parsed = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      payload = parsed?.payload && typeof parsed.payload === 'object' ? parsed.payload : parsed;
    }
    const result = await pingIndexNow({ payload });
    return jsonResponse(200, { ok: true, ...result });
  } catch (error) {
    console.log(`indexnow error: ${error && error.message ? error.message : error}`);
    return jsonResponse(200, { ok: true, skipped: true, reason: 'handler-error' });
  }
}

module.exports = {
  handler,
  pingIndexNow,
  isProductionLakelandDeploy,
  parseSitemapUrls,
  selectUrls,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  INDEXNOW_HOST,
  MAX_URLS
};
