#!/usr/bin/env node
/** Move lhi-lead-hero to sit directly after lhi-hero-lede-block (before deferred). */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const TARGETS = [
  'about/index.html',
  'retiring-and-medicare-lakeland-fl/index.html'
];

const LEAD_RE = /<section class="lhi-lead-hero[\s\S]*?<\/section>/i;

for (const rel of TARGETS) {
  const path = join(ROOT, rel);
  let html = readFileSync(path, 'utf8');
  const lead = html.match(LEAD_RE)?.[0];
  if (!lead) {
    console.log('skip', rel);
    continue;
  }
  html = html.replace(LEAD_RE, '');
  const marker = /<div class="lhi-hero-deferred-block">/i;
  if (!marker.test(html)) {
    console.log('skip no deferred', rel);
    continue;
  }
  html = html.replace(marker, `${lead}\n<div class="lhi-hero-deferred-block">`);
  writeFileSync(path, html, 'utf8');
  console.log('reordered', rel);
}
