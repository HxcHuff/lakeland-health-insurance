#!/usr/bin/env node
import { writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const ROOT = resolve('/workspace');
const OUT = '/cursor/stores/self/internal/lead-form-mobile390-audit.json';
const VIEWPORT = { width: 390, height: 844 };

function walkHtml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (['node_modules', '.git', 'search-engine-from-zip'].includes(name)) continue;
      walkHtml(full, out);
    } else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function publicPath(file) {
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

function contentType(pathname) {
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8';
  if (pathname.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (pathname.endsWith('.woff2')) return 'font/woff2';
  return 'text/html; charset=utf-8';
}

function startServer() {
  return new Promise((res) => {
    const server = createServer((req, response) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        let p = decodeURIComponent(url.pathname);
        if (p.endsWith('/')) p += 'index.html';
        const body = readFileSync(join(ROOT, p.replace(/^\//, '')));
        response.writeHead(200, { 'Content-Type': contentType(p) });
        response.end(body);
      } catch {
        response.writeHead(404);
        response.end('missing');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      res({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r()))
      });
    });
  });
}

function relLuminance([r, g, b]) {
  const s = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}

function contrastRatio(fg, bg) {
  const L1 = relLuminance(fg);
  const L2 = relLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(str) {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

const candidates = walkHtml(ROOT).filter((f) => {
  const html = readFileSync(f, 'utf8');
  return (
    html.includes('class="lhi-lead-hero"') ||
    html.includes('class="sitelink-lead-form"') ||
    html.includes('data-lhi-site-lead-form')
  );
});

const server = await startServer();
const browser = await chromium.launch({ headless: true });
const results = [];

for (const file of candidates) {
  const url = publicPath(file);
  const page = await browser.newPage({ viewport: VIEWPORT });
  const fail = [];
  try {
    await page.route('**/js/site-template.js*', (route) => route.abort());
    await page.goto(`${server.baseUrl}${url}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    const metrics = await page.evaluate(() => {
      const header = document.querySelector('header');
      const h1 =
        document.querySelector('.answer-hero h1') ||
        document.querySelector('section.hero h1') ||
        document.querySelector('.lhi-hero-shell h1') ||
        document.querySelector('main h1') ||
        document.querySelector('h1');
      const form =
        document.querySelector('.lhi-lead-hero__card') ||
        document.querySelector('form.sitelink-lead-form') ||
        document.querySelector('form[data-lhi-site-lead-form]');
      const nameInput =
        document.querySelector('.lhi-lead-hero input[name="full_name"]') ||
        document.querySelector('form.sitelink-lead-form input[name="full_name"]');
      const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
      const h1Top = h1 ? h1.getBoundingClientRect().top : null;
      const formTop = nameInput
        ? nameInput.getBoundingClientRect().top
        : form
          ? form.getBoundingClientRect().top
          : null;
      const docWidth = document.documentElement.scrollWidth;
      const viewWidth = window.innerWidth;
      const inputs = [...document.querySelectorAll('.lhi-lead-hero input, .sitelink-lead-form input')].filter(
        (el) => el.type !== 'hidden' && el.offsetParent !== null
      );
      let inputOverflow = false;
      const card = form?.closest('.lhi-lead-hero__card') || form;
      const cardRect = card?.getBoundingClientRect();
      for (const input of inputs) {
        const r = input.getBoundingClientRect();
        if (cardRect && (r.right > cardRect.right + 1 || r.left < cardRect.left - 1)) inputOverflow = true;
      }
      const title = document.querySelector('.lhi-lead-hero__title, form.sitelink-lead-form h2');
      let titleContrast = null;
      if (title) {
        const cs = getComputedStyle(title);
        let bg = cs.backgroundColor;
        let node = title.parentElement;
        while (node && (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) {
          bg = getComputedStyle(node).backgroundColor;
          node = node.parentElement;
        }
        titleContrast = { fg: cs.color, bg: bg || 'rgb(255, 255, 255)' };
      }

      function effectiveBg(el) {
        let node = el;
        while (node) {
          const bg = getComputedStyle(node).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
          node = node.parentElement;
        }
        return 'rgb(255, 255, 255)';
      }

      const heroRoot =
        document.querySelector('.answer-hero, .medicare-hero, .article-hero') ||
        document.querySelector('.lhi-hero-shell section.answer-hero, .lhi-hero-shell section.hero') ||
        document.querySelector('section.hero');
      const heroContrastSamples = [];
      if (heroRoot) {
        const chipSel =
          '.lhi-proof-strip span, .lhi-proof-strip a, .hero-trust-row span, .hero-kicker, .eyebrow, .answer-snippet, .lead, .lhi-hero-lede, .medicare-direct-answer, .hero-identity, p.lead';
        for (const el of heroRoot.querySelectorAll(chipSel)) {
          const rect = el.getBoundingClientRect();
          if (rect.height < 1 || rect.width < 1) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          heroContrastSamples.push({
            tag: el.tagName,
            cls: (el.className || '').toString().slice(0, 48),
            fg: cs.color,
            bg: effectiveBg(el)
          });
        }
      }

      return {
        headerBottom,
        h1Top,
        formTop,
        horizontalScroll: docWidth > viewWidth + 1,
        inputOverflow,
        titleContrast,
        heroContrastSamples,
        hasH1: Boolean(h1),
        hasForm: Boolean(form)
      };
    });

    if (!metrics.hasForm) fail.push('no_lead_form_in_dom');
    if (metrics.hasH1 && metrics.h1Top < metrics.headerBottom - 2) fail.push('h1_under_header');
    if (metrics.formTop != null && metrics.formTop > VIEWPORT.height) fail.push('form_below_first_screen');
    if (metrics.horizontalScroll) fail.push('horizontal_scroll');
    if (metrics.inputOverflow) fail.push('input_overflow_card');

    if (metrics.titleContrast) {
      const fg = parseRgb(metrics.titleContrast.fg);
      const bg = parseRgb(metrics.titleContrast.bg);
      if (fg && bg && bg[3] !== 0) {
        const ratio = contrastRatio(fg, bg);
        if (ratio < 4.5) fail.push(`form_heading_contrast_${ratio.toFixed(2)}`);
      } else if (fg) {
        const ratio = contrastRatio(fg, [255, 255, 255]);
        if (ratio < 4.5) fail.push(`form_heading_contrast_assumed_${ratio.toFixed(2)}`);
      }
    }

    const heroContrastFails = [];
    for (const sample of metrics.heroContrastSamples || []) {
      const fg = parseRgb(sample.fg);
      const bg = parseRgb(sample.bg);
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      if (ratio < 4.5) {
        heroContrastFails.push({ ...sample, ratio: Number(ratio.toFixed(2)) });
      }
    }
    metrics.heroContrastFails = heroContrastFails;
    if (heroContrastFails.length) fail.push('hero_contrast_below_aa');

    results.push({ url, pass: fail.length === 0, failures: fail, metrics });
  } catch (e) {
    results.push({ url, pass: false, failures: ['load_error'], error: String(e.message || e) });
  } finally {
    await page.close();
  }
}

await browser.close();
await server.close();

const passCount = results.filter((r) => r.pass).length;
const failCount = results.length - passCount;
const isBlog = (url) => url.includes('/blog/');
const blogResults = results.filter((r) => isBlog(r.url));
const nonBlogResults = results.filter((r) => !isBlog(r.url));
const reasonCounts = {};
for (const row of results.filter((r) => !r.pass)) {
  for (const reason of row.failures) {
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }
}
const payload = {
  generatedAt: new Date().toISOString(),
  viewport: VIEWPORT,
  passCount,
  failCount,
  total: results.length,
  blog: {
    passCount: blogResults.filter((r) => r.pass).length,
    failCount: blogResults.filter((r) => !r.pass).length,
    total: blogResults.length
  },
  nonBlog: {
    passCount: nonBlogResults.filter((r) => r.pass).length,
    failCount: nonBlogResults.filter((r) => !r.pass).length,
    total: nonBlogResults.length
  },
  reasonCounts,
  failures: results.filter((r) => !r.pass).map(({ url, failures, metrics, error }) => ({ url, failures, metrics, error }))
};
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ passCount, failCount, total: results.length, out: OUT }));
