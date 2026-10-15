#!/usr/bin/env node
/** Move long Direct answer paragraph from lede into lhi-hero-deferred-block (HTML preserved for AEO). */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'search-engine-from-zip') continue;
      walk(full, out);
    } else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

const directRe =
  /(<p class="lhi-hero-lede"[^>]*>\s*<strong>Direct answer:<\/strong>[\s\S]*?<\/p>)/i;

let n = 0;
for (const file of walk(ROOT)) {
  if (file.includes('/blog/')) continue;
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('lhi-hero-lede-block') || !directRe.test(html)) continue;
  const ledeBlock = html.match(/<div class="lhi-hero-lede-block">[\s\S]*?<\/div>\s*(?=<section class="lhi-lead-hero"|<div class="lhi-hero-deferred-block")/i);
  if (ledeBlock && !/<strong>Direct answer:<\/strong>/.test(ledeBlock[0].split('lhi-lead-hero')[0] || '')) continue;

  html = html.replace(
    /(<div class="lhi-hero-lede-block">[\s\S]*?)(<p class="lhi-hero-lede"[^>]*>\s*<strong>Direct answer:<\/strong>[\s\S]*?<\/p>)/i,
    (_, before, directP) => {
      const shortLede =
        '<p class="lhi-hero-lede">Licensed local help—share your doctors, prescriptions, and ZIP for a plan comparison. Full contact details are below the form.</p>';
      return `${before}${shortLede}\n<div class="lhi-hero-deferred-block visually-deferred-mobile">${directP}`;
    }
  );

  if (!html.includes('visually-deferred-mobile')) continue;

  if (!html.includes('</div></div>\n<section class="lhi-lead-hero"')) {
    html = html.replace(
      /(<div class="lhi-hero-deferred-block visually-deferred-mobile">[\s\S]*?<\/p>)(\s*<\/div>\s*<section class="lhi-lead-hero")/i,
      '$1</div>$2'
    );
  }

  fs.writeFileSync(file, html);
  n += 1;
  console.log('split direct answer', path.relative(ROOT, file));
}
console.log('done', n);
