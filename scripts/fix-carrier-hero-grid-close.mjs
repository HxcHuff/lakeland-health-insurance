#!/usr/bin/env node
/** Undo erroneous extra </div> that closed .hero-grid before grid-lead on carrier pages. */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const carriersDir = join(ROOT, 'carriers');

function carrierFiles() {
  const out = [];
  for (const name of readdirSync(carriersDir)) {
    const full = join(carriersDir, name, 'index.html');
    try {
      if (statSync(full).isFile()) out.push(full);
    } catch {
      /* skip */
    }
  }
  return out;
}

const broken =
  /(<div class="container hero-grid"><div class="lhi-hero-lede-block">[\s\S]*?<\/p><\/div>)<\/div>(\s*\n\s*<section class="lhi-lead-hero lhi-hero-grid-lead")/g;

let n = 0;
for (const file of carrierFiles()) {
  let html = readFileSync(file, 'utf8');
  const next = html.replace(broken, '$1$2');
  if (next !== html) {
    writeFileSync(file, next);
    n += 1;
    console.log('fixed', relative(ROOT, file).replace(/\\/g, '/'));
  }
}
console.log('total', n);
