#!/usr/bin/env node
/**
 * One-time migration: move non-meta hero deferred copy into article body (HTML source).
 * Hero keeps H1 + lede + meta/byline lines only.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const BLOG = join(ROOT, 'blog');

const MIGRATE_EVAL = () => {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  const isMetaLike = (el) => {
    if (!el || el.nodeType !== 1) return false;
    if (el.matches('.meta, .blog-meta, .byline, .last-reviewed, p.last-reviewed')) return true;
    const cls = String(el.className || '');
    if (/\b(meta|blog-meta|byline|last-reviewed|published|updated|date-line)\b/i.test(cls)) {
      return true;
    }
    if (el.tagName === 'P' || el.tagName === 'DIV') {
      const t = norm(el.textContent);
      if (t.length > 0 && t.length < 260) {
        if (/^(by |published|last reviewed|updated:|posted |reviewed:)/i.test(t)) return true;
        if (/\bNPN\b|\bFL #W371813\b|licensed Florida health agent/i.test(t) && t.length < 200) {
          return true;
        }
      }
    }
    return false;
  };

  const ledePrefix = (ledeBlock) => {
    const lede = ledeBlock?.querySelector('.lhi-hero-lede, p.lhi-hero-lede');
    return lede ? norm(lede.textContent).toLowerCase().slice(0, 40) : '';
  };

  const isExactLedeDuplicate = (el, prefix) => {
    if (!prefix || prefix.length < 20) return false;
    if (isMetaLike(el)) return false;
    return norm(el.textContent).toLowerCase().slice(0, 40) === prefix;
  };

  const bodyInsertPoint = () => {
    const shell = document.querySelector('.lhi-hero-shell');
    const main = document.querySelector('main');
    if (main) {
      const article = main.querySelector('article.post, article.blog-article, article');
      if (article) {
        const before =
          article.querySelector(
            '.key-answer, .professional-intro, section.key-answer, h2, section.card, section, p, div'
          ) || article.firstChild;
        return { parent: article, before, mode: 'before' };
      }
      if (shell && main.contains(shell)) {
        let wrap = shell.nextElementSibling;
        if (!wrap || !wrap.classList.contains('lhi-post-body-intro')) {
          wrap = document.createElement('div');
          wrap.className = 'lhi-post-body-intro';
          shell.insertAdjacentElement('afterend', wrap);
        }
        return { parent: wrap, before: null, mode: 'append' };
      }
    }
    if (!shell) return null;
    let intro = document.querySelector('.lhi-post-body-intro');
    if (!intro) {
      intro = document.createElement('div');
      intro.className = 'lhi-post-body-intro container';
      shell.insertAdjacentElement('afterend', intro);
    }
    return { parent: intro, before: intro.firstChild, mode: 'before' };
  };

  let moved = 0;
  let metaMoved = 0;
  document.querySelectorAll('.lhi-hero-shell').forEach((shell) => {
    const ledeBlock = shell.querySelector('.lhi-hero-lede-block');
    if (!ledeBlock) return;
    const prefix = ledePrefix(ledeBlock);
    const target = bodyInsertPoint();
    if (!target) return;

    shell.querySelectorAll('.lhi-hero-deferred-block').forEach((def) => {
      const children = Array.from(def.children);
      const toBody = [];
      children.forEach((el) => {
        if (isExactLedeDuplicate(el, prefix)) {
          el.remove();
          return;
        }
        if (isMetaLike(el)) {
          ledeBlock.appendChild(el);
          metaMoved += 1;
          return;
        }
        toBody.push(el);
      });
      toBody.forEach((el) => {
        if (target.mode === 'append') {
          target.parent.appendChild(el);
        } else {
          target.parent.insertBefore(el, target.before);
        }
        moved += 1;
      });
      def.remove();
    });
  });
  return { moved, metaMoved };
};

async function migrateFile(page, filePath) {
  const html = readFileSync(filePath, 'utf8');
  if (!html.includes('lhi-hero-deferred-block')) return { skipped: true };
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const stats = await page.evaluate(MIGRATE_EVAL);
  const out = await page.content();
  writeFileSync(filePath, out, 'utf8');
  return { skipped: false, ...stats };
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});
const page = await browser.newPage();
let totalMoved = 0;
let files = 0;
for (const name of readdirSync(BLOG)) {
  if (!name.endsWith('.html') || name === 'index.html') continue;
  const path = join(BLOG, name);
  const html = readFileSync(path, 'utf8');
  if (!html.includes('lhi-hero-deferred-block')) continue;
  const result = await migrateFile(page, path);
  if (!result.skipped) {
    files += 1;
    totalMoved += result.moved || 0;
    console.log(`${name}: bodyNodes=${result.moved} metaToHero=${result.metaMoved}`);
  }
}
await browser.close();
console.log(JSON.stringify({ filesMigrated: files, totalBodyNodesMoved: totalMoved }, null, 2));
