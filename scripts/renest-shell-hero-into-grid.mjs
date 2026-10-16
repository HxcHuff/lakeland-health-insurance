#!/usr/bin/env node
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

function balancedDiv(html, start) {
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (/^<div\b/i.test(m[0])) depth += 1;
    else if (--depth === 0) return { end: m.index + m[0].length };
  }
  return null;
}

const prematureClose =
  /(\n\s*<\/div>\n\s*<\/section>\n|\n\s*<\/div>\n<\/section>\n)(<section class="lhi-lead-hero lhi-hero-grid-lead")/g;
const hasPremature =
  /\n\s*<\/div>\n\s*<\/section>\n<section class="lhi-lead-hero lhi-hero-grid-lead"|\n\s*<\/div>\n<\/section>\n<section class="lhi-lead-hero lhi-hero-grid-lead"/;

let n = 0;
for (const file of walk()) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (rel === 'index.html') continue;
  let html = readFileSync(file, 'utf8');
  const shellOpen = html.indexOf('<div class="lhi-hero-shell">');
  if (shellOpen < 0) continue;
  const shellPart = html.slice(shellOpen, shellOpen + 25000);
  if (!hasPremature.test(shellPart)) continue;
  if (!html.includes('class="container hero-grid"') && html.includes('<div class="container">')) {
    html = html.replace('<div class="container">', '<div class="container hero-grid">');
  }

  prematureClose.lastIndex = 0;
  html = html.replace(prematureClose, '\n$2');
  const leadIdx = html.indexOf('<section class="lhi-lead-hero lhi-hero-grid-lead"', shellOpen);
  const leadEnd = html.indexOf('</section>', leadIdx) + '</section>'.length;
  let shellEndMarker = html.indexOf('</div><section', leadEnd);
  if (shellEndMarker < 0) shellEndMarker = html.indexOf('</div><nav', leadEnd);
  if (shellEndMarker < 0) shellEndMarker = html.indexOf('</div>\n<section', leadEnd);
  if (shellEndMarker < 0) continue;
  let tailStart = leadEnd;
  const defIdx = html.indexOf('<div class="lhi-hero-deferred-block"', leadEnd);
  if (defIdx >= 0 && defIdx < shellEndMarker) {
    const dEnd = balancedDiv(html, defIdx);
    if (dEnd) tailStart = dEnd.end;
  }
  if (!html.slice(tailStart, shellEndMarker).trim().endsWith('</section>')) {
    html = `${html.slice(0, shellEndMarker)}      </div>\n    </section>\n${html.slice(shellEndMarker)}`;
  }
  writeFileSync(file, html);
  n += 1;
  console.log('renested', rel);
}
console.log('total', n);
