#!/usr/bin/env node
/**
 * PR B: after lead-hero.js runs, every visible text block (>15 chars) from the
 * static hero+main regions must still be present (except exact lede duplicates).
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { allBlogLeadHeroRoutes } from './blog-homepage-match-routes.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const OUT_JSON =
  process.env.PR_B_PRESERVE_JSON ||
  '/cursor/stores/self/media/sitewide-b/content-preservation.json';

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

const COLLECT_BLOCKS = () => {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const isVisible = (el) => {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.05) {
      return false;
    }
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  };
  const blocks = [];
  const roots = [
    ...document.querySelectorAll('.lhi-hero-shell .lhi-hero-lede-block, .lhi-hero-shell .lhi-hero-deferred-block'),
    document.querySelector('main'),
    ...document.querySelectorAll('.lhi-post-body-intro')
  ].filter(Boolean);
  const seen = new Set();
  const selector =
    'h1,h2,h3,h4,p,li,blockquote,figcaption,.lhi-alert-notice,.cta-row,section.lhi-alert-notice';
  roots.forEach((root) => {
    root.querySelectorAll(selector).forEach((el) => {
      if (el.closest('form,.lhi-lead-hero__card,.lhi-lead-hero__intro')) return;
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

const server = await startServer();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});

const routes = allBlogLeadHeroRoutes().filter((r) => r.url.startsWith('/blog/') && r.url !== '/blog/');
const rows = [];

try {
  for (const { url, name } of routes) {
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
    const baseline = await page.evaluate(COLLECT_BLOCKS);
    await page.addScriptTag({ url: `${server.baseUrl}/js/lead-hero.js?v=20261016-sitewide-b7` });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      if (typeof window.LHIConsolidateBlogHeroCopy === 'function') {
        window.LHIConsolidateBlogHeroCopy();
      }
    });
    await page.waitForTimeout(80);
    const after = await page.evaluate(COLLECT_BLOCKS);
    const ledePrefix = await page.evaluate(() => {
      const lede = document.querySelector('.lhi-hero-lede, p.lhi-hero-lede');
      const t = (lede?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return t.slice(0, 40);
    });
    const afterSet = new Set(after);
    const missing = baseline.filter((b) => {
      if (afterSet.has(b)) return false;
      if (ledePrefix.length >= 20 && b.toLowerCase().slice(0, 40) === ledePrefix) return false;
      return true;
    });
    rows.push({
      route: url,
      name,
      baselineCount: baseline.length,
      afterCount: after.length,
      missingCount: missing.length,
      missingSamples: missing.slice(0, 5),
      ok: missing.length === 0
    });
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

const summary = {
  generatedAt: new Date().toISOString(),
  routesChecked: rows.length,
  totalMissingBlocks: rows.reduce((a, r) => a + r.missingCount, 0),
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
