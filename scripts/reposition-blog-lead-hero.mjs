#!/usr/bin/env node
/**
 * Move blog lhi-lead-hero blocks below article hero/header and first key-answer or alert.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const BLOG_DIR = join(ROOT, 'blog');

const LEAD_RE = /<section class="lhi-lead-hero"[\s\S]*?<\/section>\s*/i;

function sectionEndByClass(html, className) {
  const start = html.search(new RegExp(`<section\\s+class="${className}"`, 'i'));
  if (start < 0) return null;
  return sectionEndFrom(html, start);
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

function firstSectionEndAfter(html, startIndex, className) {
  const openRe = new RegExp(`<section\\s+class="[^"]*\\b${className}\\b[^"]*"`, 'gi');
  openRe.lastIndex = startIndex;
  const open = openRe.exec(html);
  if (!open) return null;
  return sectionEndFrom(html, open.index);
}

function extractLead(html) {
  const match = html.match(LEAD_RE);
  if (!match) return { html, block: null };
  return {
    html: html.replace(match[0], ''),
    block: match[0].trim()
  };
}

function findInsertEnd(html) {
  const articleHeroEnd = sectionEndByClass(html, 'article-hero');
  if (articleHeroEnd != null) return articleHeroEnd;

  const articleHeaderEnd = sectionEndByClass(html, 'article-header');
  if (articleHeaderEnd != null) {
    const keyEnd = firstSectionEndAfter(html, articleHeaderEnd, 'key-answer');
    return keyEnd ?? articleHeaderEnd;
  }

  const h1 = html.match(/<h1\b[\s\S]*?<\/h1>/i);
  if (h1) {
    const afterH1 = h1.index + h1[0].length;
    const keyEnd = firstSectionEndAfter(html, afterH1, 'key-answer');
    if (keyEnd != null) return keyEnd;
    const alertEnd = firstSectionEndAfter(html, afterH1, 'lhi-alert-notice');
    if (alertEnd != null) return alertEnd;
    return afterH1;
  }

  const blogHeaderEnd = sectionEndByClass(html, 'blog-header');
  if (blogHeaderEnd != null) return blogHeaderEnd;

  return null;
}

function normalizeBlogLead(html) {
  const { html: stripped, block } = extractLead(html);
  if (!block) return { html, moved: false };

  const insertEnd = findInsertEnd(stripped);
  if (insertEnd == null) return { html, moved: false };

  const next =
    stripped.slice(0, insertEnd) + `\n\n${block}\n\n` + stripped.slice(insertEnd);
  const originalLeadIndex = html.search(/<section class="lhi-lead-hero"/i);
  const moved = originalLeadIndex !== insertEnd;
  return { html: next, moved };
}

let moved = 0;
for (const name of readdirSync(BLOG_DIR)) {
  if (!name.endsWith('.html') || name === 'index.html') continue;
  const file = join(BLOG_DIR, name);
  const original = readFileSync(file, 'utf8');
  const { html, moved: didMove } = normalizeBlogLead(original);
  if (html !== original) {
    writeFileSync(file, html);
    if (didMove) moved += 1;
    console.log('updated', name);
  }
}

console.log(`Done. ${moved} blog pages repositioned.`);
