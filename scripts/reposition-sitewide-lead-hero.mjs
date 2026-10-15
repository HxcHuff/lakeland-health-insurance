#!/usr/bin/env node
/**
 * Sitewide lead hero: place form after page H1/hero, wrap hero + lead for two-column desktop layout.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'search-engine-from-zip', '.ai-worker-local', 'output']);
const LEAD_RE = /<section class="lhi-lead-hero"[\s\S]*?<\/section>\s*/i;
const HERO_SECTION_OPEN =
  /<section\b[^>]*class="[^"]*\b(?:hero|home-hero|answer-hero|article-hero|article-header)\b[^"]*"[^>]*>/i;

function walkHtml(dir = ROOT, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

function sectionEndFrom(html, startIndex) {
  const tokenRe = /<section\b|<\/section>/gi;
  tokenRe.lastIndex = startIndex;
  let depth = 0;
  let match;
  while ((match = tokenRe.exec(html))) {
    if (/^<section\b/i.test(match[0])) depth += 1;
    else {
      depth -= 1;
      if (depth === 0) return match.index + match[0].length;
    }
  }
  return null;
}

function extractLead(html) {
  const match = html.match(LEAD_RE);
  if (!match) return { html, block: null, start: -1 };
  const start = match.index;
  return {
    html: html.slice(0, start) + html.slice(start + match[0].length),
    block: match[0].trim(),
    start
  };
}

function firstH1Index(html) {
  return html.search(/<h1\b/i);
}

function findHeroSectionBounds(html) {
  const mainMatch = html.match(/<main\b[^>]*>/i);
  const searchFrom = mainMatch ? mainMatch.index + mainMatch[0].length : 0;
  const slice = html.slice(searchFrom);
  const open = slice.match(HERO_SECTION_OPEN);
  if (!open) return null;
  const absStart = searchFrom + open.index;
  const end = sectionEndFrom(html, absStart);
  if (end == null) return null;
  return { start: absStart, end };
}

function hasHeroShell(html) {
  return html.includes('class="lhi-hero-shell"');
}

function ensureBodyClass(html) {
  if (!html.includes('lhi-page-hero')) {
    html = html.replace(/<body(\s[^>]*)?>/i, (m, attrs = '') => {
      if (/class="/i.test(attrs)) {
        return m.replace(/class="([^"]*)"/, (_, classes) =>
          classes.includes('lhi-page-hero') ? m : `class="${classes} lhi-page-hero"`
        );
      }
      return `<body class="lhi-page-hero"${attrs}>`;
    });
  }
  return html;
}

function normalizePage(html) {
  const h1 = firstH1Index(html);
  if (h1 < 0) return { html, changed: false };

  const leadIdx = html.search(/class="lhi-lead-hero"/i);
  if (leadIdx < 0) return { html, changed: false };

  let next = html;
  let changed = false;

  const { html: stripped, block, start: oldLeadStart } = extractLead(next);
  if (!block) return { html, changed: false };

  if (oldLeadStart >= 0 && oldLeadStart < h1) {
    const hero = findHeroSectionBounds(stripped);
    const insertAt = hero?.end ?? h1;
    next = stripped.slice(0, insertAt) + `\n\n${block}\n\n` + stripped.slice(insertAt);
    changed = true;
  } else {
    next = html;
  }

  if (hasHeroShell(next)) {
    return { html: ensureBodyClass(next), changed: changed || !html.includes('lhi-page-hero') };
  }

  const hero = findHeroSectionBounds(next);
  const newLeadIdx = next.search(/class="lhi-lead-hero"/i);
  if (!hero || newLeadIdx < 0) return { html: next, changed };

  const leadMatch = next.match(LEAD_RE);
  if (!leadMatch || leadMatch.index == null) return { html: next, changed };
  const leadStart = leadMatch.index;
  const leadEnd = leadStart + leadMatch[0].length;

  if (leadStart !== hero.end && Math.abs(leadStart - hero.end) > 8) {
    return { html: ensureBodyClass(next), changed };
  }

  const shell =
    `<div class="lhi-hero-shell">\n` +
    `${next.slice(hero.start, hero.end).trim()}\n\n` +
    `${next.slice(leadStart, leadEnd).trim()}\n` +
    `</div>`;

  next = next.slice(0, hero.start) + shell + next.slice(leadEnd);
  next = ensureBodyClass(next);
  changed = true;
  return { html: next, changed };
}

let updated = 0;
let wrapped = 0;
for (const file of walkHtml()) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (rel.startsWith('blog/')) continue;

  const original = readFileSync(file, 'utf8');
  if (!original.includes('class="lhi-lead-hero"')) continue;

  const { html, changed } = normalizePage(original);
  if (html !== original) {
    writeFileSync(file, html);
    updated += 1;
    if (html.includes('lhi-hero-shell') && !original.includes('lhi-hero-shell')) wrapped += 1;
    console.log('updated', rel);
  }
}

console.log(`Done. ${updated} pages updated, ${wrapped} hero shells added.`);
