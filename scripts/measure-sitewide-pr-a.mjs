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

async function measure(page, baseUrl, route, viewport, detail = false) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await page.waitForTimeout(150);
  return page.evaluate(({ vw, vh, detail }) => {
    const h1 = document.querySelector('section.hero h1, section.answer-hero h1, .article-hero h1, main h1, h1');
    const form = document.querySelector('.lhi-hero-grid-lead .lhi-lead-hero__card, .lhi-lead-hero__card');
    const headerInner = document.querySelector('header nav, header .container, header');
    const footer = document.querySelector('footer');
    const shell = document.querySelector('.lhi-hero-shell, section.hero, .article-hero');
    const lede =
      document.querySelector('.lhi-hero-deferred-block .hero-sub, .lhi-hero-deferred-block h2, .lhi-hero-lede, section.hero p.lhi-hero-lede') ||
      document.querySelector('.hero-sub, .lhi-hero-deferred-block p, section.hero p');
    const ledeBlock = document.querySelector('.lhi-hero-lede-block');
    const deferredBlock = document.querySelector(
      'section.hero .lhi-hero-deferred-block, .lhi-hero-shell > .lhi-hero-deferred-block'
    );
    const call = document.querySelector('.click-to-call, a.click-to-call');
    const h1r = h1?.getBoundingClientRect();
    const fr = form?.getBoundingClientRect();
    const hr = headerInner?.getBoundingClientRect();
    const ftr = footer?.getBoundingClientRect();
    const cr = call?.getBoundingClientRect();
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const base = {
      h1Y: h1r ? Math.round(h1r.top) : null,
      formLeftPct: fr ? Math.round((fr.left / vw) * 100) : null,
      formTopPx: fr ? Math.round(fr.top) : null,
      formLeftPx: fr ? Math.round(fr.left) : null,
      headerWidth: hr ? Math.round(hr.width) : null,
      overflowPx: Math.round(overflow),
      scrollWidth: document.documentElement.scrollWidth,
      footerBeforeH1: !!(ftr && h1r && ftr.top < h1r.top - 8),
      footerY: ftr ? Math.round(ftr.top) : null
    };
    const shellBg = shell ? getComputedStyle(shell).backgroundColor : null;
    const h1Style = h1 ? getComputedStyle(h1) : null;
    const ledeStyle = lede ? getComputedStyle(lede) : null;
    const ledeRect = lede?.getBoundingClientRect();
    let leftColumnBottomPx = h1r ? Math.round(h1r.bottom) : null;
    for (const el of [ledeBlock, deferredBlock]) {
      if (!el || getComputedStyle(el).display === 'none') continue;
      const b = el.getBoundingClientRect();
      if (b.height > 0) leftColumnBottomPx = Math.max(leftColumnBottomPx ?? 0, Math.round(b.bottom));
    }
    const formBottomPx = fr ? Math.round(fr.bottom) : null;
    const leftColumnToFormGapPx =
      leftColumnBottomPx != null && formBottomPx != null ? formBottomPx - leftColumnBottomPx : null;
    const deferredVisible = !!(
      deferredBlock &&
      getComputedStyle(deferredBlock).display !== 'none' &&
      deferredBlock.getBoundingClientRect().height > 8
    );
    const callTextOverflowPx = call ? Math.max(0, call.scrollWidth - call.clientWidth) : null;
    const extended = {
      heroBgRgb: shellBg,
      h1TextAlign: h1Style?.textAlign ?? null,
      ledeColor: ledeStyle?.color ?? null,
      ledeOpacity: ledeStyle?.opacity ?? null,
      ledeBbox: ledeRect
        ? {
            top: Math.round(ledeRect.top),
            bottom: Math.round(ledeRect.bottom),
            height: Math.round(ledeRect.height),
            width: Math.round(ledeRect.width)
          }
        : null,
      leftColumnBottomPx,
      formBottomPx,
      leftColumnToFormGapPx,
      deferredVisible,
      callTextOverflowPx,
      callBbox: cr
        ? {
            top: Math.round(cr.top),
            left: Math.round(cr.left),
            right: Math.round(cr.right),
            bottom: Math.round(cr.bottom),
            width: Math.round(cr.width),
            height: Math.round(cr.height),
            inViewport: cr.right <= vw && cr.left >= 0 && cr.bottom <= vh && cr.top >= 0
          }
        : null
    };
    if (!detail) return { ...base, ...extended };
    return { ...base, ...extended };
  }, { vw: viewport.width, vh: viewport.height, detail });
}

const jsonOut = process.argv.includes('--json');
const detailOut = process.argv.includes('--detail');
const routes = process.argv.slice(2).filter(
  (a) => a.startsWith('/') && (a.endsWith('/') || a.endsWith('.html')) && !a.startsWith('--')
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
    const m = await measure(page, server.baseUrl, route, vp, detailOut || jsonOut);
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
    (r.viewport === '390' && r.headerWidth != null && r.headerWidth > 392) ||
    (r.viewport === '390' && r.scrollWidth != null && r.scrollWidth > 392) ||
    (r.viewport === '1280' && r.overflowPx > 8) ||
    (r.viewport === '1280' && r.formLeftPct != null && r.formLeftPct < 50 && r.route.includes('health-insurance')) ||
    (r.viewport === '1280' &&
      r.deferredVisible &&
      r.leftColumnToFormGapPx != null &&
      r.leftColumnToFormGapPx > 120 &&
      r.leftColumnToFormGapPx < 250 &&
      !r.route.includes('/blog/')) ||
    (r.viewport === '390' && r.scrollWidth != null && r.scrollWidth > 392 && !r.route.includes('/blog/')) ||
    (r.viewport === '1280' && (r.callTextOverflowPx ?? 0) > 1)
);
if (!process.argv.includes('--no-fail')) {
  process.exit(bad.length ? 1 : 0);
}
