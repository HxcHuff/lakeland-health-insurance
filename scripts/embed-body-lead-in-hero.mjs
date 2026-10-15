#!/usr/bin/env node
/**
 * Move body-level section.lhi-lead-hero into the primary hero column (after H1 + first lede p)
 * so mobile flex/order matches /medicare/ stack without display:contents on hero.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

function listHtmlFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'search-engine-from-zip' || name === 'blog') continue;
      listHtmlFiles(full, out);
    } else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

const leadRe =
  /<section class="lhi-lead-hero"[\s\S]*?<\/section>\s*(?=\s*<(?:main|section|footer))/i;

function transform(html) {
  if (html.includes('class="blog-post"') || html.includes('blog-post ')) return null;
  if (!html.includes('section class="hero"') || !html.includes('class="lhi-lead-hero"')) return null;
  const heroBlock = html.match(/<section class="hero"[^>]*>([\s\S]*?)<\/section>/i);
  if (heroBlock && heroBlock[1].includes('class="lhi-lead-hero"')) return null;

  const leadMatch = html.match(leadRe);
  if (!leadMatch) return null;
  const leadSection = leadMatch[0].trim();
  let next = html.replace(leadRe, '');

  const heroColRe =
    /(<section class="hero"[\s\S]*?<div class="(?:container )?hero-grid">\s*<div>\s*)([\s\S]*?)(\s*<\/div>)/i;
  const hm = next.match(heroColRe);
  if (!hm) return null;

  const [, colOpen, colInner, colClose] = hm;
  const h1m = colInner.match(/<h1[\s\S]*?<\/h1>/i);
  if (!h1m) return null;
  const afterH1 = colInner.slice(h1m.index + h1m[0].length);
  const pm = afterH1.match(/^\s*(<p[\s\S]*?<\/p>)/i);
  const insertAt = h1m.index + h1m[0].length + (pm ? pm.index + pm[0].length : 0);
  const newInner = `${colInner.slice(0, insertAt)}\n${leadSection}\n${colInner.slice(insertAt)}`;
  next = next.replace(heroColRe, `${colOpen}${newInner}${colClose}`);
  return next === html ? null : next;
}

let n = 0;
for (const file of listHtmlFiles(ROOT)) {
  const html = fs.readFileSync(file, 'utf8');
  const out = transform(html);
  if (out) {
    fs.writeFileSync(file, out);
    n += 1;
    console.log('embedded', path.relative(ROOT, file));
  }
}
console.log('done', n);
