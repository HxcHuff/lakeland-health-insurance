#!/usr/bin/env node
/** Rebuild main.hero service pages: lede + lead form + deferred body; footer outside shell. */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const TARGETS = [
  'current-client-review/index.html',
  'post-enrollment-review/index.html',
  'employer-referral/index.html'
];

const LEAD_RE = /<section class="lhi-lead-hero[\s\S]*?<\/section>/i;

function mainHeroBody(rel) {
  const mainHtml = execSync(`git show origin/main:${rel}`, { encoding: 'utf8', maxBuffer: 25e6 });
  const m = mainHtml.match(/<main class="hero">([\s\S]*?)<\/main>/i);
  if (!m) return null;
  let inner = m[1];
  inner = inner.replace(/^[\s\S]*?<div class="wrap">/i, '');
  inner = inner.replace(/<\/div>\s*$/i, '').trim();
  return inner;
}

for (const rel of TARGETS) {
  const path = join(ROOT, rel);
  let html = readFileSync(path, 'utf8');
  const lead = html.match(LEAD_RE)?.[0];
  if (!lead) {
    console.log('skip no lead', rel);
    continue;
  }

  const bodyFromMain = mainHeroBody(rel);
  if (!bodyFromMain) {
    console.log('skip no main hero body', rel);
    continue;
  }

  const eyebrowM = bodyFromMain.match(/<p class="eyebrow"[\s\S]*?<\/p>/i);
  const h1m = bodyFromMain.match(/<h1\b[\s\S]*?<\/h1>/i);
  const ledeM =
    bodyFromMain.match(/<p class="lead"[\s\S]*?<\/p>/i) ||
    bodyFromMain.match(/<p class="[^"]*lhi-hero-lede[^"]*"[\s\S]*?<\/p>/i);
  if (!h1m) {
    console.log('skip no h1 in main', rel);
    continue;
  }

  let deferred = bodyFromMain;
  for (const chunk of [eyebrowM?.[0], h1m[0], ledeM?.[0]].filter(Boolean)) {
    deferred = deferred.replace(chunk, '');
  }
  deferred = deferred.replace(/^<section>\s*/i, '').replace(/<\/section>\s*$/i, '').trim();
  deferred = deferred.replace(/^<div class="wrap">\s*<section>\s*/i, '').trim();

  const ledeBlock = `<div class="lhi-hero-lede-block">
${eyebrowM ? `${eyebrowM[0]}\n` : ''}${h1m[0]}
${ledeM ? ledeM[0].replace('<p class="lead"', '<p class="lhi-hero-lede lead"') : ''}
</div>`;

  const deferredBlock = deferred ? `<div class="lhi-hero-deferred-block">\n${deferred}\n</div>` : '';

  const shellBlock = `<div class="lhi-hero-shell">
<main class="hero">
  <div class="wrap">
${ledeBlock}
${lead}
${deferredBlock}
  </div>
</main>
</div>`;

  const headerEnd = html.indexOf('</header>');
  if (headerEnd < 0) {
    console.log('skip no header', rel);
    continue;
  }
  const footerStart = html.indexOf('<footer');
  if (footerStart < 0) {
    console.log('skip no footer', rel);
    continue;
  }

  const before = html.slice(0, headerEnd + '</header>'.length);
  const after = html.slice(footerStart);
  html = `${before}\n${shellBlock}\n\n${after}`;

  if (!html.includes('lhi-page-hero')) {
    html = html.replace(/<body([^>]*)>/i, '<body$1 class="lhi-page-hero">');
  }
  if (!html.includes('lead-hero.css')) {
    html = html.replace(
      /<\/head>/i,
      '  <link rel="stylesheet" href="/css/lead-hero.css?v=20261016-nonblog-gates3" data-lhi-lead-hero-tail>\n</head>'
    );
  }

  writeFileSync(path, html, 'utf8');
  console.log('fixed', rel);
}
