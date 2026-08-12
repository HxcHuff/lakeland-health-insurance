import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, sha256 } from './core.mjs';

export function recordLocalFailure(config, { runId, stage, error, occurredAt = new Date().toISOString() }) {
  const payload = {
    schemaVersion: 1,
    runId,
    occurredAt,
    stage,
    errorName: error?.name || 'Error',
    messageSha256: sha256(error?.message || String(error)),
    externalAlertSent: false
  };
  const dir = resolve(ROOT, config.storage.root, 'failures');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = resolve(dir, `${occurredAt.replace(/[:.]/g, '-')}_${sha256(`${runId}:${stage}`).slice(0, 12)}.json`);
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return { path, payload };
}

export async function sendExternalFailureAlert(config, event, { explicitlyEnabled = false } = {}) {
  if (!config.automation.externalAlertsEnabled || !explicitlyEnabled) return { sent: false, reason: 'approval-gated-disabled' };
  const endpoint = process.env.LHI_AUDIT_ALERT_WEBHOOK;
  if (!endpoint) throw new Error('Missing required environment variable LHI_AUDIT_ALERT_WEBHOOK');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:') throw new Error('Failure alert webhook must use HTTPS');
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ runId: event.runId, occurredAt: event.occurredAt, stage: event.stage, errorName: event.errorName, messageSha256: event.messageSha256 })
  });
  if (!response.ok) throw new Error(`Failure alert returned HTTP ${response.status}`);
  await response.body?.cancel();
  return { sent: true };
}
