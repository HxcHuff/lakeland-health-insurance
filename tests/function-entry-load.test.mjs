import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ROOT = resolve(new URL('..', import.meta.url).pathname);
const FUNCTIONS = join(ROOT, 'netlify/functions');

const ENTRIES = [
  'google-lead-webhook.mjs',
  'google-lead-crm-retry.mjs',
  'meta-lead-webhook.mjs',
  'lead.js',
  'calendly-schedule.js',
  'submission-created.js',
  'lead-bridge-retry.js',
  'deploy-succeeded.js',
  'openai-ads-config.js'
];

function functionSources(dir = FUNCTIONS, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) functionSources(full, out);
    else if (['.js', '.mjs', '.cjs'].includes(extname(name))) out.push(full);
  }
  return out;
}

test('each Netlify function entry loads in node', async () => {
  for (const name of ENTRIES) {
    const full = join(FUNCTIONS, name);
    if (name.endsWith('.mjs')) {
      const loaded = await import(pathToFileURL(full).href);
      assert.equal(typeof loaded.default, 'function', name);
    } else {
      const loaded = require(full);
      assert.equal(typeof loaded.handler, 'function', name);
    }
  }
});

test('ESM functions do not runtime-require relative helpers', () => {
  // Netlify bundles functions with esbuild. A createRequire() call is left
  // as a runtime require, and import.meta.url becomes the bundled entry at
  // /var/task/netlify/functions/<entry>.mjs. require("./lead-bridge.js") then
  // looks beside that entry and throws "Cannot find module", which is the
  // production 502 on /api/google-lead-webhook.
  const runtimeRequires = [];
  for (const file of functionSources()) {
    if (!file.endsWith('.mjs')) continue;
    const source = readFileSync(file, 'utf8');
    if (!source.includes('createRequire')) continue;
    for (const match of source.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      runtimeRequires.push(`${relative(ROOT, file)} -> ${match[1]}`);
    }
  }
  assert.deepEqual(runtimeRequires, []);
});
