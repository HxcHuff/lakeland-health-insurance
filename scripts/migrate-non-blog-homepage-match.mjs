#!/usr/bin/env node
/**
 * Non-blog homepage-match migration: gray lhi-hero-shell + hero-grid lead column.
 * Usage: node scripts/migrate-non-blog-homepage-match.mjs [--dry-run] [--only category-b|category-c] [rel ...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildLeadHeroHtml } from './lib/lead-hero-html.mjs';
import { CATEGORY_B, CATEGORY_C, VERSION, SITE_TEMPLATE_CSS_PIN } from './non-blog-sitewide-routes.mjs';

const ROOT = join(import.meta.dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const onlyFlag = process.argv.find((a) => a.startsWith('--only='));
const only = onlyFlag ? onlyFlag.split('=')[1] : null;
const extraArgs = process.argv.filter((a) => !a.startsWith('-') && a.endsWith('.html'));

const LEAD_RE = /<section class="lhi-lead-hero[^"]*"[\s\S]*?<\/section>/i;
const HERO_OPEN_RE =
  /<section\b[^>]*class="[^"]*\b(?:hero|home-hero|answer-hero|aw-hero|medicare-hero|about-header)\b[^"]*"[^>]*>/i;
const MAIN_HERO_RE = /<main\b[^>]*class="[^"]*\bhero\b[^"]*"[^>]*>/i;

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

function divEndFrom(html, startIndex) {
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = startIndex;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (/^<div\b/i.test(m[0])) depth += 1;
    else if (--depth === 0) return m.index + m[0].length;
  }
  return null;
}

function ensureLeadGridClass(block) {
  if (block.includes('lhi-hero-grid-lead')) return block;
  return block.replace(/class="lhi-lead-hero"/, 'class="lhi-lead-hero lhi-hero-grid-lead"');
}

function markLede(pHtml) {
  if (/\blhi-hero-lede\b/.test(pHtml)) return pHtml;
  if (/^<p class="/i.test(pHtml)) {
    return pHtml.replace(/^<p class="/, '<p class="lhi-hero-lede ');
  }
  return pHtml.replace(/^<p\b/i, '<p class="lhi-hero-lede"');
}

function ensureAssets(html) {
  let next = html;
  const cssPin = `/css/lead-hero.css?v=${VERSION}`;
  const jsPin = `/js/lead-hero.js?v=${VERSION}`;
  const tplPin = `/css/site-template.css?v=${SITE_TEMPLATE_CSS_PIN}`;
  const tplJsPin = `/js/site-template.js?v=${VERSION}`;

  next = next.replace(/\/css\/lead-hero\.css\?v=[^"']+/g, cssPin);
  next = next.replace(/\/js\/lead-hero\.js\?v=[^"']+/g, jsPin);
  if (!next.includes('lead-hero.css')) {
    next = next.replace(
      /<link rel="stylesheet" href="\/css\/fonts.css[^"]*">/,
      (m) => `${m}\n  <link rel="stylesheet" href="${cssPin}">`
    );
  }
  if (!next.includes('lead-hero.js')) {
    next = next.replace('</body>', `  <script src="${jsPin}" defer></script>\n</body>`);
  }
  if (!next.includes('site-template.css') && !next.includes('hub-template-anchor')) {
    next = next.replace('</head>', `  <link rel="stylesheet" href="${tplPin}">\n</head>`);
  } else {
    next = next.replace(/\/css\/site-template\.css\?v=[^"']+/g, tplPin);
  }
  if (next.includes('hub-template-anchor') && !next.includes('site-template.js')) {
    next = next.replace('</body>', `  <script src="${tplJsPin}" defer></script>\n</body>`);
  } else {
    next = next.replace(/\/js\/site-template\.js\?v=[^"']+/g, tplJsPin);
  }
  return next;
}

function ensureBodyClass(html) {
  if (/\blhi-page-hero\b/.test(html)) return html;
  return html.replace(/<body(\s[^>]*)?>/i, (m, attrs = '') => {
    if (/class="/i.test(attrs)) {
      return m.replace(/class="([^"]*)"/, (_, c) => `class="${c} lhi-page-hero"`);
    }
    return `<body class="lhi-page-hero"${attrs}>`;
  });
}

function extractLead(html) {
  const matches = [...html.matchAll(/<section class="lhi-lead-hero[^"]*"[\s\S]*?<\/section>/gi)];
  if (!matches.length) return { html, lead: null };
  const pick =
    matches.find((m) => m[0].includes('site-medicare-lead')) ||
    matches.find((m) => m[0].includes('site-aca-lead')) ||
    matches[matches.length - 1];
  const lead = ensureLeadGridClass(pick[0].trim());
  let next = html;
  for (const m of matches) {
    next = next.replace(m[0], '');
  }
  return { html: next, lead };
}

function mainEndFrom(html, startIndex) {
  const re = /<main\b|<\/main>/gi;
  re.lastIndex = startIndex;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (/^<main\b/i.test(m[0])) depth += 1;
    else if (--depth === 0) return m.index + m[0].length;
  }
  return null;
}

function findHeroBounds(html, searchFrom = 0) {
  const slice = html.slice(searchFrom);
  const open = slice.match(HERO_OPEN_RE);
  if (open && open.index != null) {
    const start = searchFrom + open.index;
    const end = sectionEndFrom(html, start);
    if (end != null) {
      const openTag = html.slice(start, html.indexOf('>', start) + 1);
      return { start, end, openTag, sectionHtml: html.slice(start, end) };
    }
  }
  const mainOpen = slice.match(MAIN_HERO_RE);
  if (mainOpen && mainOpen.index != null) {
    const start = searchFrom + mainOpen.index;
    const end = mainEndFrom(html, start);
    if (end != null) {
      const openTag = html.slice(start, html.indexOf('>', start) + 1);
      return { start, end, openTag, sectionHtml: html.slice(start, end), isMainHero: true };
    }
  }
  return null;
}

function stripOuterContainers(inner) {
  let body = inner.trim();
  for (let i = 0; i < 4; i += 1) {
    const m =
      body.match(/^<div class="(?:container|answer-wrap|hero-grid|hero-content|wrap)(?:\s[^"]*)?"[^>]*>([\s\S]*)<\/div>\s*$/i) ||
      body.match(/^<div class="(?:container|answer-wrap)(?:\s[^"]*)?"[^>]*>([\s\S]*)<\/div>\s*$/i);
    if (!m) break;
    body = m[1].trim();
  }
  return body;
}

function splitLedeDeferred(inner, isAnswer) {
  const h1m = inner.match(/<h1\b[\s\S]*?<\/h1>/i);
  if (!h1m || h1m.index == null) return null;

  const beforeH1 = inner.slice(0, h1m.index).trim();
  const afterH1Start = h1m.index + h1m[0].length;
  const tail = inner.slice(afterH1Start);

  const ledeParts = [beforeH1, h1m[0]].filter(Boolean);
  let deferred = '';
  let pos = 0;
  const tailSlice = () => tail.slice(pos);

  const keyAnswer = tailSlice().match(/^\s*(<div class="answer-snippet"[\s\S]*?<\/div>)/i);
  if (keyAnswer) {
    ledeParts.push(keyAnswer[1]);
    pos += keyAnswer.index + keyAnswer[0].length;
  }

  const ledeP =
    tailSlice().match(/^\s*(<p class="[^"]*\b(?:lhi-hero-lede|lead|hero-lead)\b[^"]*"[\s\S]*?<\/p>)/i) ||
    tailSlice().match(/^\s*(<p class="lead"[\s\S]*?<\/p>)/i) ||
    tailSlice().match(/^\s*(<p[\s\S]*?<\/p>)/i);
  if (ledeP) {
    ledeParts.push(markLede(ledeP[1]));
    pos += ledeP.index + ledeP[0].length;
  }

  deferred = tail.slice(pos).trim();
  deferred = deferred.replace(/<form class="sitelink-lead-form"[\s\S]*?<\/form>\s*/gi, '');

  const ledeBlock = `<div class="lhi-hero-lede-block">\n${ledeParts.join('\n')}\n</div>`;
  const deferredBlock = deferred
    ? `<div class="lhi-hero-deferred-block">\n${deferred}\n</div>`
    : '';

  return { ledeBlock, deferredBlock, isAnswer };
}

function heroMeta(openTag) {
  if (/about-header/i.test(openTag)) {
    return { heroClass: openTag.match(/class="([^"]*)"/i)?.[1] || 'about-header', gridClass: 'container about-hero-grid' };
  }
  if (/answer-hero/i.test(openTag)) {
    return { heroClass: openTag.match(/class="([^"]*)"/i)?.[1] || 'answer-hero', gridClass: 'answer-wrap answer-grid' };
  }
  if (/^<main\b/i.test(openTag) || /\bhero\b/.test(openTag)) {
    return { heroClass: openTag.match(/class="([^"]*)"/i)?.[1] || 'hero', gridClass: 'wrap' };
  }
  return { heroClass: 'hero', gridClass: 'container hero-grid' };
}

function buildShell(heroOpenTag, gridClass, ledeBlock, leadBlock, deferredBlock, isMainHero = false) {
  const heroClass = heroOpenTag.match(/class="([^"]*)"/i)?.[1] || 'hero';
  const isMain = isMainHero || /^<main\b/i.test(heroOpenTag);
  const open = isMain
    ? heroOpenTag.startsWith('<main')
      ? heroOpenTag
      : `<main class="${heroClass}">`
    : heroOpenTag.startsWith('<section')
      ? heroOpenTag
      : `<section class="${heroClass}">`;
  const closeTag = isMain ? '</main>' : '</section>';
  const def = deferredBlock ? `\n${deferredBlock}` : '';
  return (
    `<div class="lhi-hero-shell">\n${open}\n` +
    `  <div class="${gridClass}">\n${ledeBlock}\n${leadBlock}${def}\n` +
    `  </div>\n${closeTag}\n</div>`
  );
}

function removeShellAndHero(html) {
  let next = html;
  const shellIdx = next.indexOf('<div class="lhi-hero-shell">');
  if (shellIdx >= 0) {
    const shellEnd = next.indexOf('</div>', shellIdx);
    let end = shellEnd + '</div>'.length;
    const after = next.slice(shellIdx, end + 2000);
    if (after.includes('</section>')) {
      const secEnd = next.indexOf('</section>', shellIdx);
      if (secEnd >= 0) end = Math.max(end, secEnd + '</section>'.length);
      const secEnd2 = next.indexOf('</div>', end);
      if (secEnd2 >= 0 && next.slice(end, secEnd2 + 6).includes('lhi-lead-hero')) {
        end = secEnd2 + '</div>'.length;
      }
    }
    next = next.slice(0, shellIdx) + next.slice(end);
  }
  const hero = findHeroBounds(next);
  if (hero) {
    next = next.slice(0, hero.start) + next.slice(hero.end);
  }
  return next;
}

function shellRegionBounds(html) {
  const start = html.indexOf('<div class="lhi-hero-shell">');
  if (start < 0) return null;
  const leadIdx = html.indexOf('class="lhi-lead-hero"', start);
  if (leadIdx < 0) return null;
  const leadClose = html.indexOf('</section>', leadIdx);
  if (leadClose < 0) return null;
  const shellClose = html.indexOf('</div>', leadClose + 10);
  if (shellClose < 0) return null;
  return { start, end: shellClose + '</div>'.length };
}

function cleanLedeBlock(ledeBlock) {
  return ledeBlock.replace(
    /<div class="lhi-hero-lede-block">\s*<div class="container">\s*/i,
    '<div class="lhi-hero-lede-block">\n'
  ).replace(/\s*<\/div>\s*(?=<\/div>\s*$)/i, '\n');
}

function configForRel(rel) {
  const url = `/${rel.replace(/\/index\.html$/, '/')}`;
  if (
    /\/medicare\/|\/medicare-broker|\/medicare-part-d|\/retiring-and-medicare|\/working-past-65-medicare|\/moving-florida-medicare|\/learning\/|local-health-insurance-answers/.test(
      url
    )
  ) {
    return { variant: 'medicare', sourceTemplate: 'medicare_hub', funnelName: 'site_medicare_hub_lead' };
  }
  if (url.startsWith('/lp/')) {
    return { variant: 'aca', sourceTemplate: 'lp_page', funnelName: 'site_lp_lead' };
  }
  return { variant: 'aca', sourceTemplate: 'product_page', funnelName: 'site_product_lead' };
}

function injectLeadIfMissing(rel, html) {
  if (html.includes('lhi-lead-hero')) return html;
  const cfg = configForRel(rel);
  const route = rel === 'our-approach.html' ? '/our-approach.html' : `/${rel.replace(/\/index\.html$/, '/')}`;
  const formName = cfg.variant === 'medicare' ? 'site-medicare-lead' : 'site-aca-lead';
  const idPrefix = rel.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  const lead = buildLeadHeroHtml({
    variant: cfg.variant,
    formName,
    sourceTemplate: cfg.sourceTemplate,
    sourcePage: route.endsWith('/') ? route : route,
    idPrefix: idPrefix || 'siteLead',
    funnelName: cfg.funnelName
  }).trim();
  const hero = findHeroBounds(html);
  if (!hero) {
    return html.replace(/<main\b[^>]*>/i, (m) => `${m}\n${lead}\n`);
  }
  const end = hero.end;
  return `${html.slice(0, end)}\n\n${lead}\n\n${html.slice(end)}`;
}

function migrateFile(rel) {
  const path = join(ROOT, rel);
  const original = readFileSync(path, 'utf8');
  let html = injectLeadIfMissing(rel, original);
  const region = shellRegionBounds(html);

  let { html: stripped, lead } = extractLead(html);
  if (!lead) {
    return { rel, changed: false, reason: 'no-lead' };
  }

  let hero = findHeroBounds(stripped);
  if (!hero) {
    hero = findHeroBounds(stripped, stripped.indexOf('<main'));
  }
  if (!hero) {
    return { rel, changed: false, reason: 'no-hero' };
  }

  const innerStart = hero.openTag.length;
  let inner = hero.sectionHtml.slice(innerStart, hero.sectionHtml.length - '</section>'.length);
  inner = stripOuterContainers(inner);

  const existingLede = inner.match(/<div class="lhi-hero-lede-block"[\s\S]*?<\/div>/i);
  const existingDef = inner.match(/<div class="lhi-hero-deferred-block"[\s\S]*?<\/div>/i);
  let ledeBlock;
  let deferredBlock;
  if (existingLede) {
    ledeBlock = existingLede[0];
    inner = inner.replace(existingLede[0], '').trim();
  }
  if (existingDef) {
    deferredBlock = existingDef[0];
    inner = inner.replace(existingDef[0], '').trim();
  }
  if (!ledeBlock) {
    const split = splitLedeDeferred(inner, /answer-hero/i.test(hero.openTag));
    if (!split) return { rel, changed: false, reason: 'no-h1' };
    ledeBlock = split.ledeBlock;
    deferredBlock = deferredBlock || split.deferredBlock;
  } else if (!deferredBlock && inner.trim()) {
    deferredBlock = `<div class="lhi-hero-deferred-block">\n${inner.trim()}\n</div>`;
  }

  ledeBlock = cleanLedeBlock(ledeBlock);
  const { gridClass } = heroMeta(hero.openTag);
  const shell = buildShell(hero.openTag, gridClass, ledeBlock, lead, deferredBlock || '', hero.isMainHero);

  let next;
  if (region) {
    next = html.slice(0, region.start) + shell + html.slice(region.end);
  } else {
    next = stripped.slice(0, hero.start) + shell + stripped.slice(hero.end);
  }
  next = removeDuplicateLead(next);
  next = ensureBodyClass(next);
  next = ensureAssets(next);

  if (next === original) return { rel, changed: false, reason: 'unchanged' };
  if (!dryRun) writeFileSync(path, next);
  return { rel, changed: true };
}

function removeDuplicateLead(html) {
  const matches = [...html.matchAll(/<section class="lhi-lead-hero[^"]*"[\s\S]*?<\/section>/gi)];
  if (matches.length <= 1) return html;
  let next = html;
  for (let i = 1; i < matches.length; i += 1) {
    next = next.replace(matches[i][0], '');
  }
  return next;
}

function pickTargets() {
  if (extraArgs.length) return extraArgs;
  const list = [];
  if (!only || only === 'category-b') list.push(...CATEGORY_B);
  if (!only || only === 'category-c') list.push(...CATEGORY_C);
  return [...new Set(list)];
}

for (const rel of pickTargets()) {
  try {
    const result = migrateFile(rel);
    if (result.changed) console.log('migrated', rel);
    else console.log('skip', rel, result.reason || '');
  } catch (err) {
    console.error('fail', rel, err.message);
  }
}
