import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

import { connectorPreflight } from '../scripts/audit/collect-google.mjs';
import { loadConfig } from '../scripts/audit/core.mjs';
import { appendDecision, governanceByFinding, latestFindings, readDecisionLedger, validateDecision } from '../scripts/audit/governance.mjs';
import { decryptBuffer, encryptRunEvidence, parseEncryptionKey, pruneExpiredEvidence, verifyEncryptedManifest } from '../scripts/audit/encryption.mjs';
import { previousCompleteWeek } from '../scripts/audit/run-weekly.mjs';
import { collectRenderObservations } from '../audit/browser/collect-render.mjs';

function tempConfig(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const config = structuredClone(loadConfig());
  config.storage.root = root;
  return { root, config };
}

test('connector preflight reports presence only and never returns credential values', () => {
  const priorGsc = process.env.LHI_GSC_ACCESS_TOKEN;
  const priorGa = process.env.LHI_GA4_ACCESS_TOKEN;
  process.env.LHI_GSC_ACCESS_TOKEN = 'fixture-gsc-secret';
  process.env.LHI_GA4_ACCESS_TOKEN = 'fixture-ga4-secret';
  try {
    const result = connectorPreflight();
    assert.equal(result.gsc.present, true);
    assert.equal(result.ga4.present, true);
    assert.doesNotMatch(JSON.stringify(result), /fixture-.*-secret/);
  } finally {
    if (priorGsc === undefined) delete process.env.LHI_GSC_ACCESS_TOKEN; else process.env.LHI_GSC_ACCESS_TOKEN = priorGsc;
    if (priorGa === undefined) delete process.env.LHI_GA4_ACCESS_TOKEN; else process.env.LHI_GA4_ACCESS_TOKEN = priorGa;
  }
});

test('accepted-risk and suppression governance require a reason and future expiry', () => {
  const now = new Date('2026-08-12T12:00:00.000Z');
  assert.throws(() => validateDecision({ findingId: 'rule:abc', action: 'accept-risk', owner: 'Compliance', reason: 'Reviewed' }, now), /expiresAt/);
  assert.throws(() => validateDecision({ findingId: 'rule:abc', action: 'suppress', owner: 'Compliance', reason: 'Duplicate', expiresAt: '2026-08-01T00:00:00.000Z' }, now), /future/);
  assert.equal(validateDecision({ findingId: 'rule:abc', action: 'accept-risk', owner: 'Compliance', reason: 'Compensating control', expiresAt: '2026-09-01T00:00:00.000Z' }, now).status, 'accepted-risk');
});

test('governance ledger is append-only, hash chained, and retains resolution history', () => {
  const { root, config } = tempConfig('lhi-governance-');
  try {
    appendDecision(config, { findingId: 'rule:abc', action: 'assign', owner: 'Site Operations' }, { now: new Date('2026-08-12T12:00:00.000Z') });
    appendDecision(config, { findingId: 'rule:abc', action: 'resolve', owner: 'Site Operations', reason: 'Evidence verified locally' }, { now: new Date('2026-08-12T13:00:00.000Z') });
    const rows = readDecisionLedger(config);
    assert.equal(rows.length, 2);
    assert.equal(rows[1].previousHash, rows[0].recordHash);
    const state = governanceByFinding(rows).get('rule:abc');
    assert.equal(state.owner, 'Site Operations');
    assert.equal(state.status, 'resolved');
    assert.equal(state.history.length, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('encrypted evidence round trips and retention is dry-run by default', () => {
  const { root, config } = tempConfig('lhi-encryption-');
  const runId = '2026-08-12-demo';
  try {
    for (const dir of ['findings', 'normalized', 'reports']) mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, 'findings', `${runId}.json`), JSON.stringify({ runId, sourceChecksums: {}, findings: [] }));
    writeFileSync(join(root, 'normalized', `${runId}.json`), JSON.stringify({ runId, urlEntities: [], searchQueries: [] }));
    writeFileSync(join(root, 'reports', `${runId}.md`), '# Local report\n');
    const key = parseEncryptionKey('11'.repeat(32));
    const output = encryptRunEvidence(config, runId, key, { now: new Date('2026-08-01T00:00:00.000Z') });
    const manifest = JSON.parse(readFileSync(join(output.destination, 'manifest.json'), 'utf8'));
    assert.equal(verifyEncryptedManifest(manifest, key), true);
    const entry = manifest.files.find((item) => item.relativePath.endsWith(`${runId}.md`));
    const plaintext = decryptBuffer(readFileSync(join(output.destination, entry.encryptedFile)), key, entry.relativePath, entry.iv, entry.tag);
    assert.equal(plaintext.toString(), '# Local report\n');
    const plan = pruneExpiredEvidence(config, { now: new Date('2027-01-01T00:00:00.000Z') });
    assert.equal(plan.execute, false);
    assert.deepEqual(plan.expired.map((item) => item.runId), [runId]);
    assert.ok(readFileSync(join(output.destination, 'manifest.json')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('weekly reporting window is the previous complete Monday through Sunday', () => {
  assert.deepEqual(previousCompleteWeek(new Date('2026-08-12T15:00:00.000Z')), { start: '2026-08-03', end: '2026-08-09' });
});

test('dashboard selects the most recently generated findings manifest rather than filename order', () => {
  const { root, config } = tempConfig('lhi-dashboard-');
  try {
    mkdirSync(join(root, 'findings'), { recursive: true });
    writeFileSync(join(root, 'findings', 'z-old.json'), JSON.stringify({ runId: 'old', generatedAt: '2026-08-01T00:00:00.000Z', findings: [] }));
    writeFileSync(join(root, 'findings', 'a-new.json'), JSON.stringify({ runId: 'new', generatedAt: '2026-08-12T00:00:00.000Z', findings: [] }));
    assert.equal(latestFindings(config).runId, 'new');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('browser render detects failed assets and blocks automatic form submission', async () => {
  const server = createServer((request, response) => {
    if (request.url === '/missing.js') {
      response.writeHead(404, { 'content-type': 'text/javascript' });
      response.end('');
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><main><h1>Render fixture</h1><p>This fixture has enough visible text to avoid blank detection while exercising browser controls.</p><form method="post" action="/submit"></form><script src="/missing.js"></script><script>document.forms[0].requestSubmit()</script></main>');
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve()));
  const { root, config } = tempConfig('lhi-render-');
  config.browser.profiles = [{ name: 'desktop', width: 900, height: 700, deviceScaleFactor: 1 }];
  config.browser.timeoutMs = 5_000;
  config.browser.settleMs = 50;
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const [row] = await collectRenderObservations({ config, origin, urls: [`${origin}/`], screenshotDir: join(root, 'screenshots') });
    assert.equal(row.httpStatus, 200);
    assert.equal(row.formCount, 1);
    assert.equal(row.submissionAttemptsBlocked, 1);
    assert.equal(row.formSubmissionPerformed, false);
    assert.ok(row.failedRequests.some((item) => item.url?.endsWith('/missing.js') && item.status === 404));
    assert.ok(row.screenshotSha256);
  } finally {
    server.close();
    rmSync(root, { recursive: true, force: true });
  }
});
