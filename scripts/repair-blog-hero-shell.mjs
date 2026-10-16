#!/usr/bin/env node
/** Fix nested lead-in-lede blog shells and ensure body.blog-post on migrated posts. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BLOG_DIR = join(import.meta.dirname, '..', 'blog');
const LEAD_RE = /<section class="lhi-lead-hero[\s\S]*?<\/section>/i;

function findDivEnd(html, startIndex) {
  const tokenRe = /<div\b|<\/div>/gi;
  tokenRe.lastIndex = startIndex;
  let depth = 0;
  let match;
  while ((match = tokenRe.exec(html))) {
    if (/^<div\b/i.test(match[0])) depth += 1;
    else {
      depth -= 1;
      if (depth === 0) return match.index + match[0].length;
    }
  }
  return null;
}

function buildShell(leadSection, ledeBlock, deferredBlock) {
  const deferredLine = deferredBlock ? `\n${deferredBlock}` : '';
  return (
    `<div class="lhi-hero-shell">\n` +
    `<section class="hero">\n` +
    `  <div class="container hero-grid">\n` +
    `${ledeBlock}\n` +
    `${leadSection}\n` +
    `${deferredLine}\n` +
    `  </div>\n` +
    `</section>\n` +
    `</div>`
  );
}

function ensureBlogPostClass(html, isIndex) {
  return html.replace(/<body(\s[^>]*)>/i, (full, attrs = '') => {
    const classes = new Set();
    const cm = attrs.match(/class="([^"]*)"/);
    if (cm) cm[1].split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
    classes.add('lhi-page-hero');
    if (!isIndex) classes.add('blog-post');
    if (isIndex) classes.add('blog-index-page');
    const rest = attrs.replace(/\s*class="[^"]*"/, '');
    return `<body class="${[...classes].join(' ')}"${rest}>`;
  });
}

function repairShell(html) {
  const shellStart = html.indexOf('<div class="lhi-hero-shell">');
  if (shellStart < 0) return { html, changed: false };

  const shellEnd = findDivEnd(html, shellStart);
  if (shellEnd == null) return { html, changed: false };

  const shellHtml = html.slice(shellStart, shellEnd);
  const leadMatch = shellHtml.match(LEAD_RE);
  if (!leadMatch) return { html, changed: false };
  const lead = leadMatch[0].trim();

  const h1Match = shellHtml.match(/<h1\b[\s\S]*?<\/h1>/i);
  if (!h1Match) return { html, changed: false };

  let deferredParts = [];
  const deferredBlockMatch = shellHtml.match(/<div class="lhi-hero-deferred-block"[\s\S]*?<\/div>/i);
  if (deferredBlockMatch) {
    const inner = deferredBlockMatch[0]
      .replace(/^<div class="lhi-hero-deferred-block">/i, '')
      .replace(/<\/div>\s*$/i, '')
      .trim();
    if (inner) deferredParts.push(inner);
  }
  for (const re of [
    /<p class="subtitle"[\s\S]*?<\/p>/gi,
    /<div class="article-date"[\s\S]*?<\/div>/gi,
    /<section class="key-answer"[\s\S]*?<\/section>/gi
  ]) {
    for (const m of shellHtml.matchAll(re)) {
      if (!lead.includes(m[0]) && !deferredParts.includes(m[0])) deferredParts.push(m[0]);
    }
  }

  let ledeTail = shellHtml.slice(h1Match.index + h1Match[0].length);
  const leadIdx = ledeTail.indexOf(lead.slice(0, 40));
  if (leadIdx >= 0) ledeTail = ledeTail.slice(0, leadIdx);
  ledeTail = ledeTail.replace(/<section class="lhi-lead-hero[\s\S]*/i, '');
  ledeTail = ledeTail.replace(/<div class="lhi-hero-deferred-block"[\s\S]*/i, '');
  ledeTail = ledeTail.replace(/<\/?div[^>]*>/gi, ' ').trim();
  ledeTail = ledeTail.replace(/\s+/g, ' ').trim();

  let ledeInner = h1Match[0];
  if (ledeTail && !ledeTail.includes('lhi-lead-hero')) {
    const metaMatch = shellHtml.match(/<div class="article-meta"[\s\S]*?(?=<section class="lhi-lead-hero)/i);
    if (metaMatch) {
      ledeInner += `\n${metaMatch[0].replace(/<section class="lhi-lead-hero[\s\S]*/i, '').trim()}`;
    } else if (/<p class="[^"]*\blhi-hero-lede\b/i.test(ledeTail)) {
      const pMatch = shellHtml.match(/<p class="[^"]*\blhi-hero-lede\b[^"]*"[\s\S]*?<\/p>/i);
      if (pMatch) ledeInner += `\n${pMatch[0]}`;
    }
  }

  const ledeBlock = `<div class="lhi-hero-lede-block">${ledeInner.trim()}</div>`;
  const deferredBlock =
    deferredParts.length > 0
      ? `<div class="lhi-hero-deferred-block">${deferredParts.join('\n')}</div>`
      : '';

  const newShell = buildShell(lead, ledeBlock, deferredBlock);
  const next = html.slice(0, shellStart) + newShell + html.slice(shellEnd);
  return { html: next, changed: next !== html };
}

let repaired = 0;
for (const name of readdirSync(BLOG_DIR)) {
  if (!name.endsWith('.html')) continue;
  const path = join(BLOG_DIR, name);
  let html = readFileSync(path, 'utf8');
  const isIndex = name === 'index.html';
  const before = html;
  const { html: repairedHtml, changed } = repairShell(html);
  html = repairedHtml;
  html = ensureBlogPostClass(html, isIndex);
  if (html !== before) {
    writeFileSync(path, html);
    repaired += 1;
    console.log('repaired', name);
  }
}

console.log(`Done. ${repaired} blog files repaired.`);
