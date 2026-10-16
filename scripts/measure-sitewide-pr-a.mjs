#!/usr/bin/env node
/**
 * PR A layout metrics: H1 Y, form left %, horizontal overflow, header width @390.
 * Usage: node scripts/measure-sitewide-pr-a.mjs [--json] [route ...]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_ROUTES = [
  '/advantage-guard/',
  '/accident-wise/',
  '/tampa-health-insurance/',
  '/carriers/oscar-aca-2026/',
  '/health-protector-guard/',
  '/short-term-medical/',
  '/medicare-broker-lakeland-fl/',
  '/blog/orlando-health-lakeland-quality-approval-2026.html',
  '/blog/',
  '/quote/'
];

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

async function measure(page, baseUrl, route, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(150);
  return page.evaluate(({ vw, vh }) => {
    const h1 = document.querySelector('section.hero h1, section.answer-hero h1, .article-hero h1, main h1, h1');
    const form = document.querySelector('.lhi-hero-grid-lead .lhi-lead-hero__card, .lhi-lead-hero__card');
    const headerInner = document.querySelector('header nav, header .container, header');
    const footer = document.querySelector('footer');
    const h1r = h1?.getBoundingClientRect();
    const fr = form?.getBoundingClientRect();
    const hr = headerInner?.getBoundingClientRect();
    const ftr = footer?.getBoundingClientRect();
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return {
      h1Y: h1r ? Math.round(h1r.top) : null,
      formLeftPct: fr ? Math.round((fr.left / vw) * 100) : null,
      headerWidth: hr ? Math.round(hr.width) : null,
      overflowPx: Math.round(overflow),
      footerBeforeH1: !!(ftr && h1r && ftr.top < h1r.top - 8),
      footerY: ftr ? Math.round(ftr.top) : null
    };
  }, { vw: viewport.width, vh: viewport.height });
}

const jsonOut = process.argv.includes('--json');
const routes = process.argv.slice(2).filter(
  (a) => a.startsWith('/') && (a.endsWith('/') || a.endsWith('.html'))
);
const list = routes.length ? routes : DEFAULT_ROUTES;

const server = await startServer();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});
const page = await browser.newPage();
const report = [];

for (const route of list) {
  for (const vp of [
    { tag: '390', width: 390, height: 844 },
    { tag: '1280', width: 1280, height: 800 }
  ]) {
    const m = await measure(page, server.baseUrl, route, vp);
    report.push({ route, viewport: vp.tag, ...m });
  }
}

await browser.close();
await server.close();

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const row of report) {
    console.log(
      `${row.route}\t${row.viewport}\th1Y=${row.h1Y}\toverflow=${row.overflowPx}\theaderW=${row.headerWidth}\tformLeft=${row.formLeftPct}%\tfooterBeforeH1=${row.footerBeforeH1}`
    );
  }
}

const bad = report.filter(
  (r) =>
    (r.viewport === '390' && r.h1Y != null && r.h1Y > 400) ||
    r.footerBeforeH1 ||
    (r.viewport === '390' && r.headerWidth != null && r.headerWidth > 400) ||
    (r.viewport === '1280' && r.overflowPx > 8) ||
    (r.viewport === '1280' && r.formLeftPct != null && r.formLeftPct < 50 && r.route.includes('health-insurance'))
);
process.exit(bad.length ? 1 : 0);
