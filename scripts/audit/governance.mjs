import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT, assertNoSensitiveText, sha256, stableStringify } from './core.mjs';

const ACTIONS = new Set(['assign', 'status', 'accept-risk', 'suppress', 'resolve', 'reopen', 'comment']);
const STATUSES = new Set(['open', 'in-review', 'blocked', 'resolved', 'accepted-risk', 'suppressed']);

function ledgerPath(config) {
  return resolve(ROOT, config.storage.root, 'governance', 'decisions.jsonl');
}

export function readDecisionLedger(config) {
  const path = ledgerPath(config);
  if (!existsSync(path)) return [];
  const rows = [];
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean);
  lines.forEach((line, index) => {
    let row;
    try { row = JSON.parse(line); } catch { throw new Error(`Governance ledger line ${index + 1} is invalid JSON`); }
    const { recordHash, ...unsigned } = row;
    if (recordHash !== sha256(stableStringify(unsigned))) throw new Error(`Governance ledger line ${index + 1} failed checksum verification`);
    const expectedPrevious = index === 0 ? null : rows[index - 1]?.recordHash;
    if (row.previousHash !== expectedPrevious) throw new Error(`Governance ledger line ${index + 1} broke the append-only hash chain`);
    rows.push(row);
  });
  return rows;
}

function cleanText(value, label, { required = false, max = 500 } = {}) {
  const text = String(value || '').trim();
  if (required && !text) throw new Error(`${label} is required`);
  if (text.length > max) throw new Error(`${label} exceeds ${max} characters`);
  if (text) assertNoSensitiveText(text, label);
  return text || null;
}

export function validateDecision(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Decision must be a JSON object');
  const findingId = cleanText(input.findingId, 'findingId', { required: true, max: 240 });
  if (!/^[A-Za-z0-9._:-]+$/.test(findingId)) throw new Error('findingId contains unsupported characters');
  const action = cleanText(input.action, 'action', { required: true, max: 40 });
  if (!ACTIONS.has(action)) throw new Error(`Unsupported governance action: ${action}`);
  const owner = cleanText(input.owner, 'owner', { required: ['assign', 'accept-risk', 'suppress', 'resolve'].includes(action), max: 80 });
  const reasonRequired = ['accept-risk', 'suppress', 'resolve'].includes(action);
  const reason = cleanText(input.reason, 'reason', { required: reasonRequired, max: 1000 });
  let status = action === 'status' && input.status ? cleanText(input.status, 'status', { max: 40 }) : null;
  if (action === 'accept-risk') status = 'accepted-risk';
  if (action === 'suppress') status = 'suppressed';
  if (action === 'resolve') status = 'resolved';
  if (action === 'reopen') status = 'open';
  if (action === 'status' && !status) throw new Error('status is required for a status action');
  if (status && !STATUSES.has(status)) throw new Error(`Unsupported status: ${status}`);
  let expiresAt = input.expiresAt ? new Date(input.expiresAt).toISOString() : null;
  if (['accept-risk', 'suppress'].includes(action)) {
    if (!expiresAt) throw new Error(`${action} requires expiresAt`);
    if (new Date(expiresAt) <= now) throw new Error('expiresAt must be in the future');
  } else expiresAt = null;
  return { findingId, action, owner, status, reason, expiresAt };
}

export function appendDecision(config, input, { actor = 'local-operator', now = new Date() } = {}) {
  const decision = validateDecision(input, now);
  const rows = readDecisionLedger(config);
  const unsigned = {
    schemaVersion: 1,
    recordedAt: now.toISOString(),
    actor: cleanText(actor, 'actor', { required: true, max: 80 }),
    previousHash: rows.at(-1)?.recordHash || null,
    ...decision
  };
  const record = { ...unsigned, recordHash: sha256(stableStringify(unsigned)) };
  const path = ledgerPath(config);
  mkdirSync(resolve(path, '..'), { recursive: true, mode: 0o700 });
  appendFileSync(path, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
  chmodSync(path, 0o600);
  return record;
}

export function governanceByFinding(rows, now = new Date()) {
  const states = new Map();
  for (const row of rows) {
    const state = states.get(row.findingId) || { owner: null, status: 'open', expiresAt: null, reason: null, updatedAt: null, history: [] };
    state.history.push(row);
    if (row.owner) state.owner = row.owner;
    if (row.status) {
      state.status = row.status;
      state.expiresAt = row.expiresAt || null;
      state.reason = row.reason || null;
    }
    state.updatedAt = row.recordedAt;
    states.set(row.findingId, state);
  }
  for (const state of states.values()) {
    if (['accepted-risk', 'suppressed'].includes(state.status) && state.expiresAt && new Date(state.expiresAt) <= now) {
      state.status = 'open';
      state.expiredGovernanceRecord = true;
    }
  }
  return states;
}

export function latestFindings(config) {
  const dir = resolve(ROOT, config.storage.root, 'findings');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
  if (!files.length) return null;
  return files
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')))
    .sort((a, b) => String(a.generatedAt || '').localeCompare(String(b.generatedAt || '')) || String(a.runId).localeCompare(String(b.runId)))
    .at(-1);
}

export function buildDashboardState(config) {
  const manifest = latestFindings(config);
  const ledger = readDecisionLedger(config);
  const governance = governanceByFinding(ledger);
  return {
    generatedAt: new Date().toISOString(),
    runId: manifest?.runId || null,
    readOnlyAudit: true,
    findings: (manifest?.findings || []).map((finding) => ({
      ...finding,
      governance: governance.get(finding.id) || { owner: null, status: 'open', expiresAt: null, reason: null, updatedAt: null, history: [] }
    }))
  };
}
