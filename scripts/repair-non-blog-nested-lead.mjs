#!/usr/bin/env node
/** Move lhi-lead-hero out of lhi-hero-lede-block when nested (migration artifact). */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATEGORY_B, CATEGORY_C } from './non-blog-sitewide-routes.mjs';

const ROOT = join(import.meta.dirname, '..');

function repair(html) {
  const re =
    /<div class="lhi-hero-lede-block">\s*(?:<div>\s*)?([\s\S]*?)<\/div>\s*(<section class="lhi-lead-hero[\s\S]*?<\/section>)/i;
  if (!re.test(html)) {
    const re2 =
      /<div class="lhi-hero-lede-block">\s*([\s\S]*?)\s*(<section class="lhi-lead-hero[\s\S]*?<\/section>)/i;
    return html.replace(re2, (full, inner, lead) => {
      if (inner.includes('<section class="lhi-lead-hero')) return full;
      const cleaned = inner
        .replace(/\sclass="lead"/gi, '')
        .replace(/class="lhi-hero-lede"\s+class="lead"/i, 'class="lhi-hero-lede lead"')
        .trim();
      return `<div class="lhi-hero-lede-block">\n${cleaned}\n</div>\n${lead}`;
    });
  }
  return html.replace(re, (full, inner, lead) => {
    const cleaned = inner
      .replace(/\sclass="lead"/gi, '')
      .replace(/class="lhi-hero-lede"\s+class="lead"/i, 'class="lhi-hero-lede lead"')
      .trim();
    return `<div class="lhi-hero-lede-block">\n${cleaned}\n</div>\n${lead}`;
  });
}

for (const rel of [...CATEGORY_B, ...CATEGORY_C]) {
  const path = join(ROOT, rel);
  const orig = readFileSync(path, 'utf8');
  const next = repair(orig);
  if (next !== orig) {
    writeFileSync(path, next, 'utf8');
    console.log('repaired', rel);
  }
}
