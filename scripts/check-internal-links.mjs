#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const SKIP_DIRS = new Set(['.git', '.claude', '.netlify', 'node_modules', 'search-engine-from-zip', '.playwright-cli']);
const issues = [];

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

function targetExists(href) {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean || clean === '/') return existsSync(join(ROOT, 'index.html'));
  if (!clean.startsWith('/')) return true;
  if (clean.endsWith('/')) return existsSync(join(ROOT, clean, 'index.html'));
  if (clean.endsWith('.html') || clean.includes('.')) return existsSync(join(ROOT, clean));
  return existsSync(join(ROOT, clean, 'index.html')) || existsSync(join(ROOT, clean + '.html'));
}

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  const html = readFileSync(file, 'utf8');
  const matches = html.matchAll(/\bhref=["']([^"']+)["']/gi);
  for (const match of matches) {
    const href = match[1];
    if (/^(https?:|mailto:|tel:|sms:|#|javascript:)/i.test(href)) continue;
    if (!targetExists(href)) issues.push(`${rel}: broken internal href ${href}`);
  }
}

if (issues.length) {
  console.error(`FAIL - ${issues.length} broken internal link(s):`);
  for (const issue of issues) console.error('  - ' + issue);
  process.exit(1);
}

console.log('OK - internal links resolve');
