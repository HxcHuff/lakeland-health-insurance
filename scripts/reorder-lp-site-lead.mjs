#!/usr/bin/env node
/** Move lhi-lead-hero immediately after lhi-hero-lede-block on LP pages; hide legacy lp-lead-card via CSS. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const TARGETS = ['lp/aca/index.html', 'lp/medicare/index.html'];

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
  const marker = '</div>\n<div class="lhi-hero-deferred-block">';
  const alt = '</div>\n\n<div class="lhi-hero-deferred-block">';
  if (html.includes(marker)) {
    html = html.replace(marker, `</div>\n${lead}\n<div class="lhi-hero-deferred-block">`);
  } else if (html.includes(alt)) {
    html = html.replace(alt, `</div>\n${lead}\n<div class="lhi-hero-deferred-block">`);
  } else {
    const ledeEnd = html.indexOf('<div class="lhi-hero-deferred-block">');
    if (ledeEnd < 0) {
      console.log('skip no deferred', rel);
      continue;
    }
    html = `${html.slice(0, ledeEnd)}${lead}\n${html.slice(ledeEnd)}`;
  }
  writeFileSync(path, html, 'utf8');
  console.log('reordered', rel);
}
