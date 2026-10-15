#!/usr/bin/env node
/**
 * Add lhi-hero-grid-lead to direct-child lhi-lead-hero sections inside lhi-hero-shell.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIP = new Set(['.git', 'node_modules', 'search-engine-from-zip', '.ai-worker-local', 'output']);

function walkHtml(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
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
      if (depth === 0) return m.index + m[0].length;
    }
  }
  return null;
}

function shellBounds(html) {
  const open = html.indexOf('<div class="lhi-hero-shell">');
  if (open < 0) return null;
  const close = html.indexOf('</div>', open);
  if (close < 0) return null;
  let depth = 0;
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = open;
  let m;
  while ((m = re.exec(html))) {
    if (/^<div\b/i.test(m[0])) depth += 1;
    else {
      depth -= 1;
      if (depth === 0) return { start: open, end: m.index + m[0].length, inner: html.slice(open, m.index + m[0].length) };
    }
  }
  return null;
}

let updated = 0;
for (const file of walkHtml()) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (rel.startsWith('blog/')) continue;
  let html = readFileSync(file, 'utf8');
  if (!html.includes('lhi-hero-shell') || !html.includes('class="lhi-lead-hero"')) continue;

  const shell = shellBounds(html);
  if (!shell) continue;

  const leadRe = /<section class="lhi-lead-hero(\s+lhi-hero-grid-lead)?"/gi;
  let changed = false;
  let inner = shell.inner;
  let offset = 0;
  let match;
  while ((match = leadRe.exec(shell.inner))) {
    if (match[1]) continue;
    const absStart = shell.start + match.index;
    const before = html.slice(shell.start, absStart);
    const isDirectChild = /<div class="lhi-hero-shell">\s*$/.test(before.replace(/\n/g, '\n')) ||
      />\s*$/.test(before.slice(-80));
    const prevClose = before.lastIndexOf('</section>');
    const prevOpen = before.lastIndexOf('<section');
    const nestedInHero = prevOpen > prevClose && before.slice(prevOpen).includes('answer-hero');
    if (nestedInHero) continue;

    const tag = match[0];
    if (!tag.includes('lhi-hero-grid-lead')) {
      html =
        html.slice(0, absStart) +
        tag.replace('class="lhi-lead-hero"', 'class="lhi-lead-hero lhi-hero-grid-lead"') +
        html.slice(absStart + tag.length);
      changed = true;
      break;
    }
  }

  if (changed) {
    writeFileSync(file, html);
    updated += 1;
    console.log('grid-lead', rel);
  }
}
console.log(`Done. ${updated} files updated.`);
