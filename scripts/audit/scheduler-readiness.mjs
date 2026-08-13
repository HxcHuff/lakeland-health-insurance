#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadConfig, parseArgs } from './core.mjs';
import { validateBrokerExecutable } from './run-scheduled-macos.mjs';

const KEYCHAIN_SERVICE = 'com.lakeland.audit.encryption-key';

export function buildSchedulerReadiness({ config, keychainAvailable, broker = {}, launchdLoaded }) {
  const checks = {
    scheduleConfigured: config.automation.scheduleEnabled === true,
    retentionExecutionConfigured: config.automation.retentionExecutionEnabled === true,
    encryptionKeyAvailable: keychainAvailable === true,
    credentialBrokerAvailable: broker.available === true,
    credentialBrokerBoundaryValid: broker.valid === true,
    readonlyScopeEnforcementPresent: true,
    launchdLoaded: launchdLoaded === true
  };
  const blockers = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  return {
    schemaVersion: 1,
    ready: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    checks,
    blockers,
    broker: { pathConfigured: Boolean(broker.path), reason: broker.reason || null },
    secretsReturned: false,
    externalMutationPerformed: false
  };
}

function keychainAvailable() {
  if (process.platform !== 'darwin') return false;
  const account = execFileSync('/usr/bin/id', ['-un'], { encoding: 'utf8', timeout: 5_000, maxBuffer: 1024 }).trim();
  return spawnSync('/usr/bin/security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', account], {
    stdio: 'ignore', timeout: 10_000
  }).status === 0;
}

function brokerState(path) {
  if (!path) return { path: null, available: false, valid: false, reason: 'not-configured' };
  if (!existsSync(path)) return { path, available: false, valid: false, reason: 'not-found' };
  try {
    validateBrokerExecutable(path);
    return { path, available: true, valid: true, reason: null };
  } catch (error) {
    return { path, available: true, valid: false, reason: error.message };
  }
}

function launchdLoaded(label) {
  if (process.platform !== 'darwin' || !label) return false;
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  if (uid === null) return false;
  return spawnSync('/bin/launchctl', ['print', `gui/${uid}/${label}`], { stdio: 'ignore', timeout: 10_000 }).status === 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  const path = args.broker || process.env.LHI_AUDIT_CREDENTIAL_BROKER || config.automation.credentialBrokerPath;
  const result = buildSchedulerReadiness({
    config,
    keychainAvailable: keychainAvailable(),
    broker: brokerState(path),
    launchdLoaded: launchdLoaded(config.automation.launchdLabel)
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 2;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) main();
