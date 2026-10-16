#!/usr/bin/env node
/**
 * PNGs @1280 and @390 for non-blog sitewide gates.
 * HERO_SCREENSHOT_DIR=/path NON_BLOG_SCOPE=b|c|all node scripts/capture-sitewide-non-blog-screenshots.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { VERSION, gateRoutesForScope } from './non-blog-sitewide-routes.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const OUT =
  process.env.HERO_SCREENSHOT_DIR || '/cursor/stores/self/media/sitewide-c';
const scope = process.env.NON_BLOG_SCOPE || 'all';

const VIEWPORTS = [
  { w: 1280, h: 800, tag: '1280' },
  { w: 390, h: 844, tag: '390' }
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

const routes = gateRoutesForScope(scope);
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});

const indexRows = [];

try {
  for (const { url, name } of routes) {
    for (const { w, h, tag } of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.route('**/*', (routeReq) => {
        const u = routeReq.request().url();
        if (/google-analytics\.com|googletagmanager\.com|connect\.facebook\.net/i.test(u)) {
          return routeReq.abort();
        }
        return routeReq.continue();
      });
      await page.goto(`${server.baseUrl}${url}`, { waitUntil: 'networkidle', timeout: 25000 });
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
      });
      await page.addScriptTag({ url: `${server.baseUrl}/js/site-template.js?v=${VERSION}` });
      await page.waitForTimeout(400);
      await page.addScriptTag({ url: `${server.baseUrl}/js/lead-hero.js?v=${VERSION}` });
      await page.waitForTimeout(100);
      await page.evaluate(() => window.scrollTo(0, 0));
      const fileName = `${name}--${tag}.png`;
      const filePath = join(OUT, fileName);
      await page.screenshot({ path: filePath, fullPage: false });
      indexRows.push({ route: url, viewport: tag, file: fileName });
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Non-blog sitewide ${scope} screenshots</title>
<style>body{font-family:system-ui,sans-serif;margin:24px} table{border-collapse:collapse;width:100%} td,th{border:1px solid #cbd5e1;padding:8px;text-align:left} img{max-width:320px;height:auto;border:1px solid #e2e8f0}</style>
</head><body><h1>Non-blog sitewide (${scope})</h1>
<table><thead><tr><th>Route</th><th>1280</th><th>390</th></tr></thead><tbody>
${routes
  .map(({ url, name }) => {
    const a = indexRows.find((r) => r.route === url && r.viewport === '1280');
    const b = indexRows.find((r) => r.route === url && r.viewport === '390');
    return `<tr><td>${url}</td><td>${a ? `<a href="${a.file}"><img src="${a.file}" alt="1280"></a>` : '—'}</td><td>${b ? `<a href="${b.file}"><img src="${b.file}" alt="390"></a>` : '—'}</td></tr>`;
  })
  .join('\n')}
</tbody></table></body></html>`;
writeFileSync(join(OUT, `index-${scope}.html`), html, 'utf8');
console.log(`wrote ${indexRows.length} PNGs and index-${scope}.html under ${OUT}`);
