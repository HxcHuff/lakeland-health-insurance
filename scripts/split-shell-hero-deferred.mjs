#!/usr/bin/env node
/**
 * For shell-level lhi-hero-grid-lead pages: keep short lede in hero row 1,
 * move remaining answer-wrap / hero copy into shell-sibling lhi-hero-deferred-block.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIP = new Set(['.git', 'node_modules', 'search-engine-from-zip', '.ai-worker-local', 'output', 'blog']);

function walk(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function shellBounds(html) {
  const open = html.indexOf('<div class="lhi-hero-shell">');
  if (open < 0) return null;
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = open;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (/^<div\b/i.test(m[0])) depth += 1;
    else if (--depth === 0) return { open, end: m.index + m[0].length };
  }
  return null;
}

function hasShellDeferred(inner) {
  return />\s*<div class="lhi-hero-deferred-block"/.test(inner.replace(/\n/g, ' '));
}

function leadEnd(inner) {
  const m = inner.match(/<section class="lhi-lead-hero lhi-hero-grid-lead"[\s\S]*?<\/section>/i);
  return m ? m.index + m[0].length : -1;
}

function splitAnswerWrap(wrapInner) {
  if (wrapInner.includes('lhi-hero-lede-block')) {
    const ledeRe = /(<div class="lhi-hero-lede-block">[\s\S]*?<\/div>)/i;
    const lm = wrapInner.match(ledeRe);
    if (!lm) return null;
    const rest = wrapInner.slice(lm.index + lm[0].length).trim();
    if (!rest) return null;
    return { lede: lm[1], deferred: rest };
  }

  const h1 = wrapInner.match(/<h1[\s\S]*?<\/h1>/i);
  if (!h1) return null;
  const beforeH1 = wrapInner.slice(0, h1.index);
  const afterH1 = wrapInner.slice(h1.index + h1[0].length);
  const leadP =
    afterH1.match(/^\s*(<p class="[^"]*\blead[^"]*"[\s\S]*?<\/p>)/i) ||
    afterH1.match(/^\s*(<p class="lhi-hero-lede"[\s\S]*?<\/p>)/i) ||
    afterH1.match(/^\s*(<p[\s\S]*?<\/p>)/i);
  if (!leadP) return null;
  const ledeBody = `${beforeH1}${h1[0]}${afterH1.slice(0, leadP.index)}${leadP[1]}`;
  const lede = `<div class="lhi-hero-lede-block">${ledeBody.trim()}</div>`;
  const deferred = afterH1.slice(leadP.index + leadP[0].length).trim();
  if (!deferred) return null;
  return { lede, deferred };
}

function process(html) {
  if (!html.includes('lhi-hero-grid-lead')) return null;
  const shell = shellBounds(html);
  if (!shell) return null;
  const inner = html.slice(shell.open, shell.end);
  if (hasShellDeferred(inner)) return null;
  if (/lhi-hero-lede-block[\s\S]*?<h1\b/i.test(inner)) return null;
  const afterLead = leadEnd(inner);
  if (afterLead < 0) return null;

  const heroRe = /<section class="(?:answer-hero|hero)"[^>]*>[\s\S]*?<div class="(?:answer-wrap|container hero-grid|hero-grid)"[^>]*>([\s\S]*?)<\/div>\s*<\/section>/i;
  const hm = inner.match(heroRe);
  if (!hm) return null;

  const split = splitAnswerWrap(hm[1]);
  if (!split) return null;

  const newHero = hm[0].replace(hm[1], split.lede);
  let newInner = inner.replace(hm[0], newHero);
  const deferredBlock = `<div class="lhi-hero-deferred-block">${split.deferred}</div>`;
  const leadPos = leadEnd(newInner);
  newInner = newInner.slice(0, leadPos) + `\n${deferredBlock}\n` + newInner.slice(leadPos);

  return html.slice(0, shell.open) + newInner + html.slice(shell.end);
}

let n = 0;
for (const file of walk()) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (rel === 'index.html') continue;
  let html = readFileSync(file, 'utf8');
  const next = process(html);
  if (next && next !== html) {
    writeFileSync(file, next);
    n += 1;
    console.log('split-deferred', rel);
  }
}
console.log(`Done. ${n} files updated.`);
