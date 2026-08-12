#!/usr/bin/env node
import {
  canonicalUrl,
  extractHtmlSignals,
  fetchWithRetry,
  loadConfig,
  makeEnvelope,
  parseArgs,
  parseSitemap,
  persistEnvelope,
  sanitizeUrl,
  sha256
} from './core.mjs';

const MAX_BODY_BYTES = 5 * 1024 * 1024;

async function fetchHopChain(startUrl, config) {
  const hops = [];
  let current = startUrl;
  for (let count = 0; count < 10; count += 1) {
    const response = await fetchWithRetry(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(config.crawler.timeoutMs),
      headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5', 'user-agent': config.crawler.userAgent }
    }, config.crawler);
    const location = response.headers.get('location');
    hops.push({ url: current, status: response.status, location: location ? sanitizeUrl(location, config, { allowExternal: true }) : null });
    if (![301, 302, 303, 307, 308].includes(response.status) || !location) return { response, hops, finalUrl: current };
    await response.body?.cancel();
    current = sanitizeUrl(location, config, { allowExternal: true });
    if (new URL(current).origin !== config.site.origin) return { response: null, hops, finalUrl: current, externalRedirect: true };
  }
  throw new Error(`Redirect chain exceeds 10 hops: ${startUrl}`);
}

async function readBounded(response) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) {
    await response.body?.cancel();
    return { bytes: 0, tooLarge: true, body: null, bodySha256: null };
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BODY_BYTES) return { bytes: bytes.byteLength, tooLarge: true, body: null, bodySha256: sha256(bytes) };
  return { bytes: bytes.byteLength, tooLarge: false, body: new TextDecoder().decode(bytes), bodySha256: sha256(bytes) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  if (args['max-pages']) config.crawler.maxPages = Number(args['max-pages']);
  if (args.concurrency) config.crawler.concurrency = Number(args.concurrency);
  if (!Number.isInteger(config.crawler.concurrency) || config.crawler.concurrency < 1 || config.crawler.concurrency > 4) {
    throw new Error('Crawler concurrency must be an integer from 1 through 4');
  }

  const sitemapResponse = await fetchWithRetry(config.site.sitemapUrl, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(config.crawler.timeoutMs),
    headers: { 'user-agent': config.crawler.userAgent }
  }, config.crawler);
  if (!sitemapResponse.ok) throw new Error(`Sitemap returned HTTP ${sitemapResponse.status}`);
  const sitemapText = await sitemapResponse.text();
  const sitemapRows = parseSitemap(sitemapText);

  const queue = [];
  const queued = new Set();
  const observations = [];
  const externalReferences = [];
  const enqueue = (raw, kind = 'page', sourceUrl = null) => {
    let url;
    try {
      url = sanitizeUrl(raw, config, { allowExternal: true });
    } catch (error) {
      observations.push({ requestedUrl: raw, sourceUrl, kind, error: error.message, status: null });
      return;
    }
    if (new URL(url).origin !== config.site.origin) {
      externalReferences.push({ url, sourceUrl, verificationRequired: true });
      return;
    }
    if (queued.has(url) || queued.size >= config.crawler.maxPages) return;
    queued.add(url);
    queue.push({ url, kind, sourceUrl });
  };

  if (config.crawler.seedFromSitemap) sitemapRows.forEach((row) => enqueue(row.url));
  enqueue(`${config.site.origin}/`);
  for (const path of config.crawler.securityProbePaths || []) enqueue(path, 'security-probe');

  async function worker() {
    while (true) {
      const item = queue.shift();
      if (!item) return;
      try {
        const { response, hops, finalUrl, externalRedirect = false } = await fetchHopChain(item.url, config);
        if (!response) {
          observations.push({ requestedUrl: item.url, sourceUrl: item.sourceUrl, kind: item.kind, status: hops.at(-1)?.status || null, finalUrl, redirectHops: hops, externalRedirect, fetchedAt: new Date().toISOString() });
          continue;
        }
        const contentType = response.headers.get('content-type') || '';
        const content = await readBounded(response);
        const observation = {
          requestedUrl: item.url,
          canonicalRequestedUrl: canonicalUrl(item.url, config),
          sourceUrl: item.sourceUrl,
          kind: item.kind,
          status: response.status,
          finalUrl,
          redirectHops: hops,
          contentType,
          bytes: content.bytes,
          bodySha256: content.bodySha256,
          tooLarge: content.tooLarge,
          fetchedAt: new Date().toISOString(),
          headers: {
            cacheControl: response.headers.get('cache-control'),
            contentSecurityPolicy: response.headers.get('content-security-policy'),
            xRobotsTag: response.headers.get('x-robots-tag')
          }
        };
        if (content.body && /(?:text\/html|application\/xhtml\+xml)/i.test(contentType)) {
          const signals = extractHtmlSignals(content.body, finalUrl, config);
          Object.assign(observation, signals);
          observation.blank200 = response.status === 200 && signals.visibleTextLength < config.thresholds.blankVisibleTextCharacters;
          observation.soft404 = response.status === 200 && (/\b(?:404|not found|page missing)\b/i.test(signals.title || '') || /\b(?:404|not found|page missing)\b/i.test(content.body.slice(0, 3000)));
          for (const ref of signals.references) {
            if (!ref.url) continue;
            const refKind = ['script', 'img', 'source', 'link'].includes(ref.tag) ? 'asset' : 'page';
            enqueue(ref.url, refKind, finalUrl);
          }
          for (const form of signals.forms) {
            try {
              form.action = sanitizeUrl(form.action, config, { allowExternal: true });
              form.submitted = false;
            } catch (error) {
              form.error = error.message;
            }
          }
        }
        observations.push(observation);
      } catch (error) {
        observations.push({ requestedUrl: item.url, sourceUrl: item.sourceUrl, kind: item.kind, status: null, fetchedAt: new Date().toISOString(), error: error.message.slice(0, 500) });
      }
    }
  }

  await Promise.all(Array.from({ length: config.crawler.concurrency }, () => worker()));
  observations.sort((a, b) => String(a.requestedUrl).localeCompare(String(b.requestedUrl)));
  const payload = {
    sitemap: { url: config.site.sitemapUrl, status: sitemapResponse.status, sha256: sha256(sitemapText), rows: sitemapRows },
    observations,
    externalReferences,
    limits: { maxPages: config.crawler.maxPages, concurrency: config.crawler.concurrency, timeoutMs: config.crawler.timeoutMs, retries: config.crawler.retries }
  };
  const envelope = makeEnvelope({
    source: 'live-crawl',
    dataset: 'http-crawl',
    request: {
      property: config.site.origin,
      reportingWindow: null,
      dimensions: ['url', 'reference'],
      filters: { sameOriginFetchOnly: true, methods: ['GET'], queryParameterMode: config.privacy.queryParameterMode },
      dataState: 'live-readback',
      requestedRows: queued.size,
      retrievedRows: observations.length,
      complete: observations.length === queued.size && queued.size < config.crawler.maxPages,
      limitations: [
        'HTTP crawler does not execute JavaScript; use the render-observation contract for DOM, console, and failed-request evidence.',
        'External links are recorded but not fetched by the same-origin crawler.',
        queued.size >= config.crawler.maxPages ? 'Crawl reached the configured page cap.' : null
      ].filter(Boolean)
    },
    payload
  });
  const output = persistEnvelope(envelope, config);
  console.log(JSON.stringify({ ok: true, output, observations: observations.length, queued: queued.size, complete: envelope.request.complete }, null, 2));
  if (!envelope.request.complete && !args['allow-incomplete']) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`Live crawl failed: ${error.message}`);
  process.exit(1);
});
