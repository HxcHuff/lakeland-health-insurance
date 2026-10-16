#!/usr/bin/env node
/**
 * Close .lhi-hero-lede-block before .lhi-hero-grid-lead when the lead section
 * was accidentally nested inside the lede block (breaks mobile order and desktop grid).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'search-engine-from-zip', '.ai-worker-local', 'output']);

function walk(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

const NEEDLE = '<section class="lhi-lead-hero lhi-hero-grid-lead"';
const LEDE = '<div class="lhi-hero-lede-block"';

function fixFile(file) {
  let html = readFileSync(file, 'utf8');
  if (!html.includes(NEEDLE) || !html.includes(LEDE)) return false;

  let changed = false;
  let idx = 0;
  while (true) {
    const leadIdx = html.indexOf(NEEDLE, idx);
    if (leadIdx < 0) break;
    const ledeIdx = html.lastIndexOf(LEDE, leadIdx);
    if (ledeIdx < 0 || leadIdx - ledeIdx > 4000) {
      idx = leadIdx + NEEDLE.length;
      continue;
    }
    const between = html.slice(ledeIdx, leadIdx);
    const openDivs = (between.match(/<div\b/gi) || []).length;
    const closeDivs = (between.match(/<\/div>/gi) || []).length;
    if (openDivs <= closeDivs) {
      idx = leadIdx + NEEDLE.length;
      continue;
    }
    const insert = '</div>\n';
    html = html.slice(0, leadIdx) + insert + html.slice(leadIdx);
    changed = true;
    idx = leadIdx + insert.length + NEEDLE.length;
  }

  if (changed) {
    writeFileSync(file, html);
    console.log('fixed', relative(ROOT, file).replace(/\\/g, '/'));
  }
  return changed;
}

let n = 0;
for (const file of walk()) {
  if (fixFile(file)) n += 1;
}
console.log('total', n);
