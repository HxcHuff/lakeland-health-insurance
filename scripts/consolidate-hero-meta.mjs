#!/usr/bin/env node
/** Move meta-only deferred blocks into lede block to remove phantom grid gap. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BLOG = join(import.meta.dirname, '..', 'blog');

function metaOnlyInner(inner) {
  const t = inner.trim();
  if (/^<p class="meta">[\s\S]*<\/p>$/i.test(t)) return t;
  if (/^<div class="meta">[\s\S]*<\/div>$/i.test(t)) return t;
  if (/^<p class="meta">[\s\S]*<\/p>\s*$/i.test(t)) return t.trim();
  return null;
}

let n = 0;
for (const name of readdirSync(BLOG).filter((f) => f.endsWith('.html') && f !== 'index.html')) {
  const path = join(BLOG, name);
  let html = readFileSync(path, 'utf8');
  const m = html.match(
    /<div class="lhi-hero-deferred-block">([\s\S]*?)<\/div>\s*\n\s*<\/div>\s*\n<\/section>\s*\n<\/div>/
  );
  if (!m) continue;
  const metaBlock = metaOnlyInner(m[1]);
  if (!metaBlock) continue;
  const ledeClose =
    /(<div class="lhi-hero-lede-block">[\s\S]*?)(<\/div>\s*\n<section class="lhi-lead-hero)/;
  if (!ledeClose.test(html)) continue;
  html = html.replace(ledeClose, `$1\n${metaBlock}\n$2`);
  html = html.replace(
    /<div class="lhi-hero-deferred-block">[\s\S]*?<\/div>\s*\n(\s*<\/div>\s*\n<\/section>\s*\n<\/div>)/,
    '$1'
  );
  writeFileSync(path, html);
  n += 1;
}
console.log(`consolidated meta-only deferred in ${n} files`);
