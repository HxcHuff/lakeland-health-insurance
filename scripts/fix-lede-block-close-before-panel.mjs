#!/usr/bin/env node
/** Close .lhi-hero-lede-block before sibling .hero-panel / .lhi-hero-grid-lead when renest left it open. */
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

const needle = /<div class="lhi-hero-lede-block">/;
/** Only city-style lede blocks with an inner wrapper div before hero-panel (not bare h1 carrier lede). */
const fixRe =
  /(<div class="lhi-hero-lede-block"><div>[\s\S]*?<p class="lhi-hero-lede"[^>]*>[\s\S]*?<\/p><\/div>)(\s*\n\s*<div class="hero-panel")/g;

let n = 0;
for (const file of walk()) {
  let html = readFileSync(file, 'utf8');
  if (!needle.test(html)) continue;
  const next = html.replace(fixRe, '$1</div>$2');
  if (next !== html) {
    writeFileSync(file, next);
    n += 1;
    console.log('fixed', relative(ROOT, file).replace(/\\/g, '/'));
  }
}
console.log('total', n);
