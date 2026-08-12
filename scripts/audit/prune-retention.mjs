#!/usr/bin/env node
import { loadConfig, parseArgs } from './core.mjs';
import { parseEncryptionKey, pruneExpiredEvidence } from './encryption.mjs';

try {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  const execute = Boolean(args.execute);
  const output = pruneExpiredEvidence(config, { execute, masterKey: execute ? parseEncryptionKey(process.env.LHI_AUDIT_ENCRYPTION_KEY) : null });
  console.log(JSON.stringify({ ok: true, ...output }, null, 2));
} catch (error) {
  console.error(`Retention failed: ${error.message}`);
  process.exit(1);
}
