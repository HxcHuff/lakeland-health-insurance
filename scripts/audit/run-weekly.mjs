#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { ROOT, loadConfig, makeRunId, parseArgs } from './core.mjs';
import { encryptRunEvidence, parseEncryptionKey, pruneExpiredEvidence } from './encryption.mjs';
import { recordLocalFailure, sendExternalFailureAlert } from './failure-alerts.mjs';

export function previousCompleteWeek(now = new Date()) {
  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = current.getUTCDay() || 7;
  const thisMonday = new Date(current.getTime() - (day - 1) * 86_400_000);
  const end = new Date(thisMonday.getTime() - 86_400_000);
  const start = new Date(end.getTime() - 6 * 86_400_000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error(`${script} exited with status ${result.status}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  const window = previousCompleteWeek();
  const runId = args['run-id'] || makeRunId();
  const plan = {
    runId,
    window,
    scheduleEnabled: config.automation.scheduleEnabled,
    retentionExecutionEnabled: config.automation.retentionExecutionEnabled === true,
    externalStorageEnabled: config.automation.externalStorageEnabled,
    externalAlertsEnabled: config.automation.externalAlertsEnabled,
    google: !args['skip-google'],
    liveCrawl: !args['skip-live'],
    browserRender: !args['skip-render'],
    websiteOrIndexingMutation: false,
    dryRun: !args.execute
  };
  if (!args.execute) {
    console.log(JSON.stringify({ ok: true, plan, next: 'Pass --execute for a one-time local run. This does not install or enable a scheduler.' }, null, 2));
    return;
  }
  let stage = 'start';
  try {
    const configArgs = args.config ? ['--config', args.config] : [];
    if (!args['skip-google']) {
      stage = 'connector-validation';
      run('scripts/audit/collect-google.mjs', ['validate', ...configArgs]);
      stage = 'gsc-pages';
      run('scripts/audit/collect-google.mjs', ['gsc-pages', '--start', window.start, '--end', window.end, ...configArgs]);
      stage = 'gsc-queries';
      run('scripts/audit/collect-google.mjs', ['gsc-queries', '--start', window.start, '--end', window.end, ...configArgs]);
      stage = 'gsc-query-pages';
      run('scripts/audit/collect-google.mjs', ['gsc-query-pages', '--start', window.start, '--end', window.end, ...configArgs]);
      stage = 'url-inspection';
      run('scripts/audit/collect-google.mjs', ['inspect', ...configArgs]);
      stage = 'ga4';
      run('scripts/audit/collect-google.mjs', ['ga4', '--start', window.start, '--end', window.end, ...configArgs]);
    }
    stage = 'repository';
    run('scripts/audit/collect-repository.mjs', configArgs);
    if (!args['skip-live']) {
      stage = 'live-crawl';
      run('scripts/audit/crawl-live.mjs', configArgs);
    }
    if (!args['skip-render']) {
      stage = 'browser-render';
      run('audit/browser/collect-render.mjs', configArgs);
    }
    stage = 'report';
    run('scripts/audit/build-report.mjs', ['--run-id', runId, ...configArgs]);
    stage = 'encryption';
    const masterKey = parseEncryptionKey(process.env.LHI_AUDIT_ENCRYPTION_KEY);
    const encrypted = encryptRunEvidence(config, runId, masterKey);
    stage = 'retention';
    const retention = pruneExpiredEvidence(config, { execute: config.automation.retentionExecutionEnabled === true, masterKey });
    console.log(JSON.stringify({ ok: true, plan, encrypted, retention, schedulerInstalled: false, externalAlertSent: false }, null, 2));
  } catch (error) {
    const local = recordLocalFailure(config, { runId, stage, error });
    const alert = await sendExternalFailureAlert(config, local.payload, { explicitlyEnabled: Boolean(args['enable-external-alert']) });
    console.error(JSON.stringify({ ok: false, runId, stage, localFailureRecord: local.path, externalAlert: alert, error: error.message }, null, 2));
    process.exit(1);
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch((error) => {
    console.error(`Weekly audit failed before execution: ${error.message}`);
    process.exit(1);
  });
}
