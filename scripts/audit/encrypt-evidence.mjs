#!/usr/bin/env node
import { loadConfig, parseArgs } from './core.mjs';
import { encryptRunEvidence, parseEncryptionKey } from './encryption.mjs';

try {
  const args = parseArgs(process.argv.slice(2));
  if (!args['run-id']) throw new Error('Usage: encrypt-evidence.mjs --run-id <run-id> [--config path]');
  const config = loadConfig(args.config);
  const output = encryptRunEvidence(config, args['run-id'], parseEncryptionKey(process.env.LHI_AUDIT_ENCRYPTION_KEY));
  console.log(JSON.stringify({ ok: true, ...output, keyPersisted: false }, null, 2));
} catch (error) {
  console.error(`Evidence encryption failed: ${error.message}`);
  process.exit(1);
}
