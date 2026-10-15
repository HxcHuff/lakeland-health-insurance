#!/usr/bin/env node
/**
 * Playwright perf for /, /medicare/, /plans/ — 1280 and 390 (Slow 4G + 4× CPU).
 * form-visible ms: first #lhi-site-lead-form (or [data-lhi-site-lead-form]) input/select/textarea
 *   in viewport with non-zero box (requestAnimationFrame after element exists).
 * Default: 3 runs per cell → median. --runs N, --attribution for layout-shift sources on / only.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(process.env.LHI_ROOT || '/workspace');
const runsArg = process.argv.includes('--runs')
  ? Number.parseInt(process.argv[process.argv.indexOf('--runs') + 1], 10)
  : 3;
const RUNS = Number.isFinite(runsArg) && runsArg > 0 ? runsArg : 3;
const ATTRIBUTION = process.argv.includes('--attribution');
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

function median(nums) {
  const sorted = nums.filter((n) => n != null && Number.isFinite(n)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function applyNetworkProfile(page, isMobile) {
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.clearCPUThrottlingRate').catch(() => {});
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  }).catch(() => {});
  if (isMobile) {
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 }).catch(() => {});
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (400 * 1024) / 8,
      uploadThroughput: (400 * 1024) / 8
    }).catch(() => {});
  }
  return client;
}

async function measureRoute(page, baseUrl, route, collectAttribution) {
  const viewport = page.viewportSize();
  const isMobile = viewport && viewport.width <= 400;
  await applyNetworkProfile(page, isMobile);

  await page.addInitScript(() => {
    window.__lhiFormVisibleAt = null;
    window.__lhiPaintMarks = { fcp: null };
    window.__lhiCls = 0;
    window.__lhiShiftLog = [];
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
          if (entry.hadRecentInput) continue;
          window.__lhiCls += entry.value;
          if (entry.sources && entry.sources.length) {
            for (const source of entry.sources) {
              const node = source.node;
              let label = source.nodeName || 'unknown';
              if (node && node.id) label += `#${node.id}`;
              else if (node && node.className && typeof node.className === 'string') {
                label += `.${node.className.trim().split(/\s+/).slice(0, 3).join('.')}`;
              }
              window.__lhiShiftLog.push({
                value: entry.value,
                startTime: entry.startTime,
                label,
                previousRect: source.previousRect ? { ...source.previousRect } : null,
                currentRect: source.currentRect ? { ...source.currentRect } : null
              });
            }
          } else {
            window.__lhiShiftLog.push({
              value: entry.value,
              startTime: entry.startTime,
              label: '(no source)',
              previousRect: null,
              currentRect: null
            });
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (error) {}
  });

  const navStart = Date.now();
  const filePath = route === '/' ? '/index.html' : `/${route.replace(/^\//, '').replace(/\/$/, '')}/index.html`;
  await page.goto(`${baseUrl}${filePath}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });

  await page.waitForFunction(() => {
    const root =
      document.getElementById('lhi-site-lead-form') ||
      document.querySelector('[data-lhi-site-lead-form]') ||
      document.querySelector('.sitelink-lead-form');
    if (!root) return false;
    const fields = root.querySelectorAll('input:not([type="hidden"]), select, textarea');
    for (const el of fields) {
      if (el.closest('[hidden]')) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 0;
      const inView = r.bottom > 0 && r.top < vh && r.width > 0 && r.height > 0;
      if (!inView) continue;
      return new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const r2 = el.getBoundingClientRect();
            const painted = r2.width > 0 && r2.height > 0;
            if (painted && window.__lhiFormVisibleAt == null) {
              window.__lhiFormVisibleAt = performance.now();
            }
            resolve(painted);
          });
        });
      });
    }
    return false;
  }, { timeout: 120000, polling: 50 });

  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const fcp = window.__lhiPaintMarks.fcp;
    const byLabel = {};
    for (const row of window.__lhiShiftLog || []) {
      byLabel[row.label] = (byLabel[row.label] || 0) + row.value;
    }
    const ranked = Object.entries(byLabel)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([label, score]) => ({ label, score: Number(score.toFixed(4)) }));
    return {
      fcpMs: fcp != null ? Math.round(fcp) : null,
      formVisibleMs: window.__lhiFormVisibleAt != null ? Math.round(window.__lhiFormVisibleAt) : null,
      cls: Number((window.__lhiCls || 0).toFixed(4)),
      layoutShiftAttribution: ranked,
      rawShiftCount: (window.__lhiShiftLog || []).length
    };
  });

  return {
    fcpMs: metrics.fcpMs,
    formVisibleMs: metrics.formVisibleMs,
    cls: metrics.cls,
    wallMs: Date.now() - navStart,
    ...(collectAttribution
      ? {
          layoutShiftAttribution: metrics.layoutShiftAttribution,
          rawShiftCount: metrics.rawShiftCount
        }
      : {})
  };
}

function summarizeRuns(runRows) {
  return {
    fcpMs: median(runRows.map((r) => r.fcpMs)),
    formVisibleMs: median(runRows.map((r) => r.formVisibleMs)),
    cls: median(runRows.map((r) => r.cls)),
    wallMs: median(runRows.map((r) => r.wallMs)),
    runs: runRows
  };
}

const server = await startServer();
const browser = await chromium.launch({ headless: true });
const results = {
  capturedAt: new Date().toISOString(),
  root: ROOT,
  runsPerCell: RUNS,
  methodologyNotes: [
    '390 profile: CDP 4× CPU, ~400 Kbps, 150 ms RTT',
    'Navigation waitUntil: domcontentloaded (not full load)',
    'form-visible: first visible painted input/select/textarea in #lhi-site-lead-form or [data-lhi-site-lead-form]',
    'Medians over RUNS per cell'
  ],
  baseUrl: server.baseUrl,
  routes: {}
};

try {
  for (const route of ROUTES) {
    results.routes[route] = {};
    for (const profile of [
      { label: '390-slow4g', width: 390, height: 844 },
      { label: '1280', width: 1280, height: 800 }
    ]) {
      const runRows = [];
      for (let i = 0; i < RUNS; i += 1) {
        const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height } });
        const collectAttribution = ATTRIBUTION && route === '/' && profile.label === '390-slow4g' && i === 0;
        runRows.push(await measureRoute(page, server.baseUrl, route, collectAttribution));
        await page.close();
      }
      const summary = summarizeRuns(runRows);
      if (runRows[0]?.layoutShiftAttribution) {
        summary.layoutShiftAttribution = runRows[0].layoutShiftAttribution;
        summary.rawShiftCount = runRows[0].rawShiftCount;
      }
      results.routes[route][profile.label] = summary;
    }
  }
} finally {
  await browser.close();
  await server.close();
}

writeFileSync(OUT, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
