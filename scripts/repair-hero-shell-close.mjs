#!/usr/bin/env node
/** Ensure .lhi-hero-shell closes before <main>. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BLOG = join(import.meta.dirname, '..', 'blog');

const INSERT = '\n  </div>\n</section>\n</div>\n';

function needsCloseBeforeMain(html) {
  const shellIdx = html.indexOf('<div class="lhi-hero-shell">');
  const mainIdx = html.indexOf('<main class="container">');
  if (shellIdx < 0 || mainIdx < 0 || mainIdx < shellIdx) return false;
  const between = html.slice(shellIdx, mainIdx);
  const closes = (between.match(/<\/div>\s*\n<\/section>\s*\n<\/div>/g) || []).length;
  return closes < 1;
}

let n = 0;
for (const name of readdirSync(BLOG).filter((f) => f.endsWith('.html'))) {
  const path = join(BLOG, name);
  let html = readFileSync(path, 'utf8');
  if (!needsCloseBeforeMain(html)) continue;
  const next = html.replace(/(\s*)(<main class="container">)/, `${INSERT}$1$2`);
  if (next !== html) {
    writeFileSync(path, next);
    n += 1;
  }
}
console.log(`inserted hero shell close before main in ${n} files`);
