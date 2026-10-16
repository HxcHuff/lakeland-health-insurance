#!/usr/bin/env node
/** Wizard step PNGs @1280 and @390 for key v2 paths (no submits). */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = process.env.LEAD_FORM_V2_PNG_DIR || '/cursor/stores/self/media/lead-form-v2';

const SCENARIOS = [
  { slug: 'homepage', path: '/', intent: 'under-65' },
  { slug: 'medicare-hub', path: '/medicare-broker-lakeland-fl/', intent: 'medicare' },
  { slug: 'supplemental-preselect', path: '/supplemental-insurance/', intent: 'supplemental' },
  { slug: 'existing-client', path: '/', intent: 'current-client-review' }
];

function startServer() {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        if (pathname === '/index.html') pathname = '/';
        const file = pathname === '/' ? join(ROOT, 'index.html') : join(ROOT, pathname.replace(/^\//, ''));
        if (!existsSync(file)) {
          res.writeHead(404);
          res.end('missing');
          return;
        }
        const ext = pathname.split('.').pop();
        const type = ext === 'css' ? 'text/css' : ext === 'js' ? 'application/javascript' : 'text/html';
        res.writeHead(200, { 'Content-Type': type });
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

async function setWizardStep(page, intent, step) {
  await page.evaluate(({ intent, step }) => {
    const form = document.querySelector('form.lf2');
    if (!form?.__lf2go) throw new Error('lf2 not initialized');
    const radio = form.querySelector(`input[name="normalized_intent"][value="${intent}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const zip = form.elements.zip_code;
    if (zip && step >= 2) zip.value = '33801';
    form.__lf2go(step, { silent: true });
  }, { intent, step });
}

async function captureScenario(page, baseUrl, scenario, viewportTag, width, height) {
  await page.setViewportSize({ width, height });
  const url = scenario.path === '/' ? `${baseUrl}/` : `${baseUrl}${scenario.path}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('form.lf2.lf2--js', { timeout: 20000 });

  for (let step = 1; step <= 3; step += 1) {
    await setWizardStep(page, scenario.intent, step);
    await page.waitForTimeout(350);
    const card = page.locator('.lhi-lead-hero__card, form.lf2').first();
    await card.waitFor({ state: 'visible', timeout: 10000 });
    const buf = await card.screenshot();
    writeFileSync(join(OUT, `${scenario.slug}-step${step}-${viewportTag}.png`), buf);
  }
}

mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
});

try {
  const page = await browser.newPage();
  for (const scenario of SCENARIOS) {
    await captureScenario(page, server.baseUrl, scenario, '1280', 1280, 800);
    await captureScenario(page, server.baseUrl, scenario, '390', 390, 844);
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`Step PNGs written to ${OUT}`);
