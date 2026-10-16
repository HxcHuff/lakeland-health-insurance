#!/usr/bin/env node
/**
 * PR B: every visible text block (>15 chars) on origin/main must appear on branch
 * after lead-hero.js runs (rendered DOM @1280). Exact lede duplicates may be absent.
 */
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const BLOG = join(ROOT, 'blog');
const PIN = process.env.PR_B_PIN || '20261016-sitewide-b10';
const OUT_JSON =
  process.env.PR_B_PRESERVE_JSON ||
  '/cursor/stores/self/media/sitewide-b/content-preservation.json';

const BLOCK_SEL =
  'h1,h2,h3,h4,p,li,blockquote,figcaption,.signal-panel,.cta-panel,.cta-row,.answer-box,.warning,.lhi-alert-notice,section.lhi-alert-notice,a.btn,a.button,.meta,.byline,p.last-reviewed,.eyebrow,.kicker';

function contentType(pathname) {
  if (pathname.endsWith('.css')) return 'text/css';
  if (pathname.endsWith('.js')) return 'application/javascript';
  return 'text/html';
}

function startServer() {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        const file = join(ROOT, pathname.replace(/^\//, ''));
        if (!existsSync(file)) {
          res.writeHead(404);
          res.end('missing');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType(pathname) });
        res.end(readFileSync(file));
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

/** 151 routes = blog index + 150 posts (preservation gate previously used 150 by excluding index). */
export function allPreservationRoutes() {
  const routes = [{ url: '/blog/', name: 'blog-index', file: 'index.html' }];
  for (const name of readdirSync(BLOG)) {
    if (!name.endsWith('.html') || name === 'index.html') continue;
    routes.push({ url: `/blog/${name}`, name: name.replace(/\.html$/, ''), file: name });
  }
  return routes;
}

const COLLECT_BLOCKS = (BLOCK_SELECTOR) => {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const isVisible = (el) => {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.05) {
      return false;
    }
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  };
  const skip = (el) =>
    el.closest('script,style,noscript,nav,footer,form,.lhi-lead-hero__card,.lhi-lead-hero__intro,header');
  const blocks = [];
  const roots = [
    ...document.querySelectorAll('.hero, .lhi-hero-shell, main, article, .blog-index-main')
  ];
  const seen = new Set();
  roots.forEach((root) => {
    root.querySelectorAll(BLOCK_SELECTOR).forEach((el) => {
      if (skip(el)) return;
      if (!isVisible(el)) return;
      const t = norm(el.innerText || el.textContent);
      if (t.length <= 15) return;
      if (seen.has(t)) return;
      seen.add(t);
      blocks.push(t);
    });
  });
  return blocks;
};

function mainHtmlForFile(file) {
  const gitPath = file === 'index.html' ? 'blog/index.html' : `blog/${file}`;
  return execSync(`git show origin/main:${gitPath}`, { encoding: 'utf8', maxBuffer: 25e6 });
}

function findDuplicateLocation(afterBlocks, missingText) {
  const lower = missingText.toLowerCase();
  for (const b of afterBlocks) {
    if (b.toLowerCase() === lower) return b;
    if (b.length > 40 && lower.length > 40 && b.toLowerCase().includes(lower.slice(0, 40))) {
      return b;
    }
  }
  return null;
}

const server = await startServer();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});

const routes = allPreservationRoutes();
const rows = [];
const mainPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  for (const { url, name, file } of routes) {
    let mainHtml;
    try {
      mainHtml = mainHtmlForFile(file);
    } catch {
      rows.push({ route: url, name, error: 'missing on origin/main', ok: false, missingCount: 1 });
      continue;
    }

    await mainPage.setContent(mainHtml, { waitUntil: 'domcontentloaded' });
    const mainBlocks = await mainPage.evaluate(COLLECT_BLOCKS, BLOCK_SEL);

    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${server.baseUrl}${url}`, { waitUntil: 'networkidle', timeout: 25000 });
    await page.evaluate(() => {
      try {
        for (let i = localStorage.length - 1; i >= 0; i -= 1) {
          const k = localStorage.key(i);
          if (k && k.startsWith('lhi-seasonal-banner-aep-')) localStorage.removeItem(k);
        }
      } catch {
        /* ignore */
      }
    });
    await page.addScriptTag({ url: `${server.baseUrl}/js/lead-hero.js?v=${PIN}` });
    await page.waitForTimeout(120);
    await page.evaluate(() => {
      if (typeof window.LHIConsolidateBlogHeroCopy === 'function') {
        window.LHIConsolidateBlogHeroCopy();
      }
    });
    await page.waitForTimeout(80);

    const afterBlocks = await page.evaluate(COLLECT_BLOCKS, BLOCK_SEL);
    const ledePrefix = await page.evaluate(() => {
      const lede = document.querySelector('.lhi-hero-lede, p.lhi-hero-lede');
      const t = (lede?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return t.slice(0, 40);
    });

    const afterSet = new Set(afterBlocks);
    const afterLower = new Set(afterBlocks.map((x) => x.toLowerCase()));
    const missing = [];
    const exceptions = [];
    for (const b of mainBlocks) {
      if (afterSet.has(b) || afterLower.has(b.toLowerCase())) continue;
      if (ledePrefix.length >= 20 && b.toLowerCase().slice(0, 40) === ledePrefix) {
        exceptions.push({ block: b.slice(0, 80), reason: 'exact_lede_duplicate' });
        continue;
      }
      const dup = findDuplicateLocation(afterBlocks, b);
      if (dup && dup !== b) {
        exceptions.push({ block: b.slice(0, 80), reason: 'duplicate_location', match: dup.slice(0, 80) });
        continue;
      }
      missing.push(b);
    }

    rows.push({
      route: url,
      name,
      mainBlockCount: mainBlocks.length,
      afterBlockCount: afterBlocks.length,
      missingCount: missing.length,
      missingSamples: missing.slice(0, 5),
      exceptions: exceptions.slice(0, 3),
      ok: missing.length === 0
    });
    await page.close();
  }
} finally {
  await mainPage.close();
  await browser.close();
  await server.close();
}

const summary = {
  generatedAt: new Date().toISOString(),
  comparisonBase: 'origin/main static HTML vs branch rendered DOM after lead-hero.js',
  pin: PIN,
  routesChecked: rows.length,
  routeCountNote:
    '151 = /blog/ index plus 150 post HTML files; earlier gate used allBlogLeadHeroRoutes().filter(url !== /blog/) → 150.',
  totalMissingBlocks: rows.reduce((a, r) => a + (r.missingCount || 0), 0),
  routesWithMissing: rows.filter((r) => r.missingCount > 0).length,
  rows
};
mkdirSync(resolve(OUT_JSON, '..'), { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2), 'utf8');
console.log(
  JSON.stringify(
    {
      preserveJson: OUT_JSON,
      routesChecked: summary.routesChecked,
      totalMissingBlocks: summary.totalMissingBlocks,
      routesWithMissing: summary.routesWithMissing,
      ok: summary.totalMissingBlocks === 0
    },
    null,
    2
  )
);
process.exit(summary.totalMissingBlocks > 0 ? 1 : 0);
