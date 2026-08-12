#!/usr/bin/env node
import {
  assertNoSensitiveText,
  fetchWithRetry,
  loadConfig,
  makeEnvelope,
  parseArgs,
  persistEnvelope,
  sanitizeUrl
} from './core.mjs';

const GSC_TOKEN_ENV = 'LHI_GSC_ACCESS_TOKEN';
const GA4_TOKEN_ENV = 'LHI_GA4_ACCESS_TOKEN';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function reportingWindow(args) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(args.end || '')) {
    throw new Error('--start and --end must be explicit YYYY-MM-DD dates');
  }
  if (args.start > args.end) throw new Error('--start must not be after --end');
  return { startDate: args.start, endDate: args.end };
}

async function postJson(url, token, body) {
  const response = await fetchWithRetry(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body)
  }, { retries: 2, retryBaseMs: 500 });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { error: { message: text.slice(0, 500) } }; }
  if (!response.ok) throw new Error(`Google API HTTP ${response.status}: ${payload.error?.message || 'unknown error'}`);
  return payload;
}

async function getJson(url, token) {
  const response = await fetchWithRetry(url, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' }
  }, { retries: 2, retryBaseMs: 500 });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { error: { message: text.slice(0, 500) } }; }
  if (!response.ok) throw new Error(`Google API HTTP ${response.status}: ${payload.error?.message || 'unknown error'}`);
  return payload;
}

function previousUtcDate() {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

export function connectorPreflight() {
  return {
    gsc: { environmentVariable: GSC_TOKEN_ENV, present: Boolean(process.env[GSC_TOKEN_ENV]) },
    ga4: { environmentVariable: GA4_TOKEN_ENV, present: Boolean(process.env[GA4_TOKEN_ENV]) }
  };
}

async function validateGsc(config) {
  const token = required(GSC_TOKEN_ENV);
  const sites = await getJson('https://www.googleapis.com/webmasters/v3/sites', token);
  const site = (sites.siteEntry || []).find((entry) => entry.siteUrl === config.searchConsole.siteUrl);
  if (!site) throw new Error(`GSC token cannot see configured property ${config.searchConsole.siteUrl}`);
  const date = previousUtcDate();
  await postJson(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.searchConsole.siteUrl)}/searchAnalytics/query`, token, {
    startDate: date,
    endDate: date,
    dimensions: ['page'],
    type: config.searchConsole.searchType,
    dataState: config.searchConsole.dataState,
    rowLimit: 1,
    startRow: 0
  });
  const inspectionUrl = sanitizeUrl(config.urlInspection.priorityUrls[0], config);
  await postJson('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', token, {
    inspectionUrl,
    siteUrl: config.searchConsole.siteUrl,
    languageCode: config.urlInspection.languageCode
  });
  return {
    property: config.searchConsole.siteUrl,
    permissionLevel: site.permissionLevel || 'unknown',
    capabilities: { propertyList: true, searchAnalytics: true, urlInspection: true },
    probeDate: date,
    inspectionUrl
  };
}

async function validateGa4(config) {
  const token = required(GA4_TOKEN_ENV);
  const date = previousUtcDate();
  await postJson(`https://analyticsdata.googleapis.com/v1beta/properties/${config.ga4.propertyId}:runReport`, token, {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'sessions' }],
    limit: '1',
    keepEmptyRows: false
  });
  return {
    property: `properties/${config.ga4.propertyId}`,
    capabilities: { dataApiRunReport: true },
    probeDate: date
  };
}

export async function validateConnectors(config) {
  const checkedAt = new Date().toISOString();
  const [gsc, ga4] = await Promise.all([validateGsc(config), validateGa4(config)]);
  const payload = {
    checkedAt,
    readOnly: true,
    credentialsPersisted: false,
    gsc,
    ga4
  };
  const envelope = makeEnvelope({
    source: 'connector-validation',
    dataset: 'gsc-url-inspection-ga4',
    retrievedAt: checkedAt,
    request: {
      property: `${config.searchConsole.siteUrl};properties/${config.ga4.propertyId}`,
      reportingWindow: null,
      dimensions: ['connector', 'capability'],
      filters: { requiredCredentialType: 'short-lived-oauth-access-token' },
      dataState: 'authenticated-read-only',
      requestedRows: 4,
      retrievedRows: 4,
      complete: true,
      limitations: ['Functional API probes validate current read access; token values, refresh material, and report rows are not retained.']
    },
    payload
  });
  return { validation: payload, evidenceFile: persistEnvelope(envelope, config) };
}

async function collectGsc(dimension, args, config) {
  const token = required('LHI_GSC_ACCESS_TOKEN');
  const window = reportingWindow(args);
  const rowLimit = Number(args['row-limit'] || config.searchConsole.rowLimit);
  const maxRows = Number(args['max-rows'] || config.searchConsole.maxRows);
  const expectedRows = Number(args['expected-rows'] || config.searchConsole.minimumExpectedRows || 0);
  if (!Number.isInteger(rowLimit) || rowLimit < 1 || rowLimit > 25_000) throw new Error('GSC row limit must be 1 through 25000');
  if (!Number.isInteger(maxRows) || maxRows < rowLimit) throw new Error('GSC max rows must be at least one page');
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.searchConsole.siteUrl)}/searchAnalytics/query`;
  const rows = [];
  const responseMetadata = [];
  let startRow = 0;
  let terminationObserved = false;
  while (startRow < maxRows) {
    const body = {
      startDate: window.startDate,
      endDate: window.endDate,
      dimensions: [dimension],
      type: config.searchConsole.searchType,
      dataState: config.searchConsole.dataState,
      aggregationType: dimension === 'page' ? 'auto' : 'byProperty',
      rowLimit,
      startRow
    };
    const response = await postJson(endpoint, token, body);
    const pageRows = response.rows || [];
    responseMetadata.push({ startRow, returnedRows: pageRows.length, responseAggregationType: response.responseAggregationType || null, metadata: response.metadata || null });
    for (const row of pageRows) {
      const key = row.keys?.[0] || '';
      assertNoSensitiveText(key, `GSC ${dimension} row`);
      rows.push({
        [dimension]: dimension === 'page'
          ? sanitizeUrl(key, config, { allowCanonicalHostProtocolVariant: true })
          : key,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position
      });
    }
    startRow += pageRows.length;
    if (pageRows.length < rowLimit) {
      terminationObserved = true;
      break;
    }
    if (startRow >= maxRows) break;
  }
  if (!terminationObserved) throw new Error('GSC collection may be truncated at maxRows; refusing partial dataset');
  if (expectedRows > rows.length) throw new Error(`GSC expected at least ${expectedRows} rows but retrieved ${rows.length}`);
  const source = dimension === 'page' ? 'gsc-page' : 'gsc-query';
  const envelope = makeEnvelope({
    source,
    dataset: `${dimension}-${window.startDate}-${window.endDate}`,
    request: {
      property: config.searchConsole.siteUrl,
      reportingWindow: window,
      dimensions: [dimension],
      filters: { searchType: config.searchConsole.searchType, aggregationType: dimension === 'page' ? 'auto' : 'byProperty' },
      dataState: config.searchConsole.dataState,
      requestedRows: expectedRows || null,
      retrievedRows: rows.length,
      complete: true,
      populationComplete: false,
      limitations: ['Search Analytics API returns top rows and does not guarantee every underlying row; do not derive site totals or missing rows from this dataset.']
    },
    payload: { rows, responseMetadata }
  });
  return persistEnvelope(envelope, config);
}

async function collectInspection(args, config) {
  const token = required('LHI_GSC_ACCESS_TOKEN');
  const rawUrls = args.urls ? args.urls.split(',') : config.urlInspection.priorityUrls;
  if (rawUrls.length > config.urlInspection.maxUrls) throw new Error(`URL Inspection input exceeds maxUrls=${config.urlInspection.maxUrls}`);
  const urls = rawUrls.map((url) => sanitizeUrl(url.trim(), config));
  const rows = [];
  for (const inspectionUrl of urls) {
    const response = await postJson('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', token, {
      inspectionUrl,
      siteUrl: config.searchConsole.siteUrl,
      languageCode: config.urlInspection.languageCode
    });
    const result = response.inspectionResult || {};
    const index = result.indexStatusResult || {};
    rows.push({
      inspectionUrl,
      inspectionResultLink: result.inspectionResultLink || null,
      indexStatusResult: {
        verdict: index.verdict || null,
        coverageState: index.coverageState || null,
        robotsTxtState: index.robotsTxtState || null,
        indexingState: index.indexingState || null,
        lastCrawlTime: index.lastCrawlTime || null,
        pageFetchState: index.pageFetchState || null,
        googleCanonical: index.googleCanonical ? sanitizeUrl(index.googleCanonical, config, { allowExternal: true }) : null,
        userCanonical: index.userCanonical ? sanitizeUrl(index.userCanonical, config, { allowExternal: true }) : null,
        referringUrls: (index.referringUrls || []).map((url) => sanitizeUrl(url, config, { allowExternal: true })),
        sitemap: index.sitemap || []
      },
      richResultsResult: result.richResultsResult || null,
      mobileUsabilityResult: result.mobileUsabilityResult || null
    });
    if (config.urlInspection.delayMs) await new Promise((done) => setTimeout(done, config.urlInspection.delayMs));
  }
  const envelope = makeEnvelope({
    source: 'url-inspection',
    dataset: 'priority-canonical-urls',
    request: {
      property: config.searchConsole.siteUrl,
      reportingWindow: null,
      dimensions: ['inspectionUrl'],
      filters: { languageCode: config.urlInspection.languageCode },
      dataState: 'google-index-version',
      requestedRows: urls.length,
      retrievedRows: rows.length,
      complete: rows.length === urls.length,
      limitations: ['URL Inspection reports Google index state, not a live-page test.']
    },
    payload: { rows }
  });
  return persistEnvelope(envelope, config);
}

function gaRows(response) {
  const dimensions = (response.dimensionHeaders || []).map((item) => item.name);
  const metrics = (response.metricHeaders || []).map((item) => item.name);
  return (response.rows || []).map((row) => Object.fromEntries([
    ...dimensions.map((name, index) => [name, row.dimensionValues?.[index]?.value || '']),
    ...metrics.map((name, index) => [name, Number(row.metricValues?.[index]?.value || 0)])
  ]));
}

async function gaReport({ token, propertyId, window, dimensions, metrics, limit, dimensionFilter = undefined }) {
  const rows = [];
  let offset = 0;
  let rowCount = null;
  do {
    const body = {
      dateRanges: [{ startDate: window.startDate, endDate: window.endDate }],
      dimensions: dimensions.map((name) => ({ name })),
      metrics: metrics.map((name) => ({ name })),
      limit: String(limit),
      offset: String(offset),
      keepEmptyRows: false,
      returnPropertyQuota: true,
      ...(dimensionFilter ? { dimensionFilter } : {})
    };
    const response = await postJson(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, token, body);
    rowCount = Number(response.rowCount || 0);
    rows.push(...gaRows(response));
    offset = rows.length;
    if (response.propertyQuota?.tokensPerDay?.remaining === 0) throw new Error('GA4 daily property quota exhausted');
  } while (rows.length < rowCount);
  if (rows.length !== rowCount) throw new Error(`GA4 rowCount=${rowCount} but retrieved ${rows.length}`);
  return rows;
}

async function collectGa4(args, config) {
  const token = required('LHI_GA4_ACCESS_TOKEN');
  const window = reportingWindow(args);
  const propertyId = config.ga4.propertyId;
  const pageRows = await gaReport({ token, propertyId, window, dimensions: config.ga4.pageDimensions, metrics: config.ga4.pageMetrics, limit: config.ga4.limit });
  pageRows.forEach((row) => {
    if (row.pageLocation === '(not set)' || !row.pageLocation) {
      row.pageLocation = null;
      row.pagePath = row.pagePath === '(not set)' ? null : row.pagePath || null;
      row.normalizationState = 'not-set';
      return;
    }
    row.pageLocation = sanitizeUrl(row.pageLocation, config, { allowExternal: false });
    row.pagePath = new URL(row.pageLocation).pathname;
    row.normalizationState = 'normalized';
  });
  const pages = makeEnvelope({
    source: 'ga4-page',
    dataset: `pages-${window.startDate}-${window.endDate}`,
    request: { property: `properties/${propertyId}`, reportingWindow: window, dimensions: config.ga4.pageDimensions, filters: {}, dataState: 'reported', requestedRows: null, retrievedRows: pageRows.length, complete: true, limitations: [] },
    payload: { rows: pageRows }
  });
  const pageFile = persistEnvelope(pages, config);

  const landingRows = await gaReport({ token, propertyId, window, dimensions: [config.ga4.landingDimension], metrics: config.ga4.landingMetrics, limit: config.ga4.limit });
  const eventFilter = {
    orGroup: { expressions: config.ga4.approvedKeyEvents.map((event) => ({ filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: event, caseSensitive: true } } })) }
  };
  const keyEventRows = await gaReport({ token, propertyId, window, dimensions: [config.ga4.landingDimension, 'eventName'], metrics: ['keyEvents'], limit: config.ga4.limit, dimensionFilter: eventFilter });
  for (const row of [...landingRows, ...keyEventRows]) {
    const raw = row[config.ga4.landingDimension];
    if (raw && raw !== '(not set)') row.normalizedUrl = sanitizeUrl(raw, config);
  }
  const landing = makeEnvelope({
    source: 'ga4-landing',
    dataset: `landings-${window.startDate}-${window.endDate}`,
    request: { property: `properties/${propertyId}`, reportingWindow: window, dimensions: [config.ga4.landingDimension, 'eventName'], filters: { approvedKeyEvents: config.ga4.approvedKeyEvents }, dataState: 'reported', requestedRows: null, retrievedRows: landingRows.length + keyEventRows.length, complete: true, limitations: ['Key-event rows include only repository-approved event names.'] },
    payload: { landingRows, keyEventRows }
  });
  return { pageFile, landingFile: persistEnvelope(landing, config) };
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) throw new Error('Usage: collect-google.mjs <gsc-pages|gsc-queries|inspect|ga4> [options]');
  const args = parseArgs(rest);
  const config = loadConfig(args.config);
  let output;
  if (command === 'preflight') output = connectorPreflight();
  else if (command === 'validate') output = await validateConnectors(config);
  else if (command === 'gsc-pages') output = await collectGsc('page', args, config);
  else if (command === 'gsc-queries') output = await collectGsc('query', args, config);
  else if (command === 'inspect') output = await collectInspection(args, config);
  else if (command === 'ga4') output = await collectGa4(args, config);
  else throw new Error(`Unknown command: ${command}`);
  console.log(JSON.stringify({ ok: true, output }, null, 2));
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch((error) => {
    console.error(`Google collection failed: ${error.message}`);
    process.exit(1);
  });
}
