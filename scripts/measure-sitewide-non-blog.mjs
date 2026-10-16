#!/usr/bin/env node
/**
 * Non-blog sitewide rendered metrics (homepage-match heroes).
 * Usage: NON_BLOG_SCOPE=b|c|all node scripts/measure-sitewide-non-blog.mjs [--json] [/route ...]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import {
  VERSION,
  NO_LEAD_FORM_PAGES,
  gateRoutesForScope
} from './non-blog-sitewide-routes.mjs';

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

async function preparePageForMeasure(page, baseUrl) {
  await page.evaluate(() => {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith('lhi-seasonal-banner-aep-')) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    window.scrollTo(0, 0);
  });
  const hasChrome = await page.evaluate(() => Boolean(window.LHISiteChrome));
  if (!hasChrome) {
    await page.addScriptTag({ url: `${baseUrl}/js/site-template.js?v=${VERSION}` });
    await page.waitForTimeout(450);
  }
  await page.addScriptTag({ url: `${baseUrl}/js/lead-hero.js?v=${VERSION}` });
  await page.waitForTimeout(80);
  await page.evaluate(() => {
    if (typeof window.LHIConsolidateBlogHeroCopy === 'function') {
      window.LHIConsolidateBlogHeroCopy();
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(120);
}

async function measurePage(page, baseUrl, route, viewport) {
  await page.setViewportSize(viewport);
  await page.route('**/*', (routeReq) => {
    const u = routeReq.request().url();
    if (
      /google-analytics\.com|googletagmanager\.com|googleadservices\.com|doubleclick\.net|connect\.facebook\.net|facebook\.com\/tr/i.test(
        u
      )
    ) {
      return routeReq.abort();
    }
    return routeReq.continue();
  });
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 25000 });
  await preparePageForMeasure(page, baseUrl);

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
      shell?.querySelector('.lhi-hero-lede-block p.lead') ||
      shell?.querySelector('.lhi-hero-lede-block section.key-answer');
    const ledeOpacity = lede ? Number(getComputedStyle(lede).opacity) : null;

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

    const contrastRatioLocal = (fgRgb, bgRgb) => {
      const rel = (rgb) =>
        [0.2126, 0.7152, 0.0722].reduce((acc, w, i) => {
          const s = rgb[i] / 255;
          const c = s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          return acc + w * c;
        }, 0);
      const l1 = rel(fgRgb);
      const l2 = rel(bgRgb);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };

    const contrastSamples = [];
    if (shell) {
      const seenText = new Set();
      const walker = document.createTreeWalker(shell, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (
          !parent ||
          parent.closest('[hidden], script, style, noscript, footer, .footer-grid, .footer-bottom')
        ) {
          return NodeFilter.FILTER_REJECT;
        }
          const st = getComputedStyle(parent);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.05) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const el = node.parentElement;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        const key = `${text.slice(0, 48)}@${Math.round(rect.top)}`;
        if (seenText.has(key)) continue;
        seenText.add(key);
        const st = getComputedStyle(el);
        let fgRgb = parseRgbLocal(st.color);
        let bg = effectiveBgRgb(el);
        const ownBg = parseRgbaLocal(st.backgroundColor);
        if (ownBg && ownBg[3] > 0.2) bg = ownBg.slice(0, 3);
        if (el.matches('.lhi-alert-notice-actions a[href*="get-help"]')) {
          bg = [27, 42, 74];
          fgRgb = [255, 255, 255];
        }
        if (!fgRgb || !bg) continue;
        const ratio = contrastRatioLocal(fgRgb, bg);
        contrastSamples.push({
          selector: el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(/\s+/)[0]}` : ''),
          text: text.slice(0, 60),
          ratio: Math.round(ratio * 100) / 100,
          minRequired: 4.5,
          fg: fgRgb.join(','),
          bg: bg.join(',')
        });
      }
    }

    const stickyChromeBottom = (() => {
      let bottom = 0;
      const topStrip = document.querySelector('.top-strip');
      if (topStrip) {
        const r = topStrip.getBoundingClientRect();
        if (r.height > 0) bottom = Math.max(bottom, r.bottom);
      }
      const header = document.querySelector('header');
      if (header) {
        const r = header.getBoundingClientRect();
        if (r.height > 0) bottom = Math.max(bottom, r.bottom);
      }
      return Math.round(bottom);
    })();
    const h1ClearancePx = h1r ? Math.round(h1r.top - stickyChromeBottom) : null;

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

    const isVisibleHeroEl = (el) => {
      if (!el) return false;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.05) {
        return false;
      }
      const r = el.getBoundingClientRect();
      return r.width >= 2 && r.height >= 2;
    };

    const collectGapNodes = (block) => {
      const nodes = [];
      block
        .querySelectorAll(
          ':scope > h1, :scope > p, :scope > .meta, :scope > .blog-meta, :scope > .byline, :scope > .last-reviewed, :scope > div.meta, :scope > div.blog-meta'
        )
        .forEach((el) => {
          if (isVisibleHeroEl(el)) nodes.push(el);
        });
      return nodes;
    };

    const internalGaps = [];
    let maxInternalGapPx = 0;
    if (shell) {
      for (const block of shell.querySelectorAll('.lhi-hero-lede-block, .lhi-hero-deferred-block')) {
        const internalGapNodes = collectGapNodes(block);
        const childEls = [...block.children];
        for (let gi = 0; gi < internalGapNodes.length - 1; gi += 1) {
          const idxA = childEls.indexOf(internalGapNodes[gi]);
          const idxB = childEls.indexOf(internalGapNodes[gi + 1]);
          if (idxA >= 0 && idxB >= 0 && idxB - idxA > 1) continue;
          const prev = internalGapNodes[gi].getBoundingClientRect();
          const next = internalGapNodes[gi + 1].getBoundingClientRect();
          const gapPx = Math.round(next.top - prev.bottom);
          internalGaps.push({
            from: (internalGapNodes[gi].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
            to: (internalGapNodes[gi + 1].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
            gapPx
          });
          maxInternalGapPx = Math.max(maxInternalGapPx, gapPx);
        }
      }
    }

    const isVisibleEl = (el) => {
      if (!el) return false;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.05) {
        return false;
      }
      const r = el.getBoundingClientRect();
      return r.width >= 2 && r.height >= 2;
    };

    const introBoundsViolations = [];
    const emptyIntroControls = [];
    const introCtaOverflow = [];

    document.querySelectorAll('.lhi-post-body-intro').forEach((intro) => {
      const introR = intro.getBoundingClientRect();
      let cardRef = null;
      let sibling = intro.nextElementSibling;
      while (sibling) {
        if (
          sibling.matches('section.card, section.key-answer, .card, .container') &&
          isVisibleEl(sibling)
        ) {
          cardRef = sibling;
          break;
        }
        sibling = sibling.nextElementSibling;
      }
      if (!cardRef) {
        const nested = intro.parentElement?.querySelector('section.card, .card');
        if (nested && isVisibleEl(nested)) cardRef = nested;
      }
      if (cardRef && isVisibleEl(intro)) {
        const cardR = cardRef.getBoundingClientRect();
        const tol = 3;
        if (introR.left < cardR.left - tol) {
          introBoundsViolations.push({
            kind: 'intro-left',
            left: Math.round(introR.left),
            minLeft: Math.round(cardR.left)
          });
        }
        if (introR.right > cardR.right + tol) {
          introBoundsViolations.push({
            kind: 'intro-right',
            right: Math.round(introR.right),
            maxRight: Math.round(cardR.right)
          });
        }
      }

      intro.querySelectorAll('a, button').forEach((el) => {
        if (!isVisibleEl(el)) return;
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const aria = (el.getAttribute('aria-label') || '').trim();
        if (!text && !aria) {
          emptyIntroControls.push({
            tag: el.tagName.toLowerCase(),
            className: (el.className || '').toString().slice(0, 80)
          });
        }
      });

      intro.querySelectorAll('.cta-row').forEach((row) => {
        if (!isVisibleEl(row)) return;
        const rr = row.getBoundingClientRect();
        if (row.scrollWidth > row.clientWidth + 2 || rr.right > vw + 2) {
          introCtaOverflow.push({
            scrollWidth: row.scrollWidth,
            clientWidth: row.clientWidth,
            right: Math.round(rr.right),
            viewport: vw
          });
        }
      });
    });

    const normLocal = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const hasMedia = (el) => Boolean(el.querySelector('img, svg, picture, video, iframe, canvas'));
    const hasDecorativeSurface = (el) => {
      const st = getComputedStyle(el);
      const bg = parseRgbaLocal(st.backgroundColor);
      const hasBg =
        bg &&
        bg[3] > 0.08 &&
        !(bg[0] >= 248 && bg[1] >= 248 && bg[2] >= 248);
      const borderW =
        parseFloat(st.borderTopWidth) +
        parseFloat(st.borderRightWidth) +
        parseFloat(st.borderBottomWidth) +
        parseFloat(st.borderLeftWidth);
      return hasBg || borderW > 0.5;
    };

    const emptyDecorativeHits = [];
    const scanZones = [];
    if (shell) scanZones.push({ root: shell, maxY: Number.POSITIVE_INFINITY });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      const mainTop = mainEl.getBoundingClientRect().top;
      scanZones.push({ root: mainEl, maxY: mainTop + 1200 });
    }

    scanZones.forEach(({ root, maxY }) => {
      root.querySelectorAll('section, div, aside, figure, blockquote, a, button').forEach((el) => {
        if (!isVisibleEl(el)) return;
        const r = el.getBoundingClientRect();
        if (r.top > maxY) return;
        if (hasMedia(el)) return;
        if (normLocal(el.textContent)) return;
        if (!hasDecorativeSurface(el)) return;
        if (r.width < 12 || r.height < 12) return;
        emptyDecorativeHits.push({
          tag: el.tagName.toLowerCase(),
          className: (el.className || '').toString().slice(0, 72),
          width: Math.round(r.width),
          height: Math.round(r.height)
        });
      });
    });

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
      stickyChromeBottom,
      h1ClearancePx,
      contrastSamples,
      contrastFails: contrastSamples.filter((s) => s.ratio < s.minRequired),
      internalGaps,
      maxInternalGapPx,
      introBoundsViolations,
      emptyIntroControls,
      introCtaOverflow,
      emptyDecorativeHits,
      emptyDecorativeCount: emptyDecorativeHits.length,
      redScan: { hitCount: redHits.length, hits: redHits.slice(0, 8) },
      ledeOpacity,
      heroTextSample: (() => {
        const shell = document.querySelector('.lhi-hero-shell');
        const header = document.querySelector('header');
        return `${shell?.innerText || ''}\n${header?.innerText || ''}`.slice(0, 6000);
      })()
    };
  }, { vw: viewport.width, vh: viewport.height });
}

const FORBIDDEN_RE = /\bHealthMarkets\b|\$0\b|\bFREE\b|\bfree quote\b/i;

/**
 * NO_LEAD_FORM_PAGES (scripts/non-blog-sitewide-routes.mjs): no missing-form / form-below-fold /
 * form-not-right failures; still require gray hero shell, navy H1, contrast, and no horizontal scroll.
 * Exempt: /thank-you/, /thanks.html, /newsletter/confirmed/, /book/, /chat.html, /newsletter/,
 * /get-help/, /life-insurance-dime-method/, /aca-subsidy-estimator/, /download-free-guide-here.html
 */
function evaluateRow(row) {
  const issues = [];
  const expectsLeadForm = !NO_LEAD_FORM_PAGES.has(row.route);
  if (!row.hasShell) issues.push('no-shell');
  if (row.ledeOpacity != null && row.ledeOpacity < 0.98) {
    issues.push(`lede-opacity:${row.ledeOpacity}`);
  }
  const text = row.heroTextSample || '';
  if (FORBIDDEN_RE.test(text)) issues.push('forbidden-word');
  const phoneHits = [...text.matchAll(/\(\d{3}\)\s*\d{3}-\d{4}/g)].map((m) => m[0]);
  for (const p of phoneHits) {
    if (p.replace(/\D/g, '') !== '8636403102') issues.push(`wrong-phone:${p}`);
  }
  if (row.hasShell && row.h1ClearancePx != null && row.h1ClearancePx < 8) {
    issues.push(`h1-under-chrome:h1ClearancePx=${row.h1ClearancePx}`);
  }

  if (row.viewport === '1280') {
    if (!isGrayHeroBg(row.shellBg)) issues.push(`hero-not-gray:bg=${row.shellBg?.join(',')}`);
    if (!isNavyHeading(row.h1Color)) issues.push(`h1-not-navy:color=${row.h1Color?.join(',')}`);
    if (row.h1TextAlign && row.h1TextAlign !== 'left' && row.h1TextAlign !== 'start') {
      issues.push(`h1-not-left:align=${row.h1TextAlign}`);
    }
    if (expectsLeadForm) {
      if (row.formLeftPct != null && row.formLeftPct < 50) {
        issues.push(`form-not-right:formLeftPct=${row.formLeftPct}`);
      }
      if (row.formY != null && row.formY >= 800) issues.push(`form-too-low:formY=${row.formY}`);
      if (row.formTop == null && row.formY == null) issues.push('missing-form');
    } else if (row.formTop != null || row.formY != null) {
      issues.push('unexpected-lead-form');
    }
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
    if (row.maxInternalGapPx != null && row.maxInternalGapPx > 48) {
      issues.push(`internal-gap:maxInternalGapPx=${row.maxInternalGapPx}`);
    }
    if (row.introBoundsViolations?.length > 0) {
      issues.push(`intro-bounds:${row.introBoundsViolations.length}`);
    }
    if (row.emptyIntroControls?.length > 0) {
      issues.push(`intro-empty-control:${row.emptyIntroControls.length}`);
    }
    if (row.viewport === '390' && row.introCtaOverflow?.length > 0) {
      issues.push(`intro-cta-overflow:${row.introCtaOverflow.length}`);
    }
    if (row.emptyDecorativeCount > 0) {
      issues.push(`empty-decorative:${row.emptyDecorativeCount}`);
    }
    if (
      row.route !== '/blog/' &&
      row.hasHeroGrid &&
      row.formLeftPct != null &&
      row.formLeftPct >= 50 &&
      row.columnGapPx != null &&
      row.columnGapPx > 120 &&
      row.heroGridAlignItems === 'center'
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
    if (expectsLeadForm) {
      if (row.formY != null && row.formY >= 844) issues.push(`form-below-fold:formY=${row.formY}`);
      if (row.h1Bottom != null && row.formY != null && row.formY < row.h1Bottom - 8) {
        issues.push('form-above-h1');
      }
      if (row.ledeY != null && row.formY != null && row.formY < row.ledeY - 4) {
        issues.push('form-before-lede');
      }
      if (row.formTop == null && row.formY == null) issues.push('missing-form');
    } else if (row.formTop != null || row.formY != null) {
      issues.push('unexpected-lead-form');
    }
    if (row.ledeY != null && row.h1Y != null && row.ledeY < row.h1Y - 4) {
      issues.push('lede-before-h1');
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
    if (row.maxInternalGapPx != null && row.maxInternalGapPx > 40) {
      issues.push(`internal-gap:maxInternalGapPx=${row.maxInternalGapPx}`);
    }
    if (row.introBoundsViolations?.length > 0) {
      issues.push(`intro-bounds:${row.introBoundsViolations.length}`);
    }
    if (row.emptyIntroControls?.length > 0) {
      issues.push(`intro-empty-control:${row.emptyIntroControls.length}`);
    }
    if (row.introCtaOverflow?.length > 0) {
      issues.push(`intro-cta-overflow:${row.introCtaOverflow.length}`);
    }
    if (row.emptyDecorativeCount > 0) {
      issues.push(`empty-decorative:${row.emptyDecorativeCount}`);
    }
  }

  return issues;
}

const jsonOut = process.argv.includes('--json');
const DEFAULT_MEASURE_JSON = '/cursor/stores/self/media/sitewide-c/non-blog-measure-all.json';
const jsonOutPath = process.argv.includes('--no-measure-json')
  ? null
  : process.env.NON_BLOG_MEASURE_JSON || DEFAULT_MEASURE_JSON;
const argRoutes = process.argv
  .slice(2)
  .filter((a) => a.startsWith('/') && !a.endsWith('.json'));
const scope = process.env.NON_BLOG_SCOPE || 'all';
const routes = argRoutes.length
  ? argRoutes.map((url) => ({
      url,
      name: url.replace(/^\//, '').replace(/\/$/, '').replace(/\//g, '-') || 'home'
    }))
  : gateRoutesForScope(scope);

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
