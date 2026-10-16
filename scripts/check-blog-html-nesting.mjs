#!/usr/bin/env node
/** Structural HTML checks for blog/*.html (151 files). */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const BLOG = join(ROOT, 'blog');
const OUT =
  process.env.PR_B_HTML_CHECK_JSON ||
  '/cursor/stores/self/media/sitewide-b/blog-html-nesting-check.json';

const CHECK_EVAL = (html) => {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const issues = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  doc.querySelectorAll('section.key-answer, section[class*="key-answer"]').forEach((el) => {
    if (!norm(el.textContent)) issues.push('empty-key-answer-section');
  });

  doc.querySelectorAll('.lhi-post-body-intro .cta-row').forEach((row) => {
    if (row.querySelector('section, article, div.key-answer')) {
      issues.push('cta-row-nests-block-element');
    }
  });

  const main = doc.querySelector('main');
  if (!main) issues.push('missing-main');
  else {
    const cards = [...doc.querySelectorAll('section.card')];
    const outside = cards.filter((c) => !main.contains(c));
    if (outside.length) issues.push(`section.card-outside-main:${outside.length}`);
  }

  const tagPairs = ['main', 'article', 'section', 'div'];
  const raw = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of tagPairs) {
    const open = (raw.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
    const close = (raw.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (open !== close) issues.push(`tag-balance-${tag}:${open - close}`);
  }

  return issues;
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});
const page = await browser.newPage();

const files = [
  ...readdirSync(BLOG).filter((f) => f.endsWith('.html')).map((f) => ({ file: f, kind: 'post' })),
  { file: 'index.html', kind: 'index' }
];
const rows = [];
let failCount = 0;

for (const { file } of files) {
  const html = readFileSync(join(BLOG, file), 'utf8');
  const issues = await page.evaluate(CHECK_EVAL, html);
  if (issues.length) failCount += 1;
  rows.push({ file, issues, ok: issues.length === 0 });
}
await browser.close();

const summary = {
  generatedAt: new Date().toISOString(),
  filesChecked: rows.length,
  filesWithIssues: failCount,
  rows: rows.filter((r) => !r.ok)
};
mkdirSync(resolve(OUT, '..'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ ...summary, allRows: rows }, null, 2), 'utf8');
console.log(JSON.stringify({ out: OUT, filesChecked: rows.length, filesWithIssues: failCount }, null, 2));
process.exit(failCount > 0 ? 1 : 0);
