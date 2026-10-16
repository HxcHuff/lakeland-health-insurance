#!/usr/bin/env node
/**
 * First-screen PNGs for PR A verification (1280×800 and 390×844).
 * Usage: HERO_SCREENSHOT_DIR=/path node scripts/capture-sitewide-pr-a-screenshots.mjs
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const OUT =
  process.env.HERO_SCREENSHOT_DIR ||
  '/cursor/stores/bc-18e337dd-aed0-4afd-ad21-cf64e33529e8/media/sitewide-a';

const PAGES = [
  { url: '/advantage-guard/', name: 'advantage-guard' },
  { url: '/tampa-health-insurance/', name: 'tampa-city' },
  { url: '/carriers/oscar-aca-2026/', name: 'carrier-oscar' },
  { url: '/health-protector-guard/', name: 'health-protector-guard' },
  { url: '/short-term-medical/', name: 'short-term-medical' },
  { url: '/blog/orlando-health-lakeland-quality-approval-2026.html', name: 'orlando-lakeland-blog' }
];

const VIEWPORTS = [
  { w: 1280, h: 800, tag: '1280x800' },
  { w: 390, h: 844, tag: '390x844' }
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

mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});

try {
  for (const { url, name } of PAGES) {
    for (const { w, h, tag } of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(`${server.baseUrl}${url}`, { waitUntil: 'networkidle', timeout: 25000 });
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(OUT, `${name}-${tag}.png`) });
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`Saved ${PAGES.length * VIEWPORTS.length} PNGs under ${OUT}`);
