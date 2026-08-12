#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ROOT, parseArgs } from './core.mjs';

function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error(`${script} exited with status ${result.status}`);
}

try {
  const args = parseArgs(process.argv.slice(2));
  const configArgs = args.config ? ['--config', args.config] : [];
  run('scripts/audit/collect-repository.mjs', configArgs);
  if (args.live) run('scripts/audit/crawl-live.mjs', [...configArgs, '--max-pages', args['max-pages'] || '200', '--concurrency', args.concurrency || '2']);
  run('scripts/audit/build-report.mjs', configArgs);
} catch (error) {
  console.error(`Read-only audit failed: ${error.message}`);
  process.exit(1);
}
