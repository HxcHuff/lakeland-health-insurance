#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { allCaptureRoutes } from './homepage-match-routes.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const EXCEPTIONS = new Set(['/medicare/', '/blog/orlando-health-watson-clinic-insurance-2026.html']);

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

function parseRgb(color) {
  const m = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? m.slice(1, 4).map(Number) : null;
}

function luminance([r, g, b]) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

async function checkPage(page, url, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);

  return page.evaluate(({ vh, vw }) => {
    const shell = document.querySelector('.lhi-hero-shell');
    if (!shell) return { ok: false, reason: 'no shell' };

    const formCard = shell.querySelector('.lhi-hero-grid-lead .lhi-lead-hero__card, .lhi-hero-grid-lead .lhi-lead-hero__card');
    const lede = shell.querySelector('.lhi-hero-lede-block') || shell.querySelector('.answer-hero h1')?.closest('div') || shell.querySelector('h1');
    const hero = shell.querySelector('section.hero, section.answer-hero, section.home-hero');

    const issues = [];

    const textEls = shell.querySelectorAll('p, .lhi-hero-deferred-block, .hero-kicker, h1, h2.lhi-lead-hero__title');
    for (const el of textEls) {
      if (!el.offsetParent && getComputedStyle(el).display === 'none') continue;
      const fg = getComputedStyle(el).color;
      const bgEl = el.closest('.lhi-hero-shell') || el;
      const bg = getComputedStyle(bgEl).backgroundColor;
      const fgM = fg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      const bgM = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (fgM && bgM) {
        const f = fgM.slice(1, 4).map(Number);
        const b = bgM.slice(1, 4).map(Number);
        const fl = (0.299 * f[0] + 0.587 * f[1] + 0.114 * f[2]) / 255;
        const bl = (0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2]) / 255;
        if (Math.abs(fl - bl) < 0.15 && fl > 0.75) issues.push(`low-contrast:${el.tagName}.${[...el.classList].join('.')}`);
      }
    }

    if (vw >= 900 && formCard && lede && hero) {
      const fr = formCard.getBoundingClientRect();
      const lr = lede.getBoundingClientRect();
      const hr = hero.getBoundingClientRect();
      if (hr.height > lr.height + 140 && fr.height > lr.height + 80) {
        issues.push(`left-column-gap:heroH=${Math.round(hr.height)} ledeH=${Math.round(lr.height)} formH=${Math.round(fr.height)}`);
      }
    }

    if (vw < 900 && formCard && lede) {
      const fr = formCard.getBoundingClientRect();
      const lr = lede.getBoundingClientRect();
      if (fr.y > vh - 24) issues.push(`form-below-fold:formY=${Math.round(fr.y)} vh=${vh}`);
      if (fr.y > lr.bottom + 360) issues.push(`form-too-far-below-lede:gap=${Math.round(fr.y - lr.bottom)}`);
    }

    return { ok: issues.length === 0, issues };
  }, { vh: viewport.height, vw: viewport.width });
}

const server = await startServer();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});

const SKIP_NAMES = new Set(['home', 'aca-subsidy-estimator']);
const routes = allCaptureRoutes().filter((r) => !EXCEPTIONS.has(r.url) && !SKIP_NAMES.has(r.name));
const failures = [];
let pass = 0;
let total = 0;

try {
  const page = await browser.newPage();
  await page.route('**/js/site-template.js*', (route) => route.abort());

  for (const { url, name } of routes) {
    for (const vp of [
      { width: 1280, height: 800, tag: '1280' },
      { width: 390, height: 844, tag: '390' }
    ]) {
      total += 1;
      const fullUrl = `${server.baseUrl}${url}`;
      const result = await checkPage(page, fullUrl, vp);
      if (result.ok) pass += 1;
      else failures.push({ name, url, viewport: vp.tag, issues: result.issues || [result.reason] });
    }
  }
  await page.close();
} finally {
  await browser.close();
  await server.close();
}

console.log(JSON.stringify({ pass, fail: failures.length, total, failures }, null, 2));
process.exit(failures.length ? 1 : 0);
