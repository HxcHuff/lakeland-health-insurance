#!/usr/bin/env node
/** Re-link lead-hero.css at end of <head> so shell overrides beat page-inline .hero rules. */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const VERSION = '20261015-home-match8';
const MARKER = 'data-lhi-lead-hero-tail';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'search-engine-from-zip', '.ai-worker-local', 'output']);

function walkHtml(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

const tail = `\n  <link rel="stylesheet" href="/css/lead-hero.css?v=${VERSION}" ${MARKER}>\n`;
let n = 0;

for (const file of walkHtml()) {
  let html = readFileSync(file, 'utf8');
  if (!html.includes('lhi-hero-shell') || !html.includes('lead-hero.css')) continue;
  if (html.includes(MARKER)) continue;
  const headClose = html.lastIndexOf('</head>');
  if (headClose < 0) continue;
  html = html.slice(0, headClose) + tail + html.slice(headClose);
  writeFileSync(file, html);
  n += 1;
  console.log('tail-link', relative(ROOT, file).replace(/\\/g, '/'));
}
console.log(`Done. ${n} files.`);
