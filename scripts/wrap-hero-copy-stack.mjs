#!/usr/bin/env node
/** Wrap adjacent lhi-hero-lede-block + lhi-hero-deferred-block in .lhi-hero-copy-stack inside hero/answer grids. */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'search-engine-from-zip', '.ai-worker-local', 'output', 'blog']);

function walk(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function balancedDivEnd(html, start) {
  let depth = 0;
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(html))) {
    if (/^<div\b/i.test(m[0])) depth += 1;
    else if (--depth === 0) return m.index + m[0].length;
  }
  return -1;
}

let n = 0;
for (const file of walk()) {
  let html = readFileSync(file, 'utf8');
  if (!html.includes('lhi-hero-lede-block') || !html.includes('lhi-hero-deferred-block')) continue;
  if (html.includes('lhi-hero-copy-stack')) continue;

  const gridNeedle = /class="(?:[^"]*\s)?(?:container hero-grid|answer-wrap answer-grid|hero-grid)(?:\s[^"]*)?"/;
  let changed = false;
  let searchFrom = 0;
  while (true) {
    const gridMatch = html.slice(searchFrom).match(gridNeedle);
    if (!gridMatch) break;
    const gridIdx = searchFrom + html.slice(searchFrom).indexOf(gridMatch[0]);
    const ledeIdx = html.indexOf('<div class="lhi-hero-lede-block"', gridIdx);
    if (ledeIdx < 0 || ledeIdx > gridIdx + 8000) {
      searchFrom = gridIdx + 1;
      continue;
    }
    const beforeLede = html.slice(gridIdx, ledeIdx);
    if (beforeLede.includes('lhi-hero-copy-stack')) {
      searchFrom = ledeIdx + 1;
      continue;
    }
    const defIdx = html.indexOf('<div class="lhi-hero-deferred-block"', ledeIdx);
    if (defIdx < 0) {
      searchFrom = ledeIdx + 1;
      continue;
    }
    const leadBetween = html.slice(ledeIdx, defIdx);
    if (leadBetween.includes('lhi-hero-grid-lead')) {
      searchFrom = defIdx + 1;
      continue;
    }
    const ledeEnd = balancedDivEnd(html, ledeIdx);
    const defEnd = balancedDivEnd(html, defIdx);
    if (ledeEnd < 0 || defEnd < 0) break;
    const ledeHtml = html.slice(ledeIdx, ledeEnd);
    const defHtml = html.slice(defIdx, defEnd);
    const wrapped = `<div class="lhi-hero-copy-stack">\n${ledeHtml}\n${defHtml}\n</div>`;
    html = html.slice(0, ledeIdx) + wrapped + html.slice(defEnd);
    changed = true;
    n += 1;
    searchFrom = ledeIdx + wrapped.length;
  }
  if (changed) {
    writeFileSync(file, html);
    console.log('wrapped', relative(ROOT, file).replace(/\\/g, '/'));
  }
}
console.log('total', n);
