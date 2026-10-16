#!/usr/bin/env node
/** Remove emptied wrapper sections/divs (no text, no img/svg/iframe) — never strip text nodes. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const BLOG = join(ROOT, 'blog');

const STRIP_EVAL = (html) => {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const hasMedia = (el) => Boolean(el.querySelector('img, svg, picture, video, iframe, canvas'));
  const isEmptyWrapper = (el) => {
    if (!el || el.nodeType !== 1) return false;
    if (hasMedia(el)) return false;
    if (norm(el.textContent)) return false;
    return true;
  };

  const selector =
    'section, div, aside, figure, blockquote, .key-answer, .answer-box, .signal-panel, .hero-cta-group';
  let removed = 0;
  [...doc.querySelectorAll(selector)].reverse().forEach((el) => {
    if (!isEmptyWrapper(el)) return;
    const stInline = el.getAttribute('style') || '';
    const cls = el.getAttribute('class') || '';
    const decorative =
      /background|border|box-shadow|border-radius/i.test(stInline) ||
      /\b(key-answer|answer-box|signal-panel|card|panel|cta-row)\b/i.test(cls);
    if (!decorative && el.tagName !== 'SECTION') return;
    if (el.tagName === 'DIV' && !decorative) return;
    el.remove();
    removed += 1;
  });

  return {
    changed: removed > 0,
    removed,
    html: '<!DOCTYPE html>\n' + doc.documentElement.outerHTML
  };
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});
const page = await browser.newPage();
let totalRemoved = 0;
const touched = [];

for (const file of readdirSync(BLOG).filter((f) => f.endsWith('.html'))) {
  const path = join(BLOG, file);
  const html = readFileSync(path, 'utf8');
  const result = await page.evaluate(STRIP_EVAL, html);
  if (result.changed) {
    writeFileSync(path, result.html, 'utf8');
    totalRemoved += result.removed;
    touched.push({ file, removed: result.removed });
  }
}
await browser.close();
console.log(JSON.stringify({ totalRemoved, files: touched.length, touched }, null, 2));
