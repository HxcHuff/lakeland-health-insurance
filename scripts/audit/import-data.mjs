#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import {
  ROOT,
  assertNoSensitiveText,
  loadConfig,
  makeEnvelope,
  parseArgs,
  persistEnvelope,
  sanitizeUrl,
  sha256
} from './core.mjs';

const ALLOWED_COLUMNS = {
  'gsc-page': new Set(['page', 'clicks', 'impressions', 'ctr', 'position', 'date']),
  'gsc-query': new Set(['query', 'clicks', 'impressions', 'ctr', 'position', 'date']),
  'gsc-query-page': new Set(['query', 'page', 'clicks', 'impressions', 'ctr', 'position', 'date']),
  'gsc-bigquery-page': new Set(['page', 'clicks', 'impressions', 'ctr', 'position']),
  'gsc-bigquery-query': new Set(['query', 'is_anonymized_query', 'clicks', 'impressions', 'ctr', 'position']),
  'ga4-page': new Set(['pagePath', 'pageLocation', 'screenPageViews', 'sessions', 'engagedSessions', 'userEngagementDuration']),
  'ga4-landing': new Set(['landingPagePlusQueryString', 'eventName', 'sessions', 'engagedSessions', 'keyEvents']),
  'render-observation': new Set(['url', 'profile', 'retrievedAt', 'finalUrl', 'httpStatus', 'visibleTextLength', 'mainTextLength', 'domNodeCount', 'formCount', 'formMethods', 'submissionAttemptsBlocked', 'consoleErrors', 'failedRequests', 'blockedWriteRequests', 'formSubmissionPerformed', 'screenshotSha256', 'screenshotPath', 'navigationError', 'blank200', 'visualComparison'])
};

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field');
  if (field || row.length) { row.push(field); rows.push(row); }
  const [headers, ...data] = rows.filter((item) => item.some((value) => value !== ''));
  if (!headers) return [];
  if (new Set(headers).size !== headers.length) throw new Error('CSV has duplicate columns');
  return data.map((values, rowIndex) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${rowIndex + 2} has ${values.length} values; expected ${headers.length}`);
    return Object.fromEntries(headers.map((name, index) => [name, values[index]]));
  });
}

function numericRows(rows) {
  const numeric = /^(?:clicks|impressions|ctr|position|screenPageViews|sessions|engagedSessions|userEngagementDuration|keyEvents|httpStatus|visibleTextLength|mainTextLength|domNodeCount|formCount|submissionAttemptsBlocked)$/;
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (!numeric.test(key) || value === '') return [key, value];
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`Non-numeric value in ${key}`);
    return [key, number];
  })));
}

export function validateMetadata(meta, text, rows, args) {
  if (meta.schemaVersion !== 1) throw new Error('Unsupported sidecar schemaVersion');
  if (!ALLOWED_COLUMNS[meta.source]) throw new Error(`Unsupported import source: ${meta.source}`);
  if (meta.fileSha256 !== sha256(text)) throw new Error('Input file SHA-256 does not match sidecar');
  if (meta.rowCount !== rows.length) throw new Error(`Sidecar rowCount=${meta.rowCount}, retrieved rows=${rows.length}`);
  if (!meta.complete && !args['allow-incomplete']) throw new Error('Sidecar marks export incomplete; refusing import');
  if (!meta.sourceProperty || !meta.exportedAt || !meta.dataState || !Array.isArray(meta.dimensions)) throw new Error('Sidecar is missing provenance fields');
  if (/gsc-(?:page|query|query-page)$/.test(meta.source) && meta.dataState === 'fresh' && !meta.limitations?.length) {
    throw new Error('Fresh Search Console data must preserve its incompleteness limitation');
  }
}

function validateColumns(source, rows) {
  const allowed = ALLOWED_COLUMNS[source];
  for (const row of rows) {
    for (const key of Object.keys(row)) if (!allowed.has(key)) throw new Error(`Unexpected ${source} column: ${key}`);
  }
}

function sanitizeRows(source, rows, config) {
  return numericRows(rows).map((row) => {
    const copy = { ...row };
    for (const key of ['page', 'url', 'pageLocation', 'finalUrl']) {
      if (copy[key]) copy[key] = sanitizeUrl(copy[key], config, { allowExternal: source === 'render-observation' && key === 'finalUrl' });
    }
    if (copy.pagePath) {
      const normalized = sanitizeUrl(copy.pagePath, config);
      copy.pagePath = new URL(normalized).pathname;
    }
    if (copy.landingPagePlusQueryString && copy.landingPagePlusQueryString !== '(not set)') {
      copy.normalizedUrl = sanitizeUrl(copy.landingPagePlusQueryString, config);
      copy.landingPagePlusQueryString = new URL(copy.normalizedUrl).pathname;
    }
    if (copy.query) assertNoSensitiveText(copy.query, 'Search Console query');
    if (copy.eventName && !config.ga4.approvedKeyEvents.includes(copy.eventName)) throw new Error(`Unapproved GA4 key event: ${copy.eventName}`);
    if (copy.consoleErrors) copy.consoleErrors = JSON.parse(copy.consoleErrors);
    if (copy.failedRequests) copy.failedRequests = JSON.parse(copy.failedRequests);
    if (copy.blockedWriteRequests) copy.blockedWriteRequests = JSON.parse(copy.blockedWriteRequests);
    if (copy.formMethods) copy.formMethods = JSON.parse(copy.formMethods);
    return copy;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file || !args.sidecar) throw new Error('Usage: import-data.mjs --file export.csv --sidecar export.meta.json [--config path]');
  const config = loadConfig(args.config);
  const file = resolve(ROOT, args.file);
  const sidecar = resolve(ROOT, args.sidecar);
  const text = readFileSync(file, 'utf8');
  const meta = JSON.parse(readFileSync(sidecar, 'utf8'));
  assertNoSensitiveText(JSON.stringify(meta), 'import metadata');
  let rows;
  if (extname(file).toLowerCase() === '.json') {
    const parsed = JSON.parse(text);
    rows = Array.isArray(parsed) ? parsed : parsed.rows;
    if (!Array.isArray(rows)) throw new Error('JSON import must be an array or { rows: [] }');
  } else rows = parseCsv(text);
  validateMetadata(meta, text, rows, args);
  validateColumns(meta.source, rows);
  rows = sanitizeRows(meta.source, rows, config);
  const envelope = makeEnvelope({
    source: meta.source,
    dataset: meta.dataset,
    retrievedAt: meta.exportedAt,
    request: {
      property: meta.sourceProperty,
      reportingWindow: meta.reportingWindow,
      dimensions: meta.dimensions,
      filters: meta.filters,
      dataState: meta.dataState,
      requestedRows: meta.rowCount,
      retrievedRows: rows.length,
      complete: meta.complete,
      limitations: meta.limitations || [],
      importedFileSha256: meta.fileSha256
    },
    payload: { rows }
  });
  const output = persistEnvelope(envelope, config);
  console.log(JSON.stringify({ ok: true, output, source: meta.source, rows: rows.length }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(`Import failed: ${error.message}`);
    process.exit(1);
  });
}
