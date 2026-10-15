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
    /(<div class="(?:container|answer-wrap) ([^"]*)"[^>]*>)([\s\S]*?)(<\/div>\s*<\/section>)/i;
  const gm = heroSection.match(gridRe);
  if (!gm) return null;

  const [, gridOpen, , gridInner, gridClose] = gm;
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
    const firstColRe =
      /(<div>\s*(?:<p class="eyebrow">[\s\S]*?<\/p>\s*)?(?:<div class="hero-kicker">[\s\S]*?<\/div>\s*)?<h1[\s\S]*?<\/h1>\s*<p[\s\S]*?<\/p>)([\s\S]*?)<\/div>/i;
    const col = bodyInner.match(firstColRe);
    if (!col) return null;
    let ledeChunk = col[1];
    ledeChunk = ledeChunk.replace(
      /(<h1[\s\S]*?<\/h1>\s*)(<p\b)/i,
      (_, head, pOpen) => {
        if (/\blhi-hero-lede\b/.test(head + pOpen)) return head + pOpen;
        return `${head}${pOpen.replace(/^<p\b/, '<p class="lhi-hero-lede"')}`;
      },
    );
    const split = {
      lede: `<div class="lhi-hero-lede-block">${ledeChunk}</div>`,
      deferred: `<div class="lhi-hero-deferred-block">${col[2].trimStart()}</div>`,
    };
    const afterCol = bodyInner.slice(col.index + col[0].length);
    newGridInner = `${split.lede}\n${leadSection}\n${split.deferred}${afterCol}${portrait}`;
  }

  const newHero = heroSection.replace(gridRe, `${gridOpen}${newGridInner}${gridClose}`);
  const newShell = `${shellOpen}${newHero}\n</div>`;
  return html.replace(shellRe, newShell);
}

let changed = 0;
for (const file of listHtmlFiles(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('blog/')) continue;
  const html = fs.readFileSync(file, 'utf8');
  const next = transform(html, rel);
  if (next && next !== html) {
    fs.writeFileSync(file, next);
    changed += 1;
    console.log('updated', rel);
  }
}
console.log('done, files updated:', changed);
