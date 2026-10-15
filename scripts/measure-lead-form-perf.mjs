#!/usr/bin/env node
/**
 * Playwright perf snapshot for /, /medicare/, /plans/ at 390 (Slow 4G + 4x CPU) and 1280.
 * Form-visible ms: performance.timeOrigin → first frame where lead heading + name field intersect viewport.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';

const ROOT = resolve(process.env.LHI_ROOT || '/workspace');
const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : '/cursor/stores/self/internal/lead-form-speed-metrics.json';

const ROUTES = ['/', '/medicare/', '/plans/'];

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

async function measureRoute(page, baseUrl, route) {
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.clearCPUThrottlingRate').catch(() => {});
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  }).catch(() => {});

  const viewport = page.viewportSize();
  const isMobile = viewport && viewport.width <= 400;
  if (isMobile) {
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 }).catch(() => {});
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (400 * 1024) / 8,
      uploadThroughput: (400 * 1024) / 8
    }).catch(() => {});
  }

  await page.addInitScript(() => {
    window.__lhiFormVisibleAt = null;
    window.__lhiPaintMarks = { fcp: null };
    window.__lhiCls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            window.__lhiPaintMarks.fcp = entry.startTime;
          }
        }
      }).observe({ type: 'paint', buffered: true });
    } catch (error) {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__lhiCls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (error) {}
  });

  const navStart = Date.now();
  const filePath = route === '/' ? '/index.html' : `/${route.replace(/^\//, '').replace(/\/$/, '')}/index.html`;
  await page.goto(`${baseUrl}${filePath}`, {
    waitUntil: 'load',
    timeout: 120000
  });

  await page.waitForFunction(() => {
    const title = document.querySelector('.lhi-lead-hero__title, .sitelink-lead-form legend, .sitelink-lead-form h2, #medicare-title');
    const name = document.querySelector('.lhi-lead-hero input[name="full_name"], .sitelink-lead-form input[name="full_name"], input[name="full_name"]');
    if (!title || !name) return false;
    const tr = title.getBoundingClientRect();
    const nr = name.getBoundingClientRect();
    const vh = window.innerHeight || 0;
    const visible = tr.bottom > 0 && tr.top < vh && nr.bottom > 0 && nr.top < vh && nr.width > 0 && nr.height > 0;
    if (visible && window.__lhiFormVisibleAt == null) {
      window.__lhiFormVisibleAt = performance.now();
    }
    return visible;
  }, { timeout: 120000 });

  const metrics = await page.evaluate(() => {
    const fcp = window.__lhiPaintMarks.fcp;
    return {
      fcpMs: fcp != null ? Math.round(fcp) : null,
      formVisibleMs: window.__lhiFormVisibleAt != null ? Math.round(window.__lhiFormVisibleAt) : null,
      cls: Number((window.__lhiCls || 0).toFixed(4))
    };
  });

  return {
    ...metrics,
    wallMs: Date.now() - navStart
  };
}

const server = await startServer();
const browser = await chromium.launch({ headless: true });
const results = { capturedAt: new Date().toISOString(), baseUrl: server.baseUrl, routes: {} };

try {
  for (const route of ROUTES) {
    results.routes[route] = {};
    for (const profile of [
      { label: '390-slow4g', width: 390, height: 844 },
      { label: '1280', width: 1280, height: 800 }
    ]) {
      const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height } });
      results.routes[route][profile.label] = await measureRoute(page, server.baseUrl, route);
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

writeFileSync(OUT, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
