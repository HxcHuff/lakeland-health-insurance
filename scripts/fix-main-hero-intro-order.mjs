#!/usr/bin/env node
/** Move intro blocks that landed before .lhi-hero-shell inside main to after the shell. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const BLOG = join(ROOT, 'blog');

const FIX = () => {
  let fixed = 0;
  document.querySelectorAll('main').forEach((main) => {
    const shell = main.querySelector('.lhi-hero-shell');
    if (!shell || main.firstElementChild === shell) return;
    const toMove = [];
    let child = main.firstElementChild;
    while (child && child !== shell) {
      const next = child.nextElementSibling;
      toMove.push(child);
      child = next;
    }
    if (!toMove.length) return;
    let wrap = shell.nextElementSibling;
    if (!wrap || !wrap.classList.contains('lhi-post-body-intro')) {
      wrap = document.createElement('div');
      wrap.className = 'lhi-post-body-intro';
      shell.insertAdjacentElement('afterend', wrap);
    }
    toMove.forEach((n) => wrap.appendChild(n));
    fixed += toMove.length;
  });
  return fixed;
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});
const page = await browser.newPage();
let files = 0;
for (const name of readdirSync(BLOG)) {
  if (!name.endsWith('.html') || name === 'index.html') continue;
  const path = join(BLOG, name);
  const html = readFileSync(path, 'utf8');
  if (!html.includes('lhi-hero-shell') || !html.includes('<main')) continue;
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const n = await page.evaluate(FIX);
  if (n > 0) {
    writeFileSync(path, await page.content(), 'utf8');
    files += 1;
    console.log(`${name}: reordered ${n} nodes`);
  }
}
await browser.close();
console.log(JSON.stringify({ filesFixed: files }));
