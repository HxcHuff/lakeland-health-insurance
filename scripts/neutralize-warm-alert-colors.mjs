#!/usr/bin/env node
/** Replace forbidden warm alert tokens with navy/slate neutrals (David rule). */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set([
  '.git', '.netlify', '.claude', '.codex', '.playwright-cli', '.ai-worker-local',
  'node_modules', 'netlify', 'scripts', 'tests', 'search-engine-from-zip', 'output',
]);

const REPLACEMENTS = [
  [/#B91C1C\b/gi, '#475569'],
  [/#DC2626\b/gi, '#475569'],
  [/#EF4444\b/gi, '#64748B'],
  [/#EA580C\b/gi, '#64748B'],
  [/#F97316\b/gi, '#64748B'],
  [/#CA8A04\b/gi, '#64748B'],
  [/#D97706\b/gi, '#64748B'],
  [/rgb\s*\(\s*202\s*,\s*138\s*,\s*4\s*\)/gi, 'rgb(100, 116, 139)'],
  [/#FEF2F2\b/gi, '#F1F5F9'],
  [/#FFF7ED\b/gi, '#F8FAFC'],
  [/#fff7ed\b/g, '#f8fafc'],
  [/#fed7aa\b/gi, '#E2E8F0'],
  [/#FEF9C3\b/gi, '#F1F5F9'],
];

function walkHtml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkHtml(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

let changed = 0;
for (const file of walkHtml(ROOT)) {
  let html = readFileSync(file, 'utf8');
  const before = html;
  for (const [pattern, replacement] of REPLACEMENTS) {
    html = html.replace(pattern, replacement);
  }
  if (html !== before) {
    writeFileSync(file, html, 'utf8');
    changed += 1;
    console.log(relative(ROOT, file));
  }
}
console.log(`neutralized ${changed} file(s)`);
