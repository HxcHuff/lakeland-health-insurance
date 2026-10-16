#!/usr/bin/env node
/**
 * Move merged .lhi-post-body-intro into article or immediately after hero shell.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const BLOG = join(ROOT, 'blog');
const MAP_JSON =
  process.env.PR_B_INTRO_MAP_JSON ||
  '/cursor/stores/self/media/sitewide-b/post-body-intro-insertion-map.json';

const FIX_EVAL = (html) => {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const inHero = (el) =>
    el.closest('.lhi-hero-shell, .lhi-lead-hero, .lhi-lead-hero__intro, .lhi-lead-hero__card, form');

  let intros = [...doc.querySelectorAll('.lhi-post-body-intro')];
  if (!intros.length) return { changed: false, html };

  const merged = doc.createElement('div');
  merged.className = 'lhi-post-body-intro';
  let sourceCount = 0;
  intros.forEach((intro) => {
    sourceCount += 1;
    intro.classList.remove('container');
    while (intro.firstChild) merged.appendChild(intro.firstChild);
    intro.remove();
  });

  merged.querySelectorAll('a, button').forEach((el) => {
    const text = norm(el.textContent);
    const aria = norm(el.getAttribute('aria-label'));
    const title = norm(el.getAttribute('title'));
    if (!text && !aria && !title) el.remove();
  });

  const seenBlock = new Set();
  [...merged.querySelectorAll('p, h2, h3, .signal-panel, .cta-row, section')].forEach((el) => {
    const t = norm(el.textContent);
    if (t.length <= 20) return;
    if (seenBlock.has(t)) {
      el.remove();
      return;
    }
    seenBlock.add(t);
  });

  merged.querySelectorAll('.cta-row a[href]').forEach((link) => {
    const href = link.getAttribute('href');
    const text = norm(link.textContent);
    const row = link.closest('.cta-row');
    if (!row) return;
    const dupes = [...row.querySelectorAll(`a[href="${href}"]`)].filter(
      (a) => norm(a.textContent) === text
    );
    if (dupes.length > 1) dupes.slice(1).forEach((d) => d.remove());
  });

  const articleSelectors = [
    'main article.post',
    'main article.blog-article',
    'main article.guide-post',
    'main article.article',
    'main article',
    'main .article',
    'article.post',
    'article.article'
  ];

  let insertSelector = null;
  let placed = false;

  for (const sel of articleSelectors) {
    const article = doc.querySelector(sel);
    if (article && !inHero(article)) {
      article.insertBefore(merged, article.firstChild);
      insertSelector = sel;
      placed = true;
      break;
    }
  }

  if (!placed) {
    const main = doc.querySelector('main');
    const shell = main?.querySelector('.lhi-hero-shell');
    if (main && shell && main.contains(shell)) {
      shell.insertAdjacentElement('afterend', merged);
      insertSelector = 'main > .lhi-hero-shell + .lhi-post-body-intro';
      placed = true;
    } else if (main) {
      const content = [...main.children].find(
        (el) =>
          !el.classList.contains('lhi-hero-shell') &&
          !el.matches('header') &&
          (el.matches('section, article, div') || el.tagName === 'SECTION')
      );
      if (content) {
        main.insertBefore(merged, content);
        insertSelector = `main > ${content.tagName.toLowerCase()}:first-content`;
      } else {
        main.insertBefore(merged, main.firstChild);
        insertSelector = 'main';
      }
      placed = true;
    }
  }

  if (!placed) return { changed: false, html, error: 'no-target' };

  return {
    changed: true,
    html: '<!DOCTYPE html>\n' + doc.documentElement.outerHTML,
    insertSelector,
    mergedFrom: sourceCount,
    fragmentCount: merged.childElementCount
  };
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});
const page = await browser.newPage();

const files = readdirSync(BLOG).filter((f) => f.endsWith('.html'));
const mapRows = [];
let changedFiles = 0;

for (const file of files) {
  const path = join(BLOG, file);
  const html = readFileSync(path, 'utf8');
  if (!html.includes('lhi-post-body-intro')) continue;
  const beforeIntros = (html.match(/class="lhi-post-body-intro"/g) || []).length;
  const result = await page.evaluate(FIX_EVAL, html);
  if (result.changed && result.html) {
    writeFileSync(path, result.html, 'utf8');
    changedFiles += 1;
  }
  mapRows.push({
    file,
    introBlocksBefore: beforeIntros,
    insertSelector: result.insertSelector || null,
    mergedFrom: result.mergedFrom ?? 0,
    fragmentCount: result.fragmentCount ?? 0,
    changed: Boolean(result.changed)
  });
}

await browser.close();

const summary = {
  generatedAt: new Date().toISOString(),
  filesScanned: files.length,
  filesWithIntro: mapRows.length,
  filesRelocated: changedFiles,
  rows: mapRows
};
mkdirSync(resolve(MAP_JSON, '..'), { recursive: true });
writeFileSync(MAP_JSON, JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify({ mapJson: MAP_JSON, filesRelocated: changedFiles }, null, 2));
