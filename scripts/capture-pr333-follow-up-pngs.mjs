#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = '/cursor/stores/self/media/pr-333-follow-up';
const PIN = '20261023-pr333-follow-up';

const SHOTS = [
  {
    file: 'health-insurance-tampa-2026-intro-390.png',
    url: '/blog/health-insurance-tampa-2026.html',
    width: 390,
    height: 844,
    scrollToIntro: true
  },
  {
    file: 'medicare-advantage-lakeland-2026-intro-390.png',
    url: '/blog/medicare-advantage-lakeland-2026.html',
    width: 390,
    height: 844,
    scrollToIntro: true
  },
  {
    file: 'orlando-health-polk-county-expansion-2026-intro-1280.png',
    url: '/blog/orlando-health-polk-county-expansion-2026.html',
    width: 1280,
    height: 800,
    scrollToIntro: true
  },
  {
    file: 'aep-2026-polk-county-checklist-deadline-callout.png',
    url: '/blog/aep-2026-polk-county-checklist.html',
    width: 1280,
    height: 800,
    selector: '.deadline-box'
  },
  {
    file: 'medigap-plan-g-vs-plan-n-warning-callout.png',
    url: '/blog/medigap-plan-g-vs-plan-n.html',
    width: 1280,
    height: 800,
    selector: 'section.callout.warning'
  },
  {
    file: 'non-income-based-health-insurance-florida-product-warning.png',
    url: '/blog/non-income-based-health-insurance-florida.html',
    width: 1280,
    height: 800,
    selector: '.product-warning'
  }
];

function contentType(pathname) {
  if (pathname.endsWith('.css')) return 'text/css';
  if (pathname.endsWith('.js')) return 'application/javascript';
  return 'text/html';
}

const server = await new Promise((resolvePromise) => {
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
    resolvePromise({ baseUrl: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) });
  });
});

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});
const page = await browser.newPage();

for (const shot of SHOTS) {
  await page.setViewportSize({ width: shot.width, height: shot.height });
  await page.goto(`${server.baseUrl}${shot.url}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.addScriptTag({ url: `${server.baseUrl}/js/site-template.js?v=${PIN}` });
  await page.waitForTimeout(400);
  await page.addScriptTag({ url: `${server.baseUrl}/js/lead-hero.js?v=${PIN}` });
  await page.waitForTimeout(120);
  if (shot.scrollToIntro) {
    await page.evaluate(() => {
      const intro = document.querySelector('.lhi-post-body-intro');
      if (intro) intro.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(200);
  } else if (shot.selector) {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ block: 'center' });
    }, shot.selector);
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: join(OUT, shot.file), fullPage: false });
  console.log(shot.file);
}

await browser.close();
await server.close();
