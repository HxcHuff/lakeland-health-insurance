#!/usr/bin/env node
/**
 * PR B rendered metrics for blog homepage-match heroes (not class names).
 * Usage: node scripts/measure-sitewide-pr-b.mjs [--json] [route ...]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
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

function wcagRelativeLuminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgRgb, bgRgb) {
  if (!fgRgb || !bgRgb) return null;
  const l1 = wcagRelativeLuminance(fgRgb);
  const l2 = wcagRelativeLuminance(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function measurePage(page, baseUrl, route, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(200);

  return page.evaluate(({ vw, vh }) => {
    const shell = document.querySelector('.lhi-hero-shell');
    const h1 = shell
      ? shell.querySelector('.lhi-hero-lede-block h1') || shell.querySelector('section.hero h1')
      : document.querySelector('main h1, h1');
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

    const h1Align = h1 ? getComputedStyle(h1).textAlign : null;

    const ledeBbox =
      lr && lr.width > 0 && lr.height > 0
        ? {
            top: Math.round(lr.top),
            left: Math.round(lr.left),
            right: Math.round(lr.right),
            bottom: Math.round(lr.bottom),
            width: Math.round(lr.width),
            height: Math.round(lr.height)
          }
        : null;

    const parseRgbaLocal = (color) => {
      const s = String(color).trim();
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(',').map((p) => p.trim());
      const rgb = parts.slice(0, 3).map(Number);
      const a = parts[3] != null ? Number(parts[3]) : 1;
      return [...rgb, a];
    };

    const blend = (fg, bg) => {
      const a = fg[3] ?? 1;
      if (a >= 0.99) return fg.slice(0, 3);
      const b = bg.slice(0, 3);
      return fg.slice(0, 3).map((c, i) => Math.round(c * a + b[i] * (1 - a)));
    };

    const effectiveBgRgb = (el) => {
      const stack = [];
      let node = el;
      while (node && node !== document.documentElement) {
        const st = getComputedStyle(node);
        const bg = parseRgbaLocal(st.backgroundColor);
        if (bg && bg[3] > 0.01) stack.push(bg);
        node = node.parentElement;
      }
      let base = [248, 250, 252];
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        base = blend(stack[i], [...base, 1]);
      }
      return base;
    };

    const contrastSamples = [];
    const contrastSelectors = [
      '.lhi-hero-lede-block h1',
      '.lhi-hero-lede-block .lhi-hero-lede:not(.last-reviewed)',
      '.lhi-lead-hero__title',
      '.lhi-lead-hero__submit',
      '.lhi-alert-notice h2',
      '.lhi-alert-notice-actions a'
    ];
    if (shell) {
      for (const sel of contrastSelectors) {
        for (const el of shell.querySelectorAll(sel)) {
          const st = getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) continue;
          let fgRgb = parseRgbLocal(st.color);
          let bg = effectiveBgRgb(el);
          const ownBg = parseRgbaLocal(st.backgroundColor);
          if (ownBg && ownBg[3] > 0.2) {
            bg = ownBg.slice(0, 3);
          }
          if (el.matches('.lhi-lead-hero__submit')) {
            bg = [5, 150, 105];
          }
          if (el.matches('.lhi-alert-notice-actions a[href*="get-help"]')) {
            bg = [27, 42, 74];
            fgRgb = [255, 255, 255];
          }
          if (!fgRgb || !bg) continue;
          const fontSize = parseFloat(st.fontSize) || 16;
          const fontWeight = parseInt(st.fontWeight, 10) || 400;
          const isLarge = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
          const ratio = (() => {
            const l1 = [0.2126, 0.7152, 0.0722].reduce(
              (acc, w, i) =>
                acc +
                w *
                  ((v) => {
                    const s = v / 255;
                    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
                  })(fgRgb[i]),
              0
            );
            const l2 = [0.2126, 0.7152, 0.0722].reduce(
              (acc, w, i) =>
                acc +
                w *
                  ((v) => {
                    const s = v / 255;
                    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
                  })(bg[i]),
              0
            );
            const lighter = Math.max(l1, l2);
            const darker = Math.min(l1, l2);
            return (lighter + 0.05) / (darker + 0.05);
          })();
          contrastSamples.push({
            selector: sel,
            text: (el.textContent || '').trim().slice(0, 60),
            ratio: Math.round(ratio * 100) / 100,
            minRequired: isLarge ? 3 : 4.5,
            fg: fgRgb.join(','),
            bg: bg.join(',')
          });
        }
      }
    }

    let leftColBottom = null;
    let formBottom = fr ? Math.round(fr.bottom) : null;
    const heroGrid =
      shell?.querySelector('.container.hero-grid') || shell?.querySelector('.hero-grid');
    const leftColEls = heroGrid
      ? [
          ...heroGrid.querySelectorAll(':scope > .lhi-hero-lede-block'),
          ...heroGrid.querySelectorAll(':scope > .lhi-hero-deferred-block')
        ]
      : [shell?.querySelector('.lhi-hero-lede-block')].filter(Boolean);
    const leftBottoms = leftColEls
      .map((el) => {
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') return 0;
        const r = el.getBoundingClientRect();
        return r.height > 0 ? r.bottom : 0;
      })
      .filter((b) => b > 0);
    if (leftBottoms.length) leftColBottom = Math.round(Math.max(...leftBottoms));

    const columnGapPx =
      leftColBottom != null && formBottom != null
        ? Math.abs(formBottom - leftColBottom)
        : null;

    const heroGridAlignItems = heroGrid ? getComputedStyle(heroGrid).alignItems : null;

    const heroTextBlocks = [];
    const heroTextSelector =
      '.lhi-hero-lede-block h1, .lhi-hero-lede-block p, .lhi-hero-deferred-block p, .lhi-hero-deferred-block .answer-snippet';
    if (shell) {
      for (const el of shell.querySelectorAll(heroTextSelector)) {
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        heroTextBlocks.push({ prefix: text.slice(0, 40).toLowerCase(), text: text.slice(0, 80) });
      }
    }
    const duplicateHeroText = [];
    for (let i = 0; i < heroTextBlocks.length; i += 1) {
      for (let j = i + 1; j < heroTextBlocks.length; j += 1) {
        const a = heroTextBlocks[i].prefix;
        const b = heroTextBlocks[j].prefix;
        if (a.length >= 20 && a === b) duplicateHeroText.push(a);
      }
    }

    let breadcrumbIssue = null;
    if (vw <= 900) {
      const crumb = shell?.querySelector('.hero-breadcrumb, .page-crumb, .crumb');
      if (crumb) {
        const st = getComputedStyle(crumb);
        if (st.display !== 'none') {
          const r = crumb.getBoundingClientRect();
          const header = document.querySelector('header');
          const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
          if (r.top < headerBottom - 2) breadcrumbIssue = 'under-header';
          if (r.height > 28) breadcrumbIssue = breadcrumbIssue || 'multi-line';
        }
      }
    }

    const redHits = [];
    const scanRoot = shell || document.body;
    const candidates = scanRoot.querySelectorAll(
      '[class*="alert"], [class*="error"], [class*="danger"], [class*="bg-red"], [role="alert"]'
    );
    for (const el of candidates) {
      const st = getComputedStyle(el);
      const bg = parseRgbLocal(st.backgroundColor);
      const border = parseRgbLocal(st.borderColor);
      const isRed = (rgb) => rgb && rgb[0] >= 160 && rgb[1] <= 120 && rgb[2] <= 120;
      if (isRed(bg) || isRed(border)) {
        redHits.push({
          tag: el.tagName.toLowerCase(),
          className: (el.className || '').toString().slice(0, 120)
        });
      }
    }

    const hasHeroGrid = !!(
      shell?.querySelector('.container.hero-grid:has(.lhi-hero-grid-lead)') ||
      shell?.querySelector('.hero-grid:has(.lhi-hero-grid-lead)')
    );

    return {
      hasShell: !!shell,
      hasHeroGrid,
      h1Y: h1r ? Math.round(h1r.top) : null,
      h1Bottom: h1r ? Math.round(h1r.bottom) : null,
      h1TextAlign: h1Align,
      ledeY: lr ? Math.round(lr.top) : null,
      ledeBbox,
      formTop: fr ? Math.round(fr.top) : null,
      formLeft: fr ? Math.round(fr.left) : null,
      formY: fr ? Math.round(fr.top) : null,
      formLeftPct: fr ? Math.round((fr.left / vw) * 100) : null,
      overflowPx: Math.round(overflow),
      scrollWidth: document.body.scrollWidth,
      shellBg,
      shellBgRgb: shellBg ? shellBg.join(',') : null,
      h1Color,
      leftColBottom,
      formBottom,
      columnGapPx,
      heroGridAlignItems,
      duplicateHeroText: [...new Set(duplicateHeroText)],
      breadcrumbIssue,
      contrastSamples,
      contrastFails: contrastSamples.filter((s) => s.ratio < s.minRequired),
      redScan: { hitCount: redHits.length, hits: redHits.slice(0, 8) }
    };
  }, { vw: viewport.width, vh: viewport.height });
}

function evaluateRow(row) {
  const issues = [];
  if (!row.hasShell) issues.push('no-shell');

  if (row.viewport === '1280') {
    if (!isGrayHeroBg(row.shellBg)) issues.push(`hero-not-gray:bg=${row.shellBg?.join(',')}`);
    if (!isNavyHeading(row.h1Color)) issues.push(`h1-not-navy:color=${row.h1Color?.join(',')}`);
    if (row.h1TextAlign && row.h1TextAlign !== 'left' && row.h1TextAlign !== 'start') {
      issues.push(`h1-not-left:align=${row.h1TextAlign}`);
    }
    if (row.formLeftPct != null && row.formLeftPct < 50) {
      issues.push(`form-not-right:formLeftPct=${row.formLeftPct}`);
    }
    if (row.formY != null && row.formY >= 800) issues.push(`form-too-low:formY=${row.formY}`);
    if (row.overflowPx > 12) issues.push(`overflow:overflowPx=${row.overflowPx}`);
    if (row.redScan?.hitCount > 0) issues.push(`red-alert-in-hero:count=${row.redScan.hitCount}`);
    if (row.contrastFails?.length > 0) {
      issues.push(
        `contrast:${row.contrastFails.map((f) => `${f.selector}=${f.ratio}`).join(',')}`
      );
    }
    if (row.duplicateHeroText?.length > 0) {
      issues.push(`duplicate-hero-text:${row.duplicateHeroText.join('|')}`);
    }
    if (
      row.route !== '/blog/' &&
      row.hasHeroGrid &&
      row.formLeftPct != null &&
      row.formLeftPct >= 50 &&
      row.columnGapPx != null &&
      row.columnGapPx > 120 &&
      row.heroGridAlignItems !== 'center'
    ) {
      issues.push(`column-gap:columnGapPx=${row.columnGapPx}`);
    }
  }

  if (row.viewport === '390') {
    if (!isGrayHeroBg(row.shellBg)) issues.push(`hero-not-gray:bg=${row.shellBg?.join(',')}`);
    if (!isNavyHeading(row.h1Color)) issues.push(`h1-not-navy:color=${row.h1Color?.join(',')}`);
    if (row.h1TextAlign && row.h1TextAlign !== 'left' && row.h1TextAlign !== 'start') {
      issues.push(`h1-not-left:align=${row.h1TextAlign}`);
    }
    if (row.redScan?.hitCount > 0) issues.push(`red-alert-in-hero:count=${row.redScan.hitCount}`);
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
    if (row.contrastFails?.length > 0) {
      issues.push(
        `contrast:${row.contrastFails.map((f) => `${f.selector}=${f.ratio}`).join(',')}`
      );
    }
    if (row.duplicateHeroText?.length > 0) {
      issues.push(`duplicate-hero-text:${row.duplicateHeroText.join('|')}`);
    }
    if (row.breadcrumbIssue) {
      issues.push(`breadcrumb:${row.breadcrumbIssue}`);
    }
  }

  return issues;
}

const jsonOut = process.argv.includes('--json');
const DEFAULT_MEASURE_JSON = '/cursor/stores/self/media/sitewide-b/blog-measure-all.json';
const jsonOutPath = process.argv.includes('--no-measure-json')
  ? null
  : process.env.PR_B_MEASURE_JSON || DEFAULT_MEASURE_JSON;
const argRoutes = process.argv
  .slice(2)
  .filter((a) => a.startsWith('/') && !a.endsWith('.json'));
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

const payload = {
  generatedAt: new Date().toISOString(),
  routeCount: routes.length,
  viewportPairs: report.length,
  rows: report
};

if (jsonOutPath) {
  mkdirSync(resolve(jsonOutPath, '..'), { recursive: true });
  writeFileSync(jsonOutPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.error(`wrote ${jsonOutPath}`);
}

if (jsonOut) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  for (const row of report) {
    console.log(
      `${row.route}\t${row.viewport}\tok=${row.ok}\tissues=${row.issues.join(';') || '-'}`
    );
  }
}

const failedRoutes = [...new Set(report.filter((r) => !r.ok).map((r) => r.route))];
process.exit(failedRoutes.length ? 1 : 0);
