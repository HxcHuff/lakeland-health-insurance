#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PIN = '20261023-pr333-follow-up';
const SKIP_DIRS = new Set([
  '.git', '.netlify', '.claude', '.codex', '.playwright-cli', '.ai-worker-local',
  'node_modules', 'netlify', 'search-engine-from-zip', 'output',
]);

const REPLACEMENTS = [
  [/\/css\/blog-unified\.css\?v=[^"']+/g, `/css/blog-unified.css?v=${PIN}`],
  [/\/css\/lead-hero\.css\?v=[^"']+/g, `/css/lead-hero.css?v=${PIN}`],
  [/\/js\/lead-hero\.js\?v=[^"']+/g, `/js/lead-hero.js?v=${PIN}`],
  [/\/js\/site-template\.js\?v=[^"']+/g, `/js/site-template.js?v=${PIN}`],
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.html') || name === 'sw.js') out.push(full);
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  let text = readFileSync(file, 'utf8');
  const before = text;
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  if (text !== before) {
    writeFileSync(file, text, 'utf8');
    changed += 1;
  }
}
console.log(`bumped pins in ${changed} file(s) → ${PIN}`);
