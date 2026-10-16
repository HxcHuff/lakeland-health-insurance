#!/usr/bin/env node
/**
 * PR B rendered metrics for blog homepage-match heroes (not class names).
 * Usage: node scripts/measure-sitewide-pr-b.mjs [--json] [route ...]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { allBlogLeadHeroRoutes } from './blog-homepage-match-routes.mjs';

const ROOT = resolve(import.meta.dirname, '..');

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

function parseRgb(color) {
  const m = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? m.slice(1, 4).map(Number) : null;
}

function luminance([r, g, b]) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function isGrayHeroBg(rgb) {
  if (!rgb) return false;
  const [r, g, b] = rgb;
  return r >= 245 && g >= 248 && b >= 250 && Math.abs(r - g) < 8 && Math.abs(g - b) < 8;
}

function isNavyHeading(rgb) {
  if (!rgb) return false;
  return luminance(rgb) < 0.25 && rgb[2] > rgb[0];
}

async function measurePage(page, baseUrl, route, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(200);

  return page.evaluate(({ vw, vh }) => {
    const shell = document.querySelector('.lhi-hero-shell');
    const h1 =
      shell?.querySelector('.lhi-hero-lede-block h1') ||
      shell?.querySelector('section.hero h1') ||
      document.querySelector('main h1, h1');
    const formCard =
      shell?.querySelector('.lhi-hero-grid-lead .lhi-lead-hero__card') ||
      document.querySelector('.lhi-lead-hero__card');
    const lede =
      shell?.querySelector('.lhi-hero-lede-block .lhi-hero-lede') ||
      shell?.querySelector('.lhi-hero-lede-block p.lhi-hero-lede') ||
      shell?.querySelector('.lhi-hero-lede-block p.article-intro') ||
      shell?.querySelector('.lhi-hero-lede-block section.key-answer');

    const h1r = h1?.getBoundingClientRect();
    const fr = formCard?.getBoundingClientRect();
    const lr = lede?.getBoundingClientRect();
    const parseRgbLocal = (color) => {
      const m = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? m.slice(1, 4).map(Number) : null;
    };

    const shellStyle = shell ? getComputedStyle(shell) : null;
    const shellBg = shellStyle ? parseRgbLocal(shellStyle.backgroundColor) : null;
    const h1Color = h1 ? parseRgbLocal(getComputedStyle(h1).color) : null;
    const blogShell =
      document.body.classList.contains('lhi-page-hero') &&
      document.body.classList.contains('blog-post');
    const overflow = blogShell
      ? document.body.scrollWidth - document.body.clientWidth
      : Math.max(
          document.body.scrollWidth - document.body.clientWidth,
          document.documentElement.scrollWidth - document.documentElement.clientWidth
        );

    return {
      hasShell: !!shell,
      h1Y: h1r ? Math.round(h1r.top) : null,
      h1Bottom: h1r ? Math.round(h1r.bottom) : null,
      ledeY: lr ? Math.round(lr.top) : null,
      formY: fr ? Math.round(fr.top) : null,
      formLeftPct: fr ? Math.round((fr.left / vw) * 100) : null,
      overflowPx: Math.round(overflow),
      shellBg,
      h1Color
    };
  }, { vw: viewport.width, vh: viewport.height });
}

function evaluateRow(row) {
  const issues = [];
  if (!row.hasShell) issues.push('no-shell');

  if (row.viewport === '1280') {
    if (!isGrayHeroBg(row.shellBg)) issues.push(`hero-not-gray:bg=${row.shellBg?.join(',')}`);
    if (!isNavyHeading(row.h1Color)) issues.push(`h1-not-navy:color=${row.h1Color?.join(',')}`);
    if (row.formLeftPct != null && row.formLeftPct < 55) {
      issues.push(`form-not-right:formLeftPct=${row.formLeftPct}`);
    }
    if (row.formY != null && row.formY >= 800) issues.push(`form-too-low:formY=${row.formY}`);
    if (row.overflowPx > 12) issues.push(`overflow:overflowPx=${row.overflowPx}`);
  }

  if (row.viewport === '390') {
    if (!isGrayHeroBg(row.shellBg)) issues.push(`hero-not-gray:bg=${row.shellBg?.join(',')}`);
    if (!isNavyHeading(row.h1Color)) issues.push(`h1-not-navy:color=${row.h1Color?.join(',')}`);
    if (row.h1Y != null && row.h1Y > 450) issues.push(`h1-below-fold:h1Y=${row.h1Y}`);
    if (row.formY != null && row.formY >= 844) issues.push(`form-below-fold:formY=${row.formY}`);
    if (row.h1Bottom != null && row.formY != null && row.formY < row.h1Bottom - 8) {
      issues.push('form-above-h1');
    }
    if (row.ledeY != null && row.h1Y != null && row.ledeY < row.h1Y - 4) {
      issues.push('lede-before-h1');
    }
    if (row.ledeY != null && row.formY != null && row.formY < row.ledeY - 4) {
      issues.push('form-before-lede');
    }
    if (row.overflowPx > 12) issues.push(`overflow:overflowPx=${row.overflowPx}`);
  }

  return issues;
}

const jsonOut = process.argv.includes('--json');
const argRoutes = process.argv.slice(2).filter((a) => a.startsWith('/'));
const routes = argRoutes.length
  ? argRoutes.map((url) => ({ url, name: url.replace(/^\/blog\/?/, '').replace(/\/$/, 'blog-index') }))
  : allBlogLeadHeroRoutes();

const server = await startServer();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});
const page = await browser.newPage();
const report = [];

for (const { url, name } of routes) {
  for (const vp of [
    { tag: '1280', width: 1280, height: 800 },
    { tag: '390', width: 390, height: 844 }
  ]) {
    const metrics = await measurePage(page, server.baseUrl, url, vp);
    const row = { route: url, name, viewport: vp.tag, ...metrics };
    row.issues = evaluateRow(row);
    row.ok = row.issues.length === 0;
    report.push(row);
  }
}

await browser.close();
await server.close();

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const row of report) {
    console.log(
      `${row.route}\t${row.viewport}\tok=${row.ok}\tissues=${row.issues.join(';') || '-'}`
    );
  }
}

const failedRoutes = [...new Set(report.filter((r) => !r.ok).map((r) => r.route))];
process.exit(failedRoutes.length ? 1 : 0);
