#!/usr/bin/env node
/** Move lhi-lead-hero out of lhi-hero-lede-block when nested (migration artifact). */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CATEGORY_B, CATEGORY_C } from './non-blog-sitewide-routes.mjs';

const ROOT = join(import.meta.dirname, '..');
const EXTRA = ['about/index.html', 'our-approach.html'];

const LEAD_RE = /<section class="lhi-lead-hero[\s\S]*?<\/section>/i;

function repair(html) {
  let next = html;
  const ledeStart = next.indexOf('<div class="lhi-hero-lede-block">');
  if (ledeStart < 0) return html;
  const leadMatch = next.slice(ledeStart).match(LEAD_RE);
  if (!leadMatch || leadMatch.index == null) return html;
  const leadStart = ledeStart + leadMatch.index;
  const leadEnd = leadStart + leadMatch[0].length;
  const ledeOpenEnd = next.indexOf('>', ledeStart) + 1;
  if (leadStart <= ledeOpenEnd) return html;

  const lead = leadMatch[0].trim();
  next = next.slice(0, leadStart) + next.slice(leadEnd);
  const insertAt = next.indexOf('<div class="lhi-hero-lede-block">');
  if (insertAt < 0) return html;
  const ledeClose = findDivClose(next, insertAt);
  if (ledeClose == null) return html;
  return `${next.slice(0, ledeClose)}\n${lead}\n${next.slice(ledeClose)}`;
}

function findDivClose(html, startIndex) {
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = startIndex;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (/^<div\b/i.test(m[0])) depth += 1;
    else if (--depth === 0) return m.index + m[0].length;
  }
  return null;
}

function walkHtml(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkHtml(p, out);
    else if (ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const targets = new Set([...CATEGORY_B, ...CATEGORY_C, ...EXTRA]);
for (const rel of targets) {
  const path = join(ROOT, rel);
  let orig;
  try {
    orig = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  if (!orig.includes('lhi-hero-lede-block') || !orig.includes('lhi-lead-hero')) continue;
  let next = orig;
  for (let i = 0; i < 4; i += 1) {
    const pass = repair(next);
    if (pass === next) break;
    next = pass;
  }
  if (next !== orig) {
    writeFileSync(path, next, 'utf8');
    console.log('repaired', rel);
  }
}
