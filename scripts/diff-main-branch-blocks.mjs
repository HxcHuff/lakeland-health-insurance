#!/usr/bin/env node
/** Quick audit: text blocks on origin/main HTML vs branch file (static parse via Playwright). */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const BLOG = join(ROOT, 'blog');
const OUT = '/cursor/stores/self/media/sitewide-b/main-vs-branch-blocks.json';

const EXTRACT = () => {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const skipRoot = (el) =>
    el.closest('script,style,noscript,nav,footer,form,.lhi-lead-hero__card,.lhi-lead-hero__intro,header');
  const roots = [
    ...document.querySelectorAll('.hero, .lhi-hero-shell, main, .blog-content, article')
  ];
  const seen = new Set();
  const blocks = [];
  const sel = 'h1,h2,h3,h4,p,li,blockquote,figcaption,.signal-panel,.cta-row,a.btn,a.button,.lhi-alert-notice';
  roots.forEach((root) => {
    root.querySelectorAll(sel).forEach((el) => {
      if (skipRoot(el)) return;
      const t = norm(el.innerText || el.textContent);
      if (t.length <= 15) return;
      if (seen.has(t)) return;
      seen.add(t);
      blocks.push(t);
    });
  });
  return blocks;
};

const files = readdirSync(BLOG).filter((f) => f.endsWith('.html') && f !== 'index.html');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});
const page = await browser.newPage();
const rows = [];
let totalMissing = 0;

for (const file of files) {
  let mainHtml;
  try {
    mainHtml = execSync(`git show origin/main:blog/${file}`, { encoding: 'utf8', maxBuffer: 20e6 });
  } catch {
    rows.push({ file, error: 'no main' });
    continue;
  }
  const branchHtml = readFileSync(join(BLOG, file), 'utf8');
  await page.setContent(mainHtml, { waitUntil: 'domcontentloaded' });
  const mainBlocks = await page.evaluate(EXTRACT);
  await page.setContent(branchHtml, { waitUntil: 'domcontentloaded' });
  const branchBlocks = await page.evaluate(EXTRACT);
  const branchSet = new Set(branchBlocks);
  const missing = mainBlocks.filter((b) => !branchSet.has(b));
  totalMissing += missing.length;
  if (missing.length) {
    rows.push({ file, missingCount: missing.length, samples: missing.slice(0, 3) });
  }
}
await browser.close();
mkdirSync(resolve(OUT, '..'), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({ files: files.length, routesWithMissing: rows.length, totalMissing, rows }, null, 2),
  'utf8'
);
console.log(JSON.stringify({ totalMissing, routesWithMissing: rows.length, out: OUT }, null, 2));
