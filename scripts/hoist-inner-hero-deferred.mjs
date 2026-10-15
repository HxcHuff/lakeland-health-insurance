#!/usr/bin/env node
/**
 * Move lhi-hero-deferred-block from inside hero/answer-hero to shell sibling after grid-lead.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'search-engine-from-zip', '.ai-worker-local', 'output', 'blog']);
const SKIP_FILES = new Set(['index.html', 'medicare/index.html']);

function walk(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function sectionBounds(html, start) {
  const re = /<section\b|<\/section>/gi;
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (/^<section\b/i.test(m[0])) depth += 1;
    else if (--depth === 0) return { start, end: m.index + m[0].length };
  }
  return null;
}

function balancedDiv(html, start) {
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (/^<div\b/i.test(m[0])) depth += 1;
    else if (--depth === 0) return { start, end: m.index + m[0].length, html: html.slice(start, m.index + m[0].length) };
  }
  return null;
}

let n = 0;
for (const file of walk()) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (SKIP_FILES.has(rel)) continue;
  let html = readFileSync(file, 'utf8');
  if (!html.includes('lhi-hero-shell') || !html.includes('lhi-hero-grid-lead')) continue;

  const shellOpen = html.indexOf('<div class="lhi-hero-shell">');
  if (shellOpen < 0) continue;

  const leadIdx = html.indexOf('<section class="lhi-lead-hero lhi-hero-grid-lead"', shellOpen);
  if (leadIdx < 0) continue;
  const leadEnd = sectionBounds(html, leadIdx)?.end;
  if (!leadEnd) continue;

  const shellClose = html.indexOf('</div>', leadEnd);
  if (shellClose < 0) continue;
  const afterLead = html.slice(leadEnd, shellClose);
  if (afterLead.includes('lhi-hero-deferred-block')) continue;

  const innerIdx = html.indexOf('<div class="lhi-hero-deferred-block"', shellOpen);
  if (innerIdx < 0 || innerIdx >= leadIdx) continue;

  const block = balancedDiv(html, innerIdx);
  if (!block) continue;

  html = html.slice(0, block.start) + html.slice(block.end);
  const leadIdx2 = html.indexOf('<section class="lhi-lead-hero lhi-hero-grid-lead"', shellOpen);
  const leadEnd2 = sectionBounds(html, leadIdx2)?.end;
  if (!leadEnd2) continue;

  html = html.slice(0, leadEnd2) + `\n${block.html.trim()}\n` + html.slice(leadEnd2);
  writeFileSync(file, html);
  n += 1;
  console.log('hoisted', rel);
}
console.log(`Done. ${n} files.`);
