#!/usr/bin/env node
/**
 * Move key-answer from main-branch hero into article body when missing (PR B dedupe).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BLOG = join(ROOT, 'blog');

function mainKeyAnswer(html) {
  const m = html.match(/<section class="key-answer">[\s\S]*?<\/section>/);
  return m ? m[0] : null;
}

function gitMain(rel) {
  try {
    return execSync(`git show origin/main:${rel}`, { encoding: 'utf8', cwd: ROOT });
  } catch {
    return null;
  }
}

const insertTargets = [
  /<main class="container"><article class="post">\s*\n/i,
  /<article class="post">\s*\n/i,
  /<div class="article-body">\s*\n/i,
  /<article class="article-content">\s*\n\s*<div class="article-body">\s*\n/i,
];

let updated = 0;
for (const name of readdirSync(BLOG).filter((f) => f.endsWith('.html') && f !== 'index.html')) {
  const rel = `blog/${name}`;
  const path = join(BLOG, name);
  let html = readFileSync(path, 'utf8');
  if (/<section class="key-answer">/.test(html)) continue;
  const mainHtml = gitMain(rel);
  if (!mainHtml) continue;
  const block = mainKeyAnswer(mainHtml);
  if (!block) continue;
  let inserted = false;
  for (const re of insertTargets) {
    if (re.test(html)) {
      html = html.replace(re, (m) => `${m}\n${block}\n\n`);
      inserted = true;
      break;
    }
  }
  if (!inserted) {
    console.warn('skip insert target', rel);
    continue;
  }
  writeFileSync(path, html);
  updated += 1;
}
console.log(`restored key-answer in ${updated} files`);
