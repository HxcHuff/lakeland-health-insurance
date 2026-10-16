#!/usr/bin/env node
/**
 * David rule: no red/orange/amber alert surfaces in public HTML.
 * Scans deployable HTML for forbidden hex/rgb tokens (case-insensitive).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set([
  '.git', '.netlify', '.claude', '.codex', '.playwright-cli', '.ai-worker-local',
  'node_modules', 'netlify', 'scripts', 'tests', 'search-engine-from-zip', 'output',
]);

const HEX_PATTERNS = [
  /#(?:B91C1C|DC2626|EF4444|EA580C|F97316|CA8A04|D97706)\b/gi,
];

const RGB_PATTERN =
  /rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/gi;

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

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

const hits = [];
for (const file of walkHtml(ROOT)) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, 'utf8');
  for (const pattern of HEX_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      hits.push({ rel, line: lineOf(text, match.index), token: match[0] });
    }
  }
  RGB_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(RGB_PATTERN)) {
    const r = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);
    if (r > 180 && g < 140) {
      hits.push({ rel, line: lineOf(text, match.index), token: match[0] });
    }
  }
}

if (hits.length === 0) {
  console.log(`OK — warm-alert color scan: 0 hits across ${walkHtml(ROOT).length} HTML files`);
  process.exit(0);
}

console.error(`FAIL — warm-alert color scan: ${hits.length} hit(s)`);
for (const h of hits.slice(0, 80)) {
  console.error(`  - ${h.rel}:${h.line}: ${h.token}`);
}
if (hits.length > 80) console.error(`  … and ${hits.length - 80} more`);
process.exit(1);
