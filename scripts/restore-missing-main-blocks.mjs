#!/usr/bin/env node
/**
 * Insert HTML fragments from origin/main when normalized text blocks are missing on branch.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const BLOG = join(ROOT, 'blog');

const SEL =
  'h1,h2,h3,h4,p,li,blockquote,.signal-panel,.cta-panel,.cta-row,.answer-box,.warning,.lhi-alert-notice,section.lhi-alert-notice,a.btn,a.button,.hero-side,.meta,.byline,p.last-reviewed';

const PAIR_EVAL = ({ mainHtml, branchHtml, missingBlocks }) => {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const skip = (el) =>
    el.closest('script,style,noscript,nav,footer,form,.lhi-lead-hero__card,.lhi-lead-hero__intro,header');
  const SEL =
    'h1,h2,h3,h4,p,li,blockquote,.signal-panel,.cta-panel,.cta-row,.answer-box,.warning,.lhi-alert-notice,section.lhi-alert-notice,a.btn,a.button,.hero-side,.meta,.byline,p.last-reviewed';

  function collectBlocks(doc) {
    const roots = [...doc.querySelectorAll('.hero, .lhi-hero-shell, main, article')];
    const seen = new Set();
    const blocks = [];
    roots.forEach((root) => {
      root.querySelectorAll(SEL).forEach((el) => {
        if (skip(el)) return;
        const t = norm(el.innerText || el.textContent);
        if (t.length <= 15) return;
        if (seen.has(t)) return;
        seen.add(t);
        blocks.push(t);
      });
    });
    return blocks;
  }

  function findElement(doc, blockText) {
    let match = null;
    doc.querySelectorAll(SEL).forEach((el) => {
      if (skip(el)) return;
      if (norm(el.innerText || el.textContent) !== blockText) return;
      if (!match) {
        match = el;
        return;
      }
      if (match.contains(el)) match = el;
    });
    return match;
  }

  function styleLastReviewed(html) {
    if (!/last reviewed:/i.test(html)) return html;
    if (/style=/i.test(html)) {
      return html.replace(/style="[^"]*"/i, 'style="color:#475569;font-size:0.9rem;margin:0.75rem 0 1rem;"');
    }
    return html.replace(/<p([^>]*)>/i, '<p$1 style="color:#475569;font-size:0.9rem;margin:0.75rem 0 1rem;">');
  }

  const parser = new DOMParser();
  const mainDoc = parser.parseFromString(mainHtml, 'text/html');
  const branchDoc = parser.parseFromString(branchHtml, 'text/html');

  const branchBlocks = new Set(collectBlocks(branchDoc));
  const toRestore = missingBlocks.filter((b) => !branchBlocks.has(b));

  const fragments = [];
  const mainRoots = [
    ...mainDoc.querySelectorAll('.hero, .article-header, .blog-header, section.hero, main')
  ];
  const searchRoot = mainDoc.body;

  for (const block of toRestore) {
    const el = findElement(searchRoot, block);
    if (!el) continue;
    let html = el.outerHTML;
    if (el.matches('.last-reviewed, p.last-reviewed') || /last reviewed:/i.test(block)) {
      html = styleLastReviewed(html.replace(/\sclass="[^"]*last-reviewed[^"]*"/i, ' class="last-reviewed"'));
    }
    fragments.push({ block, html });
  }

  if (!fragments.length) return { changed: false, inserted: 0 };

  const article =
    branchDoc.querySelector('main article.post') ||
    branchDoc.querySelector('main article.blog-article') ||
    branchDoc.querySelector('main article') ||
    branchDoc.querySelector('main .article');

  let container;
  if (article) {
    container = branchDoc.createElement('div');
    container.className = 'lhi-post-body-intro';
    fragments.forEach(({ html }) => {
      const wrap = branchDoc.createElement('div');
      wrap.innerHTML = html;
      while (wrap.firstChild) container.appendChild(wrap.firstChild);
    });
    article.insertBefore(container, article.firstChild);
  } else {
    const shell = branchDoc.querySelector('.lhi-hero-shell');
    container = branchDoc.createElement('div');
    container.className = 'lhi-post-body-intro container';
    fragments.forEach(({ html }) => {
      const wrap = branchDoc.createElement('div');
      wrap.innerHTML = html;
      while (wrap.firstChild) container.appendChild(wrap.firstChild);
    });
    if (shell) shell.insertAdjacentElement('afterend', container);
    else return { changed: false, inserted: 0, error: 'no insert point' };
  }

  return {
    changed: true,
    inserted: fragments.length,
    html: '<!DOCTYPE html>\n' + branchDoc.documentElement.outerHTML
  };
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});
const page = await browser.newPage();

const EXTRACT = () => {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const skipRoot = (el) =>
    el.closest('script,style,noscript,nav,footer,form,.lhi-lead-hero__card,.lhi-lead-hero__intro,header');
  const roots = [...document.querySelectorAll('.hero, .lhi-hero-shell, main, article')];
  const seen = new Set();
  const blocks = [];
  const sel =
    'h1,h2,h3,h4,p,li,blockquote,.signal-panel,.cta-panel,.cta-row,.answer-box,.warning,.lhi-alert-notice,section.lhi-alert-notice,a.btn,a.button,.hero-side,.meta,.byline,p.last-reviewed';
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
let totalInserted = 0;
let filesChanged = 0;

for (const file of files) {
  let mainHtml;
  try {
    mainHtml = execSync(`git show origin/main:blog/${file}`, { encoding: 'utf8', maxBuffer: 20e6 });
  } catch {
    continue;
  }
  const path = join(BLOG, file);
  const branchHtml = readFileSync(path, 'utf8');

  await page.setContent(branchHtml, { waitUntil: 'domcontentloaded' });
  const branchBlocks = await page.evaluate(EXTRACT);
  const branchSet = new Set(branchBlocks);

  await page.setContent(mainHtml, { waitUntil: 'domcontentloaded' });
  const mainBlocks = await page.evaluate(EXTRACT);
  const missing = mainBlocks.filter((b) => !branchSet.has(b));
  if (!missing.length) continue;

  const result = await page.evaluate(PAIR_EVAL, { mainHtml, branchHtml, missingBlocks: missing });
  if (result.changed && result.html) {
    writeFileSync(path, result.html, 'utf8');
    totalInserted += result.inserted;
    filesChanged += 1;
    console.log(`${file}: +${result.inserted}`);
  }
}

await browser.close();
console.log(JSON.stringify({ filesChanged, totalInserted }, null, 2));
