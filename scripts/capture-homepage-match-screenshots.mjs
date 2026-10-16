#!/usr/bin/env node
import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { allCaptureRoutes, SCREENSHOT_ALIASES } from './homepage-match-routes.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = process.env.HERO_SCREENSHOT_DIR || '/cursor/stores/self/media/homepage-match';
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

mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});

const PAGES = allCaptureRoutes();

try {
  for (const { url, name } of PAGES) {
    for (const { w, h, tag } of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(`${server.baseUrl}${url}`, { waitUntil: 'networkidle' });
      try {
        await page.waitForFunction(
          () => {
            const h = document.querySelector('header');
            return h && h.innerText.trim().length > 20;
          },
          { timeout: 4000 }
        );
      } catch {
        /* static header pages */
      }
      await page.waitForTimeout(300);
      const primary = join(OUT, `${name}-${tag}.png`);
      await page.screenshot({ path: primary });
      const alias = SCREENSHOT_ALIASES[name];
      if (alias) copyFileSync(primary, join(OUT, `${alias}-${tag}.png`));
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
console.log('Saved', PAGES.length * VIEWPORTS.length, 'screenshots to', OUT);
