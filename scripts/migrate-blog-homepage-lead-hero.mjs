#!/usr/bin/env node
/**
 * PR B: migrate blog posts to homepage gray-shell lead hero (lhi-hero-shell + section.hero grid).
 * Structural HTML only — no copy changes.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const BLOG_DIR = join(ROOT, 'blog');
const VERSION = '20261016-sitewide-b2';
const TAIL_MARKER = 'data-lhi-lead-hero-tail';

const HERO_SECTION_RE =
  /<section\b[^>]*class="[^"]*\b(?:article-header|blog-header|article-hero|guide-hero|aca-guide-hero|hero)\b[^"]*"[^>]*>/i;
const LEAD_SECTION_RE = /<section class="lhi-lead-hero[^"]*"[\s\S]*?<\/section>/i;

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

function findHeroBounds(html) {
  const m = html.match(HERO_SECTION_RE);
  if (!m || m.index == null) return null;
  const start = m.index;
  const end = sectionEndFrom(html, start);
  if (end == null) return null;
  return { start, end, openTag: m[0], sectionHtml: html.slice(start, end) };
}

function extractLead(html) {
  const m = html.match(LEAD_SECTION_RE);
  if (!m || m.index == null) return { html, lead: null };
  const lead = m[0].trim();
  let leadHtml = lead;
  if (!leadHtml.includes('lhi-hero-grid-lead')) {
    leadHtml = leadHtml.replace(
      /class="lhi-lead-hero"/,
      'class="lhi-lead-hero lhi-hero-grid-lead"'
    );
  }
  return {
    html: html.slice(0, m.index) + html.slice(m.index + m[0].length),
    lead: leadHtml
  };
}

function stripSectionWrapper(sectionHtml, openTag) {
  const innerStart = openTag.length;
  let inner = sectionHtml.slice(innerStart, sectionHtml.length - '</section>'.length).trim();
  const containerRe =
    /^<div class="(?:container|blog-container)(?:\s[^"]*)?"[^>]*>([\s\S]*)<\/div>\s*$/i;
  const cm = inner.match(containerRe);
  if (cm) inner = cm[1].trim();
  const gridRe =
    /^<div class="(?:article-header-content|hero-content)(?:\s[^"]*)?"[^>]*>([\s\S]*)<\/div>\s*$/i;
  const gm = inner.match(gridRe);
  if (gm) inner = gm[1].trim();
  return inner;
}

function findH1Bounds(inner) {
  const m = inner.match(/<h1\b[\s\S]*?<\/h1>/i);
  if (!m || m.index == null) return null;
  return { start: m.index, end: m.index + m[0].length, html: m[0] };
}

function findLedeEnd(inner, afterH1) {
  let pos = afterH1;
  const tail = () => inner.slice(pos);

  const meta = tail().match(/^\s*(<div class="article-meta"[\s\S]*?<\/div>)/i);
  if (meta) pos += meta.index + meta[0].length;

  const keyAnswer = tail().match(/^\s*(<section class="key-answer"[\s\S]*?<\/section>)/i);
  if (keyAnswer) return pos + keyAnswer.index + keyAnswer[0].length;

  const ledeP =
    tail().match(/^\s*(<p class="[^"]*\b(?:lhi-hero-lede|article-intro|hero-lead|lead|hero-direct-answer)\b[^"]*"[\s\S]*?<\/p>)/i) ||
    tail().match(/^\s*(<p class="lead"[\s\S]*?<\/p>)/i) ||
    tail().match(/^\s*(<p class="lede"[\s\S]*?<\/p>)/i) ||
    tail().match(/^\s*(<p[\s\S]*?<\/p>)/i);
  if (ledeP) return pos + ledeP.index + ledeP[0].length;
  return pos;
}

function markLedeParagraph(pHtml) {
  if (/\blhi-hero-lede\b/.test(pHtml)) return pHtml;
  if (/^<p class="/i.test(pHtml)) {
    return pHtml.replace(/^<p class="/i, '<p class="lhi-hero-lede ');
  }
  return pHtml.replace(/^<p\b/i, '<p class="lhi-hero-lede"');
}

function splitHeroInner(inner) {
  const h1 = findH1Bounds(inner);
  if (!h1) return null;

  const beforeH1 = inner.slice(0, h1.start).trim();
  const ledeEnd = findLedeEnd(inner, h1.end);
  const ledeChunk = inner.slice(0, ledeEnd).trim();
  let deferred = inner.slice(ledeEnd).trim();

  let ledeBlockInner = ledeChunk;
  const ledePM = ledeBlockInner.match(/<p class="lead"[\s\S]*?<\/p>/i);
  if (ledePM) {
    ledeBlockInner = ledeBlockInner.replace(ledePM[0], markLedeParagraph(ledePM[0]));
  } else {
    const firstP = ledeBlockInner.match(/<p[\s\S]*?<\/p>/i);
    if (firstP && firstP.index != null && firstP.index > h1.start - 5) {
      ledeBlockInner = ledeBlockInner.replace(firstP[0], markLedeParagraph(firstP[0]));
    }
  }

  return {
    ledeBlock: `<div class="lhi-hero-lede-block">${ledeBlockInner}</div>`,
    deferred: deferred ? `<div class="lhi-hero-deferred-block">${deferred}</div>` : ''
  };
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

function ensureBodyClass(html) {
  if (!/\blhi-page-hero\b/.test(html)) {
    html = html.replace(/<body(\s[^>]*)?>/i, (m, attrs = '') => {
      if (/class="/i.test(attrs)) {
        return m.replace(/class="([^"]*)"/, (_, c) =>
          c.includes('lhi-page-hero') ? m : `class="${c} lhi-page-hero"`
        );
      }
      return `<body class="lhi-page-hero"${attrs}>`;
    });
  }
  return html;
}

function bumpAssetVersions(html) {
  html = html.replace(/\/css\/lead-hero\.css\?v=[^"']+/g, `/css/lead-hero.css?v=${VERSION}`);
  html = html.replace(/\/js\/lead-hero\.js\?v=[^"']+/g, `/js/lead-hero.js?v=${VERSION}`);
  html = html.replace(/\/css\/blog-unified\.css\?v=[^"']+/g, `/css/blog-unified.css?v=${VERSION}`);
  if (!html.includes('lead-hero.css')) {
    const ins =
      `\n  <link rel="stylesheet" href="/css/lead-hero.css?v=${VERSION}">\n`;
    html = html.replace('</head>', `${ins}</head>`);
  }
  if (!html.includes('lead-hero.js')) {
    const ins = `\n  <script src="/js/lead-hero.js?v=${VERSION}" defer></script>\n`;
    html = html.replace('</body>', `${ins}</body>`);
  }
  return html;
}

function ensureTailLink(html) {
  if (!html.includes(TAIL_MARKER) && html.includes('lhi-hero-shell')) {
    const tail = `\n  <link rel="stylesheet" href="/css/lead-hero.css?v=${VERSION}" ${TAIL_MARKER}>\n`;
    html = html.replace('</head>', `${tail}</head>`);
  }
  return html;
}

function migrateHtml(html) {
  if (html.includes('lhi-hero-shell')) return { html, changed: false, reason: 'already-shell' };
  if (!html.includes('lhi-lead-hero')) return { html, changed: false, reason: 'no-lead' };

  let working = html;
  const { html: withoutLead, lead } = extractLead(working);
  if (!lead) return { html, changed: false, reason: 'no-lead-block' };
  working = withoutLead;

  const hero = findHeroBounds(working);
  if (!hero) return { html, changed: false, reason: 'no-hero' };

  const inner = stripSectionWrapper(hero.sectionHtml, hero.openTag);
  const split = splitHeroInner(inner);
  if (!split) return { html, changed: false, reason: 'no-h1' };

  const shell = buildShell(lead, split.ledeBlock, split.deferred);
  working = working.slice(0, hero.start) + shell + working.slice(hero.end);

  working = ensureBodyClass(working);
  working = bumpAssetVersions(working);
  working = ensureTailLink(working);

  return { html: working, changed: working !== html, reason: 'migrated' };
}

let updated = 0;
const skipped = {};

for (const name of readdirSync(BLOG_DIR)) {
  if (!name.endsWith('.html')) continue;
  const file = join(BLOG_DIR, name);
  const original = readFileSync(file, 'utf8');
  const { html, changed, reason } = migrateHtml(original);
  skipped[reason] = (skipped[reason] || 0) + 1;
  if (changed) {
    writeFileSync(file, html);
    updated += 1;
    console.log('migrated', name);
  }
}

console.log(`Done. ${updated} blog files migrated.`, skipped);
