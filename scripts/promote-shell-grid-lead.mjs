#!/usr/bin/env node
/**
 * Move nested lhi-lead-hero out of hero-grid/answer-grid to a direct shell sibling
 * with lhi-hero-grid-lead. Hoist lhi-hero-deferred-block to shell level when nested.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'search-engine-from-zip', '.ai-worker-local', 'output', 'blog']);
const SKIP_FILES = new Set(['medicare/index.html', 'index.html']);

function walkHtml(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function sectionBounds(html, start) {
  const re = /<section\b|<\/section>/gi;
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (/^<section\b/i.test(m[0])) depth += 1;
    else {
      depth -= 1;
      if (depth === 0) return { start, end: m.index + m[0].length, html: html.slice(start, m.index + m[0].length) };
    }
  }
  return null;
}

function isDirectShellLead(html, shellOpen, leadStart) {
  const before = html.slice(shellOpen, leadStart).trimEnd();
  return /<div class="lhi-hero-shell">$/.test(before.replace(/\s+/g, ' ')) ||
    /<\/section>$/.test(before.replace(/\s+/g, ' '));
}

function firstHeroBounds(html, shellOpen) {
  const slice = html.slice(shellOpen);
  const m = slice.match(/<section class="(?:hero|answer-hero|home-hero)\b/i);
  if (!m) return null;
  return sectionBounds(html, shellOpen + m.index);
}

function outerHeroEnd(html, shellOpen) {
  const deferredIdx = html.indexOf('lhi-hero-deferred-block', shellOpen);
  if (deferredIdx > shellOpen) {
    const close = html.indexOf('</section>', deferredIdx);
    if (close >= 0) return close + '</section>'.length;
  }
  return firstHeroBounds(html, shellOpen)?.end ?? null;
}

function promoteFile(file) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (SKIP_FILES.has(rel)) return false;

  let html = readFileSync(file, 'utf8');
  if (!html.includes('lhi-hero-shell') || !html.includes('lhi-lead-hero')) return false;

  const shellOpen = html.indexOf('<div class="lhi-hero-shell">');
  if (shellOpen < 0) return false;

  const leadRe = /<section class="lhi-lead-hero(\s+lhi-hero-grid-lead)?"/gi;
  let leadMatch;
  let nestedBounds = null;
  let directWithClass = false;

  while ((leadMatch = leadRe.exec(html))) {
    if (leadMatch.index < shellOpen) continue;
    const abs = leadMatch.index;
    if (isDirectShellLead(html, shellOpen, abs)) {
      if (leadMatch[1]) directWithClass = true;
      else {
        html = html.replace(
          leadMatch[0],
          '<section class="lhi-lead-hero lhi-hero-grid-lead"'
        );
        writeFileSync(file, html);
        return true;
      }
      continue;
    }
    const bounds = sectionBounds(html, abs);
    if (bounds) {
      nestedBounds = bounds;
      break;
    }
  }

  if (directWithClass && !nestedBounds) return false;
  if (!nestedBounds) return false;

  let leadHtml = nestedBounds.html;
  if (!leadHtml.includes('lhi-hero-grid-lead')) {
    leadHtml = leadHtml.replace(/class="lhi-lead-hero"/, 'class="lhi-lead-hero lhi-hero-grid-lead"');
  }

  html = html.slice(0, nestedBounds.start) + html.slice(nestedBounds.end);
  const shellOpen2 = html.indexOf('<div class="lhi-hero-shell">');
  const insertAt =
    outerHeroEnd(html, shellOpen2) ??
    firstHeroBounds(html, shellOpen2)?.end ??
    shellOpen2 + '<div class="lhi-hero-shell">'.length;
  html = html.slice(0, insertAt) + `\n${leadHtml}\n` + html.slice(insertAt);

  writeFileSync(file, html);
  return true;
}

let n = 0;
for (const file of walkHtml()) {
  if (promoteFile(file)) {
    n += 1;
    console.log('promoted', relative(ROOT, file).replace(/\\/g, '/'));
  }
}
console.log(`Done. ${n} files promoted.`);
