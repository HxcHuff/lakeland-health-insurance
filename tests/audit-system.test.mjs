import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  assertNoSensitiveText,
  loadConfig,
  makeEnvelope,
  normalizePhone,
  persistEnvelope,
  sanitizeUrl,
  sha256,
  verifyEnvelope
} from '../scripts/audit/core.mjs';
import { buildNormalizedDataset, generateFindings, renderWeeklyReport } from '../scripts/audit/build-report.mjs';
import { parseCsv, validateMetadata } from '../scripts/audit/import-data.mjs';
import { claimCandidates } from '../scripts/audit/collect-repository.mjs';
import { checkRegistry } from '../scripts/check-regulated-claims.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const config = loadConfig();
const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/audit/system-fixture.json'), 'utf8'));

test('North American phone normalization treats country-code and local forms as identical', () => {
  assert.equal(normalizePhone('+1-863-640-3102'), '8636403102');
  assert.equal(normalizePhone('tel:8636403102'), '8636403102');
});

test('city-page structured email matches the canonical authority entity', () => {
  const authority = JSON.parse(readFileSync(join(ROOT, 'data/authority-entities.json'), 'utf8'));
  const files = [
    'brandon-health-insurance/index.html',
    'clearwater-health-insurance/index.html',
    'largo-health-insurance/index.html',
    'new-port-richey-health-insurance/index.html',
    'riverview-health-insurance/index.html',
    'st-petersburg-health-insurance/index.html',
    'tampa-health-insurance/index.html',
    'wesley-chapel-health-insurance/index.html',
    'winter-haven-health-insurance/index.html'
  ];
  for (const file of files) {
    const html = readFileSync(join(ROOT, file), 'utf8');
    const emails = [...html.matchAll(/"email"\s*:\s*"([^"]+)"/g)].map((match) => match[1].toLowerCase());
    assert.deepEqual(new Set(emails), new Set([authority.person.email.toLowerCase()]), file);
  }
});

test('public product references use the canonical Health ProtectorGuard spelling', () => {
  const productEntities = JSON.parse(readFileSync(join(ROOT, 'data/product-entities.json'), 'utf8'));
  const product = productEntities.products.find((item) => item.id === 'health-protectorguard');
  assert.equal(product.canonicalName, 'Health ProtectorGuard');
  const files = [
    'blog/fixed-indemnity-analysis.html',
    'blog/high-deductible-hospital-bills-coverage-gap-florida.html',
    'blog/mental-health-awareness-month-therapy-benefit-lakeland-2026.html',
    'blog/non-income-based-health-insurance-florida.html',
    'health-protector-guard/index.html',
    'learning/index.html',
    'js/site-search.js',
    'links/index.html'
  ];
  for (const file of files) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    assert.doesNotMatch(source, /Health Protector Guard/, file);
    assert.match(source, /Health ProtectorGuard/, file);
  }
});

test('regulated-claim candidate evidence retains original source line numbers', () => {
  const html = [
    '<script>',
    'const hiddenPrice = "$999";',
    '</script>',
    '<style>',
    '.price::after { content: "$888"; }',
    '</style>',
    '<!-- public-looking $777 must remain excluded -->',
    '<p>Visible plan benefit: $250.</p>'
  ].join('\n');
  assert.deepEqual(claimCandidates(html).map((item) => item.line), [8]);
});

test('regulated-claim candidate detection distinguishes counts from four-digit plan years', () => {
  const html = [
    '<p>Review 2027 plan documents before enrollment.</p>',
    '<p>Currently we represent 12 organizations.</p>'
  ].join('\n');
  assert.deepEqual(claimCandidates(html).map((item) => item.line), [2]);
});

test('regulated-claim registry fails closed when controlled statement text changes', async () => {
  const registry = JSON.parse(readFileSync(join(ROOT, 'data/regulated-claims.json'), 'utf8'));
  const tampered = structuredClone(registry);
  const controlled = tampered.claims.find((claim) => claim.candidateEvidence?.length);
  controlled.candidateEvidence[0].fingerprints[0] = '0'.repeat(64);
  const result = await checkRegistry({ root: ROOT, registry: tampered, asOf: '2026-08-12' });
  assert.ok(result.issues.some((issue) => issue.includes('candidate fingerprint no longer matches')));
});

function envelope(source, dataset, payload, window = null, extra = {}) {
  return makeEnvelope({
    source,
    dataset,
    retrievedAt: extra.retrievedAt || '2026-08-12T12:00:00.000Z',
    request: {
      property: source.startsWith('ga4') ? 'properties/492431963' : 'https://lakelandhealthinsurance.com',
      reportingWindow: window,
      dimensions: [],
      filters: {},
      dataState: extra.dataState || 'final',
      requestedRows: null,
      retrievedRows: payload.rows?.length || 0,
      complete: true,
      populationComplete: extra.populationComplete ?? true,
      limitations: extra.limitations || []
    },
    payload
  });
}

function inputs() {
  return {
    repository: envelope('repository', 'fixture-repo', fixture.repository),
    crawl: envelope('live-crawl', 'fixture-crawl', fixture.crawl),
    crawlHistoryCount: 1,
    inspection: null,
    gscPages: [
      envelope('gsc-page', 'previous', { rows: fixture.gscPrevious }, { startDate: '2026-06-01', endDate: '2026-06-30' }, { retrievedAt: '2026-07-02T12:00:00.000Z', populationComplete: false }),
      envelope('gsc-page', 'current', { rows: fixture.gscCurrent }, { startDate: '2026-07-01', endDate: '2026-07-31' }, { populationComplete: false })
    ],
    gscQueries: [envelope('gsc-query', 'queries', { rows: fixture.gscQueries }, { startDate: '2026-07-01', endDate: '2026-07-31' }, { populationComplete: false })],
    ga4Pages: [],
    ga4Landing: [envelope('ga4-landing', 'landings', { landingRows: fixture.ga4Landing, keyEventRows: [] }, { startDate: '2026-07-01', endDate: '2026-07-31' }, { dataState: 'reported' })]
  };
}

test('URL normalization strips fragments and query values and rejects sensitive parameter names', () => {
  assert.equal(
    sanitizeUrl('https://lakelandhealthinsurance.com/get-help/?utm_source=campaign#form', config),
    'https://lakelandhealthinsurance.com/get-help/'
  );
  assert.equal(
    sanitizeUrl('http://lakelandhealthinsurance.com/legacy/?utm_source=campaign', config, { allowCanonicalHostProtocolVariant: true }),
    'https://lakelandhealthinsurance.com/legacy/'
  );
  assert.throws(() => sanitizeUrl('http://lakelandhealthinsurance.com/legacy/', config), /URL outside approved origin/);
  assert.throws(
    () => sanitizeUrl('http://www.lakelandhealthinsurance.com/legacy/', config, { allowCanonicalHostProtocolVariant: true }),
    /URL outside approved origin/
  );
  assert.throws(() => sanitizeUrl('https://lakelandhealthinsurance.com/?applicant_email=test', config), /Sensitive query parameter/);
});

test('raw evidence checksum detects mutation and immutable persistence is idempotent', () => {
  const temp = mkdtempSync(join(tmpdir(), 'lhi-audit-'));
  try {
    const localConfig = structuredClone(config);
    localConfig.storage.root = temp;
    const raw = envelope('repository', 'checksum-fixture', { rows: [{ value: 1 }] });
    const first = persistEnvelope(raw, localConfig);
    const second = persistEnvelope(raw, localConfig);
    assert.equal(first, second);
    const tampered = structuredClone(raw);
    tampered.payload.rows[0].value = 2;
    assert.throws(() => verifyEnvelope(tampered), /Checksum mismatch/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('CSV parser preserves quoted commas and metadata fails closed on count/checksum/completeness', () => {
  const text = 'query,clicks,impressions\n"coverage, florida",2,100\n';
  const rows = parseCsv(text);
  assert.equal(rows[0].query, 'coverage, florida');
  const meta = {
    schemaVersion: 1,
    source: 'gsc-query',
    dataset: 'fixture',
    sourceProperty: 'sc-domain:lakelandhealthinsurance.com',
    reportingWindow: { startDate: '2026-07-01', endDate: '2026-07-31' },
    filters: {},
    dimensions: ['query'],
    dataState: 'final',
    exportedAt: '2026-08-12T12:00:00.000Z',
    rowCount: 1,
    complete: true,
    fileSha256: sha256(text),
    limitations: ['fixture']
  };
  assert.doesNotThrow(() => validateMetadata(meta, text, rows, {}));
  assert.throws(() => validateMetadata({ ...meta, rowCount: 2 }, text, rows, {}), /rowCount/);
  assert.throws(() => validateMetadata({ ...meta, complete: false }, text, rows, {}), /incomplete/);
  assert.throws(() => validateMetadata({ ...meta, fileSha256: '0'.repeat(64) }, text, rows, {}), /SHA-256/);
});

test('imports reject credentials and direct identifiers before storage', () => {
  assert.throws(() => assertNoSensitiveText('email test@example.com', 'fixture'), /direct identifier/);
  assert.throws(() => assertNoSensitiveText('access_token=secret-value', 'fixture'), /credential/);
});

test('findings prioritize compliance gaps and preserve incomplete GSC verification labels', () => {
  const findings = generateFindings(inputs(), config);
  const compliance = findings.find((item) => item.ruleId === 'regulated-claim-registry-gap-candidate');
  const decline = findings.find((item) => item.ruleId === 'gsc-page-decline');
  assert.ok(compliance);
  assert.ok(compliance.score >= 85);
  assert.equal(compliance.automaticActionAllowed, false);
  assert.ok(decline);
  assert.equal(decline.verificationRequired, true);
});

test('weekly report keeps Search Console visibility separate from GA4 usage', () => {
  const sourceInputs = inputs();
  const findings = generateFindings(sourceInputs, config);
  const report = renderWeeklyReport({ runId: 'fixture-run', generatedAt: '2026-08-12T12:00:00.000Z', findings, inputs: sourceInputs, config });
  assert.match(report, /Search Console clicks and impressions.*not page views/);
  assert.match(report, /GA4 views and sessions are site-usage metrics/);
  assert.match(report, /Page and query datasets remain separate/);
  assert.match(report, /Do not change automatically/);
  assert.doesNotMatch(report, /Search Console page views/i);
});

test('normalized output joins URL evidence while retaining query rows separately', () => {
  const normalized = buildNormalizedDataset(inputs(), config, 'fixture-run', '2026-08-12T12:00:00.000Z');
  const home = normalized.urlEntities.find((row) => row.url === 'https://lakelandhealthinsurance.com/');
  assert.ok(home);
  assert.equal(home.repository.sourceFile, 'index.html');
  assert.equal(home.live.status, 200);
  assert.equal(home.searchConsolePage.clicks, 10);
  assert.equal(home.ga4Landing.sessions, 100);
  assert.equal(normalized.searchQueries[0].query, 'lakeland health coverage');
  assert.equal(Object.hasOwn(normalized.searchQueries[0], 'page'), false);
});
