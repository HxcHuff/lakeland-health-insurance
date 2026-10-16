#!/usr/bin/env node
/**
 * Measure every site lead form v2 page @1280 and @390 (Playwright, no submits).
 * Writes measure-all.json to the project agent store by default.
 */
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_OUT = '/cursor/stores/self/media/lead-form-v2/measure-all.json';
const OUT = process.env.LEAD_FORM_V2_MEASURE_OUT || DEFAULT_OUT;
const VIEWPORTS = [
  { tag: '1280', width: 1280, height: 800 },
  { tag: '390', width: 390, height: 844 }
];

function contentType(pathname) {
  if (pathname.endsWith('.css')) return 'text/css';
  if (pathname.endsWith('.js')) return 'application/javascript';
  if (pathname.endsWith('.json')) return 'application/json';
  return 'text/html';
}

function startServer() {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        if (pathname === '/index.html') pathname = '/';
        const file = pathname === '/' ? join(ROOT, 'index.html') : join(ROOT, pathname.replace(/^\//, ''));
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

function walkV2Routes() {
  const routes = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (name === '.git' || name === 'node_modules' || name === 'lp') continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.html')) {
        const html = readFileSync(full, 'utf8');
        if (!html.includes('data-lf2-mode="site"')) continue;
        const rel = relative(ROOT, full).replace(/\\/g, '/');
        if (rel === 'index.html') routes.push('/');
        else if (rel.endsWith('/index.html')) routes.push('/' + rel.replace(/index\.html$/, ''));
        else routes.push('/' + rel);
      }
    }
  }
  walk(ROOT);
  routes.sort();
  return routes;
}

function relLuminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg, bg) {
  const l1 = relLuminance(fg);
  const l2 = relLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

async function measureRoute(page, baseUrl, route, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.route('**/*', (req) => {
    const u = req.request().url();
    if (/google-analytics|googletagmanager|googleadservices|doubleclick|connect\.facebook|facebook\.com\/tr/i.test(u)) {
      return req.abort();
    }
    return req.continue();
  });
  const url = `${baseUrl}${route === '/' ? '/' : route}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForSelector('form.lf2[data-lf2-mode="site"]', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('form.lf2.lf2--js'), { timeout: 15000 });
  await page.waitForFunction(() => {
    const title = document.querySelector('form.lf2[data-lf2-mode="site"] .lf2__title');
    if (!title) return false;
    const { color } = getComputedStyle(title);
    return /rgb\(\s*27,\s*42,\s*74\s*\)/.test(color);
  }, { timeout: 15000 });
  await page.evaluate(() => {
    const form = document.querySelector('form.lf2[data-lf2-mode="site"]');
    if (form?.__lf2go) form.__lf2go(1, { silent: true });
  });

  const metrics = await page.evaluate(() => {
    const form = document.querySelector('form.lf2[data-lf2-mode="site"]');
    const active = form?.querySelector('[data-lf2-step].is-active');
    const step = active ? Number(active.getAttribute('data-lf2-step')) : 0;
    const title = form?.querySelector('.lf2__title');
    const card = form?.closest('.lhi-lead-hero__card') || form;
    const cardBox = card?.getBoundingClientRect();
    const overflow = Math.max(
      document.body.scrollWidth - document.body.clientWidth,
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    const parseRgb = (color) => {
      const m = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      const alpha = m[4] !== undefined ? Number(m[4]) : 1;
      if (alpha < 0.05) return null;
      return m.slice(1, 4).map(Number);
    };
    function effectiveBackground(el) {
      let node = el;
      while (node) {
        const fg = parseRgb(getComputedStyle(node).backgroundColor);
        if (fg) return fg;
        node = node.parentElement;
      }
      return [255, 255, 255];
    }
    let titleContrast = null;
    if (title) {
      const fg = parseRgb(getComputedStyle(title).color);
      const bg = effectiveBackground(card || title);
      if (fg) {
        titleContrast = ((Math.max(relLuminance(fg), relLuminance(bg)) + 0.05) / (Math.min(relLuminance(fg), relLuminance(bg)) + 0.05));
      }
    }
    function relLuminance(rgb) {
      const [r, g, b] = rgb.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    return {
      step,
      overflow,
      cardVisible: Boolean(cardBox && cardBox.width > 40 && cardBox.height > 40),
      hasNormalizedIntent: Boolean(form?.querySelector('input[name="normalized_intent"]')),
      hasV2ConsentVersion: Boolean(form?.querySelector('input[name="consent_text_version"][value="site-lead-v2-2026-11-v1"]')),
      titleContrast
    };
  });

  const failures = [];
  if (!metrics.cardVisible) failures.push('form_card_not_visible');
  if (metrics.overflow > 1) failures.push(`horizontal_overflow_${metrics.overflow}`);
  if (!metrics.hasNormalizedIntent) failures.push('missing_normalized_intent');
  if (!metrics.hasV2ConsentVersion) failures.push('missing_v2_consent_version');
  if (metrics.step < 1 || metrics.step > 3) failures.push(`invalid_active_step_${metrics.step}`);
  if (viewport.tag === '390' && metrics.titleContrast != null && metrics.titleContrast < 3) {
    failures.push(`lf2_title_low_contrast_${metrics.titleContrast.toFixed(2)}`);
  }

  return { route, viewport: viewport.tag, ok: failures.length === 0, failures, metrics };
}

const routes = walkV2Routes();
const server = await startServer();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});

const results = [];
const failList = [];

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const route of routes) {
    for (const viewport of VIEWPORTS) {
      try {
        const row = await measureRoute(page, server.baseUrl, route, viewport);
        results.push(row);
        if (!row.ok) failList.push({ route, viewport: viewport.tag, failures: row.failures });
      } catch (error) {
        const entry = {
          route,
          viewport: viewport.tag,
          ok: false,
          failures: ['measure_exception'],
          error: String(error.message || error)
        };
        results.push(entry);
        failList.push({ route, viewport: viewport.tag, failures: entry.failures, error: entry.error });
      }
    }
  }
  await context.close();
} finally {
  await browser.close();
  await server.close();
}

const gitHeadSha = process.env.LEAD_FORM_V2_GIT_HEAD || execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();

const summary = {
  generatedAt: new Date().toISOString(),
  gitHeadSha,
  source: 'data-lf2-mode=site (inventory sections A+B site hero scope; LP/get-help sitelink excluded)',
  routeCount: routes.length,
  measurementCount: results.length,
  passCount: results.filter((r) => r.ok).length,
  failCount: failList.length,
  viewports: VIEWPORTS.map((v) => v.tag),
  routes,
  results,
  failList
};

mkdirSync(resolve(OUT, '..'), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Wrote ${OUT} — ${summary.passCount}/${summary.measurementCount} pass, ${summary.failCount} fail rows`);
process.exit(summary.failCount > 0 ? 1 : 0);
