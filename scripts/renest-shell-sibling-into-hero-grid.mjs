#!/usr/bin/env node
/**
 * Move shell-level lhi-hero-grid-lead + lhi-hero-deferred-block into
 * section.hero > .container.hero-grid or section.answer-hero > .answer-wrap.answer-grid.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'search-engine-from-zip', '.ai-worker-local', 'output', 'blog']);

function walk(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function balancedDivEnd(html, start) {
  let depth = 0;
  const divRe = /<div\b|<\/div>/gi;
  divRe.lastIndex = start;
  let m;
  while ((m = divRe.exec(html))) {
    if (/^<div\b/i.test(m[0])) depth += 1;
    else if (--depth === 0) return m.index + m[0].length;
  }
  return -1;
}

function renest(html, shellIdx) {
  const ledeOpen = html.indexOf('<div class="lhi-hero-lede-block"', shellIdx);
  if (ledeOpen < 0) return null;
  const ledeClose = balancedDivEnd(html, ledeOpen);
  if (ledeClose < 0) return null;
  const leadOpen = html.indexOf('<section class="lhi-lead-hero lhi-hero-grid-lead"', ledeClose);
  if (leadOpen < 0 || leadOpen > ledeClose + 40) return null;
  const leadClose = html.indexOf('</section>', leadOpen) + '</section>'.length;
  const defOpen = html.indexOf('<div class="lhi-hero-deferred-block"', leadClose);
  if (defOpen < 0) return null;
  const defClose = balancedDivEnd(html, defOpen);
  if (defClose < 0) return null;
  const shellClose = html.indexOf('</div>', defClose);
  if (shellClose < 0) return null;

  const sectionOpen = html.lastIndexOf('<section class="', ledeOpen);
  if (sectionOpen < shellIdx) return null;
  const sectionTagEnd = html.indexOf('>', sectionOpen);
  const sectionOpenTag = html.slice(sectionOpen, sectionTagEnd + 1);
  const isAnswer = sectionOpenTag.includes('answer-hero');
  const gridClass = isAnswer ? 'answer-wrap answer-grid' : 'container hero-grid';

  const ledeInner = html.slice(ledeOpen, ledeClose);
  const leadBlock = html.slice(leadOpen, leadClose);
  const defBlock = html.slice(defOpen, defClose);

  const replacement = `${sectionOpenTag}
      <div class="${gridClass}">${ledeInner}
${leadBlock}
${defBlock}


      </div>
    </section>`;

  return `${html.slice(0, sectionOpen)}${replacement}${html.slice(shellClose)}`;
}

let n = 0;
for (const file of walk()) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (rel === 'index.html') continue;
  let html = readFileSync(file, 'utf8');
  const shellIdx = html.indexOf('<div class="lhi-hero-shell">');
  if (shellIdx < 0) continue;
  const slice = html.slice(shellIdx, shellIdx + 14000);
  if (!slice.includes('<section class="lhi-lead-hero lhi-hero-grid-lead"')) continue;
  if (!slice.includes('<div class="lhi-hero-deferred-block"')) continue;
  if (slice.includes('class="container hero-grid"')) continue;
  if (slice.includes('answer-wrap answer-grid') && slice.includes('lhi-hero-grid-lead') && slice.indexOf('answer-wrap answer-grid') < slice.indexOf('lhi-hero-grid-lead')) continue;

  const next = renest(html, shellIdx);
  if (!next) continue;
  writeFileSync(file, next);
  n += 1;
  console.log('renested', rel);
}

console.log('total', n);
