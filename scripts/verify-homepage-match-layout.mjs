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

    const shellLead =
      shell.querySelector(':scope > .lhi-hero-grid-lead') ||
      shell.querySelector('.hero-grid .lhi-hero-grid-lead, .answer-grid .lhi-hero-grid-lead');
    const formCard = shell.querySelector('.lhi-hero-grid-lead .lhi-lead-hero__card, .lhi-hero-grid-lead .lhi-lead-hero__card');
    const ledeBlock = shell.querySelector('.lhi-hero-lede-block');
    const ledeHeading = shell.querySelector('section.answer-hero h1, section.hero h1, .lhi-hero-shell h1');
    const ledeParagraph = shell.querySelector('.lhi-hero-lede, p.lead.lhi-hero-lede');
    const lede = ledeBlock || ledeHeading;
    const hero = shell.querySelector('section.hero, section.answer-hero, section.home-hero');
    const shellDeferred =
      shell.querySelector(':scope > .lhi-hero-deferred-block') ||
      shell.querySelector('.hero-grid .lhi-hero-deferred-block, .answer-grid .lhi-hero-deferred-block');

    const issues = [];
    const lum = (rgb) => (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    const parseRgb = (color) => {
      const m = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? m.slice(1, 4).map(Number) : null;
    };

    if (shellLead && hero && vw >= 900) {
      const heroStyle = getComputedStyle(hero);
      const heroBg = heroStyle.backgroundImage || '';
      const heroColorStr = heroStyle.backgroundColor || '';
      const heroColor = parseRgb(heroColorStr);
      const heroTransparent = heroColorStr.includes('rgba(0, 0, 0, 0)') || heroStyle.display === 'contents';
      if (heroBg.includes('gradient') || (!heroTransparent && heroColor && lum(heroColor) < 0.35)) {
        issues.push('hero-gradient-or-dark-bg');
      }
      const kicker = shell.querySelector('.hero-kicker');
      if (kicker) {
        const br = parseFloat(getComputedStyle(kicker).borderRadius) || 0;
        const kBg = parseRgb(getComputedStyle(kicker).backgroundColor);
        if (br > 30 || (kBg && lum(kBg) < 0.45 && br > 8)) issues.push('city-pill-kicker');
      }
    }

    const contrastRoots = shell.querySelectorAll(
      '.lhi-hero-lede-block p, :scope > .lhi-hero-deferred-block p, .hero-kicker, .lhi-hero-shell h1'
    );
    for (const el of contrastRoots) {
      if (!el.isConnected) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const fg = parseRgb(style.color);
      const shellBg = parseRgb(getComputedStyle(shell).backgroundColor) || [248, 250, 252];
      if (fg && lum(fg) > 0.82 && lum(shellBg) > 0.75) {
        issues.push(`white-on-light:${el.tagName}.${[...el.classList].slice(0, 2).join('.')}`);
      }
    }

    if (vw >= 900 && formCard && ledeBlock && shellDeferred) {
      const lr = ledeBlock.getBoundingClientRect();
      const dr = shellDeferred.getBoundingClientRect();
      const fr = formCard.getBoundingClientRect();
      const ledeToDeferred = dr.top - lr.bottom;
      if (ledeToDeferred > 160) {
        issues.push(`left-column-gap:ledeToDeferred=${Math.round(ledeToDeferred)}`);
      }
      if (ledeToDeferred > 220 && dr.top > lr.bottom + 180 && fr.top <= lr.bottom + 40) {
        issues.push('deferred-pushed-down-beside-form');
      }
    }

    if (vw < 900 && shellLead && formCard && lede) {
      const fr = formCard.getBoundingClientRect();
      const lr = lede.getBoundingClientRect();
      const lp = ledeParagraph?.getBoundingClientRect();
      const lh = ledeHeading?.getBoundingClientRect();
      const ledeBottom = ledeBlock
        ? lr.bottom
        : Math.max(lh?.bottom ?? 0, lp?.bottom ?? lr.bottom);
      if (fr.y > vh - 48) issues.push(`form-below-fold:formY=${Math.round(fr.y)} vh=${vh}`);
      if (fr.y > ledeBottom + 280) issues.push(`form-too-far-below-lede:gap=${Math.round(fr.y - ledeBottom)}`);
      const sticky = document.querySelector('.lhi-lead-sticky.is-visible, #lhi-lead-sticky-bar.is-visible');
      if (sticky) issues.push('sticky-bar-visible');
      const heroPanel = shell.querySelector('.hero-panel');
      if (heroPanel && getComputedStyle(heroPanel).display !== 'none') {
        issues.push('hero-panel-visible-mobile');
      }
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
