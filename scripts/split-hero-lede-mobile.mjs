#!/usr/bin/env node
/**
 * Split hero copy so mobile DOM order is: H1 + short lede → lhi-lead-hero → rest.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

function listHtmlFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'search-engine-from-zip') continue;
      listHtmlFiles(full, out);
    } else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function markFirstLedeP(inner) {
  const h1Match = inner.match(/<h1[\s>][\s\S]*?<\/h1>/i);
  if (!h1Match) return null;
  const h1End = h1Match.index + h1Match[0].length;
  const afterH1 = inner.slice(h1End);
  const pMatch = afterH1.match(/^\s*(<p\b[\s\S]*?<\/p>)/i);
  if (!pMatch) return null;
  const ledeEnd = h1End + pMatch.index + pMatch[0].length;
  let ledeP = pMatch[1];
  if (!/\blhi-hero-lede\b/.test(ledeP)) {
    ledeP = ledeP.replace(/^<p\b/, '<p class="lhi-hero-lede"');
  }
  const ledeBlock = inner.slice(0, h1End) + afterH1.slice(0, pMatch.index) + ledeP;
  const deferred = inner.slice(ledeEnd).trimStart();
  if (!deferred) return null;
  return {
    lede: `<div class="lhi-hero-lede-block">${ledeBlock}</div>`,
    deferred: `<div class="lhi-hero-deferred-block">${deferred}</div>`,
  };
}

function transform(html, rel) {
  if (rel === 'index.html') return null;
  if (!html.includes('lhi-hero-shell')) return null;
  if (html.includes('lhi-hero-lede-block')) return null;

  const shellRe =
    /(<div class="lhi-hero-shell">\s*)(<section class="[^"]*"[\s\S]*?<\/section>)\s*(<section class="lhi-lead-hero"[\s\S]*?<\/section>)\s*(<\/div>)/i;
  const m = html.match(shellRe);
  if (!m) return null;

  const [, shellOpen, heroSection, leadSection] = m;
  const gridRe =
    /(<div class="[^"]*\b(?:answer-wrap|hero-grid|container)\b[^"]*"[^>]*>)([\s\S]*?)(<\/div>\s*<\/section>)/i;
  const gm = heroSection.match(gridRe);
  if (!gm) return null;

  const [, gridOpen, gridInner, gridClose] = gm;
  const portraitRe = /(\s*<figure class="hero-portrait-wrap"[\s\S]*?<\/figure>)/i;
  const portraitMatch = gridInner.match(portraitRe);
  const portrait = portraitMatch ? portraitMatch[1] : '';
  let bodyInner = portraitMatch ? gridInner.replace(portraitRe, '') : gridInner;

  const heroContentRe = /(<div class="hero-content"[^>]*>)([\s\S]*?)(<\/div>)/i;
  const hc = bodyInner.match(heroContentRe);
  let newGridInner;

  if (hc) {
    const split = markFirstLedeP(hc[2]);
    if (!split) return null;
    const panelMatch = bodyInner.match(/(<div class="hero-panel"[\s\S]*?<\/div>)/i);
    const panel = panelMatch ? panelMatch[1] : '';
    newGridInner = `${split.lede}\n${leadSection}\n${split.deferred}${panel}${portrait}`;
    if (panelMatch) {
      newGridInner = bodyInner
        .replace(heroContentRe, `${split.lede}\n${leadSection}\n${split.deferred}`)
        .replace(panel, '')
        .trimEnd();
      newGridInner += `${panel}${portrait}`;
    }
  } else {
    const colMatch = bodyInner.match(/^(\s*<div>\s*)([\s\S]*?)(\s*<\/div>\s*)([\s\S]*)$/i);
    if (!colMatch) return null;
    const [, colOpen, colInner, colClose, afterCol] = colMatch;
    const h1Match = colInner.match(/<h1[\s\S]*?<\/h1>/i);
    if (!h1Match) return null;
    const beforeH1 = colInner.slice(0, h1Match.index);
    const afterH1 = colInner.slice(h1Match.index + h1Match[0].length);
    const leadMatch =
      afterH1.match(/(<p class="lead"[\s\S]*?<\/p>)/i) ||
      afterH1.match(/(<p class="[^"]*lhi-hero-lede[^"]*"[\s\S]*?<\/p>)/i) ||
      afterH1.match(/(<p[\s\S]*?<\/p>)/i);
    if (!leadMatch) return null;
    const ledeP = leadMatch[1].includes('lhi-hero-lede')
      ? leadMatch[1]
      : leadMatch[1].replace(/^<p\b/, '<p class="lhi-hero-lede"');
    const ledeChunk = `${beforeH1}${h1Match[0]}${afterH1.slice(0, leadMatch.index)}${ledeP}`;
    const deferredChunk = afterH1.slice(leadMatch.index + leadMatch[0].length).trimStart();
    newGridInner = `${colOpen}<div class="lhi-hero-lede-block">${ledeChunk}</div>\n${leadSection}\n<div class="lhi-hero-deferred-block">${deferredChunk}</div>${colClose}${afterCol}${portrait}`;
  }

  const newHero = heroSection.replace(gridRe, `${gridOpen}${newGridInner}${gridClose}`);
  const newShell = `${shellOpen}${newHero}\n</div>`;
  return html.replace(shellRe, newShell);
}

function transformSimpleHeroShell(html) {
  if (!html.includes('lhi-hero-shell') || html.includes('lhi-hero-lede-block')) return null;
  const shellRe =
    /(<div class="lhi-hero-shell">\s*)(<section class="hero"[\s\S]*?<\/section>)\s*(<section class="lhi-lead-hero"[\s\S]*?<\/section>)\s*(<\/div>)/i;
  const m = html.match(shellRe);
  if (!m) return null;
  const [, shellOpen, heroSection, leadSection] = m;
  const openRe = /^(\s*<section class="hero"[^>]*>\s*)/i;
  const openM = heroSection.match(openRe);
  if (!openM) return null;
  const inner = heroSection.slice(openM[0].length).replace(/<\/section>\s*$/i, '');
  const h1Re = /(<h1[\s\S]*?<\/h1>)/i;
  const h1m = inner.match(h1Re);
  if (!h1m) return null;
  const beforeH1 = inner.slice(0, h1m.index);
  const afterH1 = inner.slice(h1m.index + h1m[0].length);
  const pMatch = afterH1.match(/^\s*(<p[\s\S]*?<\/p>)/i);
  const ledeP = pMatch
    ? pMatch[1].replace(/^<p\b/, '<p class="lhi-hero-lede"')
    : '';
  const ledeBody = `${beforeH1}${h1m[0]}${ledeP}`;
  const deferredBody = pMatch ? afterH1.slice(pMatch.index + pMatch[0].length).trimStart() : afterH1.trimStart();
  const newHero = `${openM[0]}<div class="lhi-hero-lede-block">${ledeBody}</div>\n${leadSection}\n<div class="lhi-hero-deferred-block">${deferredBody}</div>\n</section>`;
  const newShell = `${shellOpen}${newHero}\n</div>`;
  return html.replace(shellRe, newShell);
}

let changed = 0;
for (const file of listHtmlFiles(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('blog/')) continue;
  let html = fs.readFileSync(file, 'utf8');
  let next = transform(html, rel);
  if (!next) next = transformSimpleHeroShell(html);
  if (next && next !== html) {
    fs.writeFileSync(file, next);
    changed += 1;
    console.log('updated', rel);
  }
}
console.log('done, files updated:', changed);
