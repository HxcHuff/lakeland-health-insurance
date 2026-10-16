#!/usr/bin/env node
/** Safe hero dedupe — see inline repair in validate or run from repo root. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BLOG = join(import.meta.dirname, '..', 'blog');

function normPrefix(text) {
  return String(text)
    .replace(/\s+/g, ' ')
    .replace(/^direct answer:\s*/i, '')
    .replace(/^\*\*direct answer:\*\*\s*/i, '')
    .trim()
    .slice(0, 40)
    .toLowerCase();
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripDirectAnswerLabel(html) {
  return html
    .replace(/<strong>Direct answer:<\/strong>\s*/gi, '')
    .replace(/^Direct answer:\s*/i, '');
}

function repairInner(inner) {
  let s = inner;
  s = s.replace(
    /<div class="container (?:page-crumb|crumb)">([\s\S]*?)<\/div>/gi,
    '<p class="hero-breadcrumb" aria-label="Breadcrumb">$1</p>'
  );
  const h1M = s.match(/<h1[\s\S]*?<\/h1>/i);
  const h1 = h1M ? h1M[0] : '';
  s = s.replace(/<h1[\s\S]*?<\/h1>/i, '');
  const bcM = s.match(/<p class="hero-breadcrumb"[\s\S]*?<\/p>/i);
  const bc = bcM ? bcM[0] : '';
  if (bc) s = s.replace(/<p class="hero-breadcrumb"[\s\S]*?<\/p>/i, '');
  const ledes = [];
  let lr = '';
  for (const m of s.matchAll(/<p class="([^"]*lhi-hero-lede[^"]*)"[^>]*>([\s\S]*?)<\/p>/gi)) {
    if (/\blast-reviewed\b/.test(m[1])) {
      if (!lr) lr = `<p class="lhi-hero-lede last-reviewed">${m[2].trim()}</p>`;
    } else ledes.push(stripDirectAnswerLabel(m[2].trim()));
  }
  const seen = new Set();
  let pl = '';
  for (const body of ledes) {
    const p = normPrefix(stripTags(body));
    if (!p || seen.has(p)) continue;
    seen.add(p);
    pl = `<p class="lhi-hero-lede">${body}</p>`;
    break;
  }
  return { html: [bc, h1, pl, lr].filter(Boolean).join('\n'), seen };
}

for (const name of readdirSync(BLOG)) {
  if (!name.endsWith('.html') || name === 'index.html') continue;
  const path = join(BLOG, name);
  let html = readFileSync(path, 'utf8');
  if (!html.includes('lhi-hero-lede-block')) continue;
  const re = /<div class="lhi-hero-lede-block">([\s\S]*?)<\/div>\s*\n<section class="lhi-lead-hero/;
  const m = html.match(re);
  if (!m) continue;
  const { html: newInner, seen } = repairInner(m[1]);
  html = html.replace(
    re,
    `<div class="lhi-hero-lede-block">${newInner}\n</div>\n<section class="lhi-lead-hero`
  );
  html = html.replace(
    /<div class="lhi-hero-deferred-block">([\s\S]*?)<\/div>\s*\n(?:  )?<\/section>/,
    (full, def) => {
      let d = def;
      for (const p of [...d.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]) {
        const pref = normPrefix(stripTags(p[1]));
        if (pref && seen.has(pref)) d = d.replace(p[0], '');
      }
      d = d.replace(/<section class="key-answer">[\s\S]*?<\/section>/gi, '');
      return `<div class="lhi-hero-deferred-block">${d.trim()}\n  </div>\n</section>`;
    }
  );
  writeFileSync(path, html);
}
