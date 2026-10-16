#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = '/cursor/stores/self/media/sitewide-b';
const FILE = 'blog/orlando-health-lakeland-quality-approval-2026.html';

function contentType(pathname) {
  if (pathname.endsWith('.css')) return 'text/css';
  if (pathname.endsWith('.js')) return 'application/javascript';
  return 'text/html';
}

function startServer(getHtml) {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        if (pathname === `/blog/${FILE.split('/').pop()}`) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(getHtml());
          return;
        }
        const body = readFileSync(join(ROOT, pathname.replace(/^\//, '')));
        res.writeHead(200, { 'Content-Type': contentType(pathname) });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('missing');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolvePromise({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r()))
      });
    });
  });
}

async function shot(label, getHtml, pin) {
  const server = await startServer(getHtml);
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const url = `/blog/${FILE.split('/').pop()}`;
  await page.goto(`${server.baseUrl}${url}`, { waitUntil: 'networkidle' });
  if (pin) {
    await page.addScriptTag({ url: `${server.baseUrl}/js/lead-hero.js?v=${pin}` });
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => {
    const target =
      document.querySelector('.lhi-post-body-intro') ||
      document.querySelector('section.card.safe') ||
      document.querySelector('section.key-answer');
    if (target) {
      const top = target.getBoundingClientRect().top + window.pageYOffset - 72;
      window.scrollTo(0, Math.max(0, top));
    }
  });
  await page.waitForTimeout(200);
  const metrics = await page.evaluate(() => {
    const card = document.querySelector('section.card.safe');
    const cr = card?.getBoundingClientRect();
    return card
      ? { left: Math.round(cr.left), right: Math.round(cr.right), width: Math.round(cr.width) }
      : null;
  });
  const path = join(OUT, `${label}-orlando-health-lakeland-quality-approval-2026-intro-1280.png`);
  await page.screenshot({ path });
  await browser.close();
  await server.close();
  return { path, metrics };
}

mkdirSync(OUT, { recursive: true });
const mainHtml = () =>
  execSync(`git show origin/main:${FILE}`, { encoding: 'utf8', maxBuffer: 25e6 });
const branchHtml = () => readFileSync(join(ROOT, FILE), 'utf8');

const main = await shot('main-baseline', mainHtml, null);
const branch = await shot('branch-b10', branchHtml, '20261016-sitewide-b10');
const report = {
  generatedAt: new Date().toISOString(),
  mainCardSafe: main.metrics,
  branchCardSafe: branch.metrics,
  predatesPr333:
    main.metrics && branch.metrics
      ? Math.abs(main.metrics.left - branch.metrics.left) <= 8
      : null,
  mainPng: main.path,
  branchPng: branch.path
};
writeFileSync(join(OUT, 'orlando-quality-fast-answer-compare.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
