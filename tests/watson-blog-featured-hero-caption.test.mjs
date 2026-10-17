import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const CHROME_PATH = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome';
const WATSON =
  '/blog/orlando-health-watson-clinic-2027-plan.html';
const CONTROL_POSTS = [
  '/blog/medicare-advantage-lakeland-2026.html',
  '/blog/orlando-health-watson-clinic-insurance-2026.html',
  '/blog/medigap-plan-g-vs-plan-n.html'
];

function startStaticServer() {
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const filePath = join(ROOT, pathname.replace(/^\//, ''));
      const body = readFileSync(filePath);
      const type = filePath.endsWith('.css')
        ? 'text/css'
        : filePath.endsWith('.js')
          ? 'application/javascript'
          : 'text/html';
      response.writeHead(200, { 'Content-Type': type });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('not found');
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolvePromise({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r()))
      });
    });
  });
}

async function prepareBlogPage(page, baseUrl, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  await page.addScriptTag({ url: `${baseUrl}/js/site-template.js?v=20261023-pr333-follow-up` });
  await page.addScriptTag({ url: `${baseUrl}/js/lead-hero.js?v=20261023-pr333-follow-up` });
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    if (typeof window.LHIConsolidateBlogHeroCopy === 'function') {
      window.LHIConsolidateBlogHeroCopy();
    }
    window.scrollTo(0, 0);
  });
}

test('featured-hero intro rule is scoped to figure + intro adjacency', () => {
  const css = readFileSync(join(ROOT, 'css/lead-hero.css'), 'utf8');
  assert.match(
    css,
    /body\.lhi-page-hero\.blog-post main > \.lhi-post-featured-hero \+ \.lhi-post-body-intro[\s\S]*margin:\s*0 auto 1\.25rem/s
  );
});

for (const viewport of [
  { width: 1280, height: 800, tag: '1280' },
  { width: 390, height: 844, tag: '390' }
]) {
  test(`Watson post figcaption clears intro card @${viewport.tag}`, async () => {
    const server = await startStaticServer();
    const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
    try {
      const page = await browser.newPage({ viewport });
      await prepareBlogPage(page, server.baseUrl, WATSON);
      const overlap = await page.evaluate(() => {
        const cap = document.querySelector('.lhi-post-featured-hero figcaption');
        const intro = document.querySelector('.lhi-post-featured-hero + .lhi-post-body-intro');
        if (!cap || !intro) return { ok: false, reason: 'missing-nodes' };
        const capBox = cap.getBoundingClientRect();
        const introBox = intro.getBoundingClientRect();
        const gap = introBox.top - capBox.bottom;
        return { ok: gap >= -1, gap: Math.round(gap), capBottom: Math.round(capBox.bottom), introTop: Math.round(introBox.top) };
      });
      assert.equal(overlap.ok, true, `expected non-overlap, got ${JSON.stringify(overlap)}`);
      const chrome = await page.evaluate(() => {
        const footers = document.querySelectorAll('footer');
        const inMain = document.querySelectorAll('main footer');
        return { footerCount: footers.length, footerInMain: inMain.length };
      });
      assert.equal(chrome.footerCount, 1, 'site chrome should leave exactly one footer');
      assert.equal(chrome.footerInMain, 0, 'article must not contain a footer element');
    } finally {
      await browser.close();
      await server.close();
    }
  });
}

test('Watson FB landing hero lede is not line-clamped @390', async () => {
  const server = await startStaticServer();
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await prepareBlogPage(page, server.baseUrl, WATSON);
    const lede = await page.evaluate(() => {
      const el = document.querySelector('.lhi-hero-lede-block > .lhi-hero-lede');
      if (!el) return { ok: false, reason: 'missing-lede' };
      const style = getComputedStyle(el);
      const clamped = el.scrollHeight > el.clientHeight + 2;
      return {
        ok: style.display === 'block' && style.overflow === 'visible' && !clamped,
        display: style.display,
        overflow: style.overflow,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight
      };
    });
    assert.equal(lede.ok, true, `expected full mobile lede, got ${JSON.stringify(lede)}`);
  } finally {
    await browser.close();
    await server.close();
  }
});

for (const viewport of [
  { width: 1280, height: 800, tag: '1280' },
  { width: 390, height: 844, tag: '390' }
]) {
  for (const route of CONTROL_POSTS) {
    test(`control blog intro overlap unchanged ${route} @${viewport.tag}`, async () => {
      const server = await startStaticServer();
      const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
      try {
        const page = await browser.newPage({ viewport });
        await prepareBlogPage(page, server.baseUrl, route);
        const layout = await page.evaluate(() => {
          const featured = document.querySelector('main > .lhi-post-featured-hero');
          const intro =
            document.querySelector('main > .lhi-post-body-intro') ||
            document.querySelector('main .lhi-post-body-intro');
          if (!intro) return { ok: false, reason: 'missing-intro' };
          const st = getComputedStyle(intro);
          const box = intro.getBoundingClientRect();
          return {
            ok: true,
            hasFeaturedHero: Boolean(featured),
            marginTop: st.marginTop,
            introHeight: Math.round(box.height),
            shellPresent: Boolean(document.querySelector('.lhi-hero-shell'))
          };
        });
        assert.equal(layout.ok, true, `${route} intro should render`);
        assert.equal(layout.hasFeaturedHero, false, `${route} should not use featured-hero pattern`);
        assert.ok(layout.shellPresent, `${route} keeps lead hero shell`);
        assert.ok(layout.introHeight > 24, `${route} intro card has height`);
      } finally {
        await browser.close();
        await server.close();
      }
    });
  }
}
