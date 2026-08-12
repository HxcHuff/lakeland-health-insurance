#!/usr/bin/env node
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import {
  ROOT,
  loadConfig,
  makeEnvelope,
  parseArgs,
  parseSitemap,
  persistEnvelope,
  sanitizeUrl,
  sha256
} from '../../scripts/audit/core.mjs';

function allowedOrigin(raw, configuredOrigin) {
  const origin = new URL(raw || configuredOrigin).origin;
  const hostname = new URL(origin).hostname;
  if (origin !== configuredOrigin && !['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
    throw new Error(`Browser origin outside configured or loopback boundary: ${origin}`);
  }
  return origin;
}

function targetUrls(args, config, origin) {
  const candidates = args.urls
    ? args.urls.split(',').map((item) => item.trim()).filter(Boolean)
    : parseSitemap(readFileSync(resolve(ROOT, 'sitemap.xml'), 'utf8')).map((row) => row.url);
  const limit = Number(args['max-pages'] || config.browser.maxPages);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('Browser max-pages must be an integer from 1 through 200');
  const urls = [];
  for (const candidate of candidates) {
    const source = new URL(candidate, config.site.origin);
    if (source.origin !== config.site.origin) throw new Error(`Browser URL outside configured site: ${source.origin}`);
    const mapped = new URL(`${source.pathname}${source.search}`, origin);
    mapped.hash = '';
    if (!urls.includes(mapped.href)) urls.push(mapped.href);
    if (urls.length >= limit) break;
  }
  return urls;
}

function sanitizedFailureUrl(raw, config, origin) {
  try {
    const url = new URL(raw);
    if (url.origin === origin && origin !== config.site.origin) {
      url.host = new URL(config.site.origin).host;
      url.protocol = new URL(config.site.origin).protocol;
    }
    return sanitizeUrl(url.href, config, { allowExternal: true });
  } catch {
    return null;
  }
}

function deduplicate(rows) {
  return [...new Map(rows.map((row) => [JSON.stringify(row), row])).values()];
}

export async function observePage(context, url, profile, config, origin, screenshotDir) {
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  const blockedWriteRequests = [];
  let mainResponse = null;

  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method())) {
      blockedWriteRequests.push({ method: request.method(), resourceType: request.resourceType(), url: sanitizedFailureUrl(request.url(), config, origin) });
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });

  await page.addInitScript(() => {
    window.__lhiAuditSubmissionAttempts = 0;
    const block = (event) => {
      window.__lhiAuditSubmissionAttempts += 1;
      event?.preventDefault?.();
      event?.stopImmediatePropagation?.();
      return false;
    };
    document.addEventListener('submit', block, true);
    HTMLFormElement.prototype.submit = function submitBlocked() { window.__lhiAuditSubmissionAttempts += 1; };
    HTMLFormElement.prototype.requestSubmit = function requestSubmitBlocked() { window.__lhiAuditSubmissionAttempts += 1; };
  });

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const location = message.location();
    consoleErrors.push({
      type: 'console',
      messageSha256: sha256(message.text()),
      locationUrl: location.url ? sanitizedFailureUrl(location.url, config, origin) : null,
      lineNumber: location.lineNumber ?? null,
      columnNumber: location.columnNumber ?? null
    });
  });
  page.on('pageerror', (error) => consoleErrors.push({ type: 'pageerror', messageSha256: sha256(error.message || String(error)) }));
  page.on('requestfailed', (request) => {
    if (!['document', 'script', 'stylesheet', 'font', 'image'].includes(request.resourceType())) return;
    if (blockedWriteRequests.some((row) => row.method === request.method() && row.url === sanitizedFailureUrl(request.url(), config, origin))) return;
    failedRequests.push({
      kind: 'requestfailed',
      resourceType: request.resourceType(),
      url: sanitizedFailureUrl(request.url(), config, origin),
      failure: request.failure()?.errorText?.slice(0, 120) || 'unknown'
    });
  });
  page.on('response', (response) => {
    const request = response.request();
    if (response.status() < 400 || !['document', 'script', 'stylesheet', 'font', 'image'].includes(request.resourceType())) return;
    failedRequests.push({ kind: 'http', resourceType: request.resourceType(), url: sanitizedFailureUrl(response.url(), config, origin), status: response.status() });
  });

  const retrievedAt = new Date().toISOString();
  let navigationError = null;
  try {
    mainResponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.browser.timeoutMs });
    await page.waitForTimeout(config.browser.settleMs);
  } catch (error) {
    navigationError = { name: error.name, messageSha256: sha256(error.message || String(error)) };
  }

  const rendered = await page.evaluate(() => ({
    visibleTextLength: (document.body?.innerText || '').trim().length,
    mainTextLength: (document.querySelector('main')?.innerText || '').trim().length,
    domNodeCount: document.querySelectorAll('*').length,
    formCount: document.forms.length,
    formMethods: [...document.forms].map((form) => (form.method || 'get').toUpperCase()),
    submissionAttemptsBlocked: window.__lhiAuditSubmissionAttempts || 0
  })).catch(() => ({ visibleTextLength: 0, mainTextLength: 0, domNodeCount: 0, formCount: 0, formMethods: [], submissionAttemptsBlocked: 0 }));

  const screenshotPath = join(screenshotDir, profile.name, `${sha256(url).slice(0, 24)}.png`);
  mkdirSync(resolve(screenshotPath, '..'), { recursive: true, mode: 0o700 });
  let screenshotSha256 = null;
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
    screenshotSha256 = sha256(readFileSync(screenshotPath));
  } catch (error) {
    consoleErrors.push({ type: 'screenshot', messageSha256: sha256(error.message || String(error)) });
  }

  const finalUrlRaw = page.url() || url;
  const originalUrl = new URL(url);
  const canonicalSourceUrl = new URL(`${originalUrl.pathname}${originalUrl.search}`, config.site.origin).href;
  const finalUrl = sanitizedFailureUrl(finalUrlRaw, config, origin);
  const blockedWriteUrls = new Set(blockedWriteRequests.map((row) => row.url).filter(Boolean));
  const actionableConsoleErrors = consoleErrors.filter((row) => !row.locationUrl || !blockedWriteUrls.has(row.locationUrl));
  await page.close();
  return {
    url: sanitizeUrl(canonicalSourceUrl, config),
    profile: profile.name,
    viewport: { width: profile.width, height: profile.height, deviceScaleFactor: profile.deviceScaleFactor || 1 },
    retrievedAt,
    finalUrl,
    httpStatus: mainResponse?.status() || null,
    ...rendered,
    consoleErrors: deduplicate(actionableConsoleErrors),
    failedRequests: deduplicate(failedRequests),
    blockedWriteRequests: deduplicate(blockedWriteRequests),
    formSubmissionPerformed: false,
    screenshotSha256,
    screenshotPath: screenshotSha256 ? screenshotPath.slice(resolve(ROOT).length + 1) : null,
    navigationError,
    blank200: mainResponse?.status() === 200 && rendered.visibleTextLength < config.thresholds.blankVisibleTextCharacters
  };
}

export async function collectRenderObservations({ config, origin, urls, screenshotDir }) {
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  try {
    for (const profile of config.browser.profiles) {
      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        deviceScaleFactor: profile.deviceScaleFactor || 1,
        serviceWorkers: 'block',
        acceptDownloads: false
      });
      for (const url of urls) rows.push(await observePage(context, url, profile, config, origin, screenshotDir));
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  const origin = allowedOrigin(args.origin, config.site.origin);
  const urls = targetUrls(args, config, origin);
  const startedAt = new Date().toISOString();
  const stamp = startedAt.replace(/[:.]/g, '-');
  const screenshotDir = resolve(ROOT, config.storage.root, 'screenshots', stamp);
  const rows = await collectRenderObservations({ config, origin, urls, screenshotDir });
  const envelope = makeEnvelope({
    source: 'render-observation',
    dataset: `browser-render-${origin === config.site.origin ? 'live' : 'localhost'}`,
    retrievedAt: startedAt,
    request: {
      property: origin === config.site.origin ? config.site.origin : 'loopback-local-demo',
      reportingWindow: null,
      dimensions: ['url', 'profile'],
      filters: { methodsAllowed: ['GET', 'HEAD'], formSubmission: false, profiles: config.browser.profiles.map((profile) => profile.name) },
      dataState: 'browser-render',
      requestedRows: urls.length * config.browser.profiles.length,
      retrievedRows: rows.length,
      complete: rows.length === urls.length * config.browser.profiles.length,
      limitations: ['Rendered text is measured but not retained. Screenshots are local-only evidence and are referenced by checksum. All non-GET/HEAD requests are blocked.']
    },
    payload: { rows }
  });
  const output = persistEnvelope(envelope, config);
  console.log(JSON.stringify({ ok: true, output, screenshots: screenshotDir, urls: urls.length, observations: rows.length, formSubmissions: 0 }, null, 2));
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch((error) => {
    console.error(`Browser render collection failed: ${error.message}`);
    process.exit(1);
  });
}
