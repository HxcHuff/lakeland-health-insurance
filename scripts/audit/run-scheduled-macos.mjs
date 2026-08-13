#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { ROOT, parseArgs } from './core.mjs';
import { parseEncryptionKey } from './encryption.mjs';

const KEYCHAIN_SERVICE = 'com.lakeland.audit.encryption-key';
const ALLOWED_BROKER_KEYS = new Set(['gscAccessToken', 'ga4AccessToken', 'expiresAt']);
const GSC_READONLY_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const GA4_READONLY_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const ALLOWED_GOOGLE_SCOPES = new Set([GSC_READONLY_SCOPE, GA4_READONLY_SCOPE]);

export function validateBrokerPayload(payload, { now = new Date() } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Credential broker output must be a JSON object');
  for (const key of Object.keys(payload)) if (!ALLOWED_BROKER_KEYS.has(key)) throw new Error(`Credential broker returned unsupported field: ${key}`);
  for (const key of ['gscAccessToken', 'ga4AccessToken', 'expiresAt']) {
    if (typeof payload[key] !== 'string' || !payload[key].trim()) throw new Error(`Credential broker is missing ${key}`);
  }
  for (const key of ['gscAccessToken', 'ga4AccessToken']) {
    if (payload[key].length > 4096 || /[\r\n\0]/.test(payload[key])) throw new Error(`Credential broker returned malformed ${key}`);
  }
  const expiresAt = new Date(payload.expiresAt);
  if (!Number.isFinite(expiresAt.getTime())) throw new Error('Credential broker expiresAt is invalid');
  const remainingMs = expiresAt.getTime() - now.getTime();
  if (remainingMs < 10 * 60_000) throw new Error('Credential broker tokens expire in less than 10 minutes');
  if (remainingMs > 2 * 60 * 60_000) throw new Error('Credential broker tokens exceed the two-hour short-lived credential boundary');
  return { ...payload, expiresAt: expiresAt.toISOString() };
}

export function validateTokenScopeMetadata(metadata, requiredScope) {
  if (!metadata || typeof metadata !== 'object') throw new Error('Google token metadata is invalid');
  const scopes = String(metadata.scope || '').split(/\s+/).filter(Boolean);
  if (!scopes.includes(requiredScope)) throw new Error(`Google token is missing required readonly scope: ${requiredScope}`);
  const extra = scopes.filter((scope) => !ALLOWED_GOOGLE_SCOPES.has(scope));
  if (extra.length) throw new Error(`Google token contains scope outside the approved readonly boundary: ${extra.join(', ')}`);
  const expiresIn = Number(metadata.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn < 600) throw new Error('Google token metadata reports less than 10 minutes of validity');
  return { scopes: [...new Set(scopes)].sort(), expiresIn };
}

async function tokenMetadata(token, requiredScope) {
  const response = await fetch('https://oauth2.googleapis.com/tokeninfo', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ access_token: token })
  });
  if (!response.ok) throw new Error(`Google token metadata probe returned HTTP ${response.status}`);
  return validateTokenScopeMetadata(await response.json(), requiredScope);
}

export function validateBrokerExecutable(path) {
  if (!isAbsolute(path)) throw new Error('Credential broker path must be absolute');
  const resolved = resolve(path);
  if (resolved === ROOT || resolved.startsWith(`${ROOT}/`)) throw new Error('Credential broker must be outside the repository');
  const stat = statSync(resolved);
  if (!stat.isFile()) throw new Error('Credential broker path must be a regular file');
  if ((stat.mode & 0o111) === 0) throw new Error('Credential broker is not executable');
  if ((stat.mode & 0o077) !== 0) throw new Error('Credential broker permissions must deny group and other access');
  if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) throw new Error('Credential broker must be owned by the current user');
  return resolved;
}

function keychainEncryptionKey() {
  if (process.platform !== 'darwin') throw new Error('The macOS scheduled runner requires macOS Keychain');
  const account = execFileSync('/usr/bin/id', ['-un'], { encoding: 'utf8', timeout: 5_000, maxBuffer: 1024 }).trim();
  const value = execFileSync('/usr/bin/security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', account, '-w'], {
    encoding: 'utf8', timeout: 10_000, maxBuffer: 8192, stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
  parseEncryptionKey(value);
  return value;
}

function brokerCredentials(path) {
  const output = execFileSync(validateBrokerExecutable(path), [], {
    encoding: 'utf8', timeout: 30_000, maxBuffer: 16_384, stdio: ['ignore', 'pipe', 'ignore'],
    env: { PATH: process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin' }
  });
  let parsed;
  try { parsed = JSON.parse(output); }
  catch { throw new Error('Credential broker output is not valid JSON'); }
  return validateBrokerPayload(parsed);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const brokerPath = args.broker || process.env.LHI_AUDIT_CREDENTIAL_BROKER;
  if (!brokerPath) throw new Error('Missing --broker or LHI_AUDIT_CREDENTIAL_BROKER');
  const credentials = brokerCredentials(brokerPath);
  await Promise.all([
    tokenMetadata(credentials.gscAccessToken, GSC_READONLY_SCOPE),
    tokenMetadata(credentials.ga4AccessToken, GA4_READONLY_SCOPE)
  ]);
  const encryptionKey = keychainEncryptionKey();
  const runnerArgs = ['scripts/audit/run-weekly.mjs', '--execute'];
  if (args.config) runnerArgs.push('--config', args.config);
  if (args['enable-external-alert']) runnerArgs.push('--enable-external-alert');
  const result = spawnSync(process.execPath, runnerArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      LHI_GSC_ACCESS_TOKEN: credentials.gscAccessToken,
      LHI_GA4_ACCESS_TOKEN: credentials.ga4AccessToken,
      LHI_AUDIT_ENCRYPTION_KEY: encryptionKey
    }
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch((error) => {
    console.error(`Scheduled audit preflight failed: ${error.message}`);
    process.exit(1);
  });
}
