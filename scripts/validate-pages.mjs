#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const CANONICAL_PHONE = '863-640-3102';
const FORBIDDEN_PHONES = ['617-1376'];

const SKIP_DIRS = new Set([
  '.git', '.claude', 'node_modules', 'netlify', '.netlify', 'tests', 'scripts',
  'search-engine-from-zip',
]);

const SKIP_FILES = new Set([
  'google79927e3ae56b9c82.html',
  'health-protector-guard/nav-snippet.html',
  'newsletter/email-newsletter.html',
  'offline.html',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

const issues = [];
const seen = walk(ROOT);

for (const file of seen) {
  const rel = relative(ROOT, file);
  if (SKIP_FILES.has(rel)) continue;
  const html = readFileSync(file, 'utf8');
  const isNoindex = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html);

  for (const bad of FORBIDDEN_PHONES) {
    if (html.includes(bad)) issues.push(`${rel}: forbidden phone "${bad}"`);
  }

  if (isNoindex) continue;

  if (!html.includes('/js/analytics.js')) {
    issues.push(`${rel}: missing /js/analytics.js (page is indexable)`);
  }

  if (!/<link\s+rel=["']canonical["']\s+href=/i.test(html)) {
    issues.push(`${rel}: missing <link rel="canonical">`);
  }
}

if (issues.length === 0) {
  console.log(`OK — validated ${seen.length} HTML files`);
  process.exit(0);
}

console.error(`FAIL — ${issues.length} issue(s) across ${seen.length} files:`);
for (const i of issues) console.error('  - ' + i);
process.exit(1);
