#!/usr/bin/env node
/** Add meta-description hero lede when lede-block has no .lhi-hero-lede (column balance). */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BLOG = join(import.meta.dirname, '..', 'blog');

for (const name of readdirSync(BLOG)) {
  if (!name.endsWith('.html') || name === 'index.html') continue;
  const path = join(BLOG, name);
  let html = readFileSync(path, 'utf8');
  if (!html.includes('lhi-hero-lede-block')) continue;
  const blockRe = /<div class="lhi-hero-lede-block">([\s\S]*?)<\/div>\s*\n<section class="lhi-lead-hero/;
  const m = html.match(blockRe);
  if (!m || /class="lhi-hero-lede"/.test(m[1])) continue;
  const descM = html.match(/<meta name="description" content="([^"]+)"/);
  if (!descM) continue;
  const text = descM[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  const lede = `<p class="lhi-hero-lede">${text}</p>`;
  const inner = m[1].replace(/(<h1>[\s\S]*?<\/h1>)/, `$1\n${lede}`);
  html = html.replace(blockRe, `<div class="lhi-hero-lede-block">${inner}</div>\n<section class="lhi-lead-hero`);
  writeFileSync(path, html);
  console.log(`meta-lede ${name}`);
}
