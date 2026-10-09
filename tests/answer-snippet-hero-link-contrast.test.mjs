import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const ANSWER_PAGES_VERSION = '20261009-hero-header-offset';

const LOCAL_ANSWER_PAGES = [
  '/local-health-insurance-answers/',
  '/local-health-insurance-answers/medicare-plan-help-lakeland/',
  '/local-health-insurance-answers/health-insurance-broker-lakeland-fl/',
  '/local-health-insurance-answers/employee-losing-group-coverage/',
  '/local-health-insurance-answers/self-employed-health-insurance-polk-county/',
  '/local-health-insurance-answers/watson-clinic-insurance-network-help/',
];

function source(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function parseRgb(color) {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  assert.ok(match, `expected rgb(a) color, got ${color}`);
  return match.slice(1, 4).map((part) => Number(part) / 255);
}

function relativeLuminance([r, g, b]) {
  const channel = (value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const [lr, lg, lb] = [r, g, b].map(channel);
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrastRatio(foregroundRgb, backgroundRgb) {
  const lighter = Math.max(relativeLuminance(foregroundRgb), relativeLuminance(backgroundRgb));
  const darker = Math.min(relativeLuminance(foregroundRgb), relativeLuminance(backgroundRgb));
  return (lighter + 0.05) / (darker + 0.05);
}

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
          ? 'text/javascript'
          : 'text/html';
      response.writeHead(200, { 'content-type': type });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('');
    }
  });
  return new Promise((resolvePromise, reject) => {
    server.listen(0, '127.0.0.1', (error) => {
      if (error) reject(error);
      else resolvePromise(server);
    });
  });
}

test('answer-pages.css overrides hero link color inside answer snippets', () => {
  const css = source('css/answer-pages.css');
  assert.match(
    css,
    /\.answer-hero \.answer-snippet a:not\(\.btn\):not\(\.hero-cta\):not\(\.lp-primary-call\)\s*{[^}]*color:\s*var\(--navy,\s*#1B2A4A\)/s,
  );
  assert.match(
    css,
    /\.answer-hero \.answer-snippet a:not\(\.btn\):not\(\.hero-cta\):not\(\.lp-primary-call\):hover[\s\S]*?color:\s*var\(--hub-blue,\s*#0f5f7b\)/,
  );
});

test('local answer hub pages cache-bust answer-pages.css after snippet hero link fix', () => {
  const href = `/css/answer-pages.css?v=${ANSWER_PAGES_VERSION}`;
  for (const path of LOCAL_ANSWER_PAGES) {
    const rel = path.replace(/^\//, '') + (path.endsWith('/') ? 'index.html' : '/index.html');
    const html = source(rel);
    assert.match(html, new RegExp(`href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), `${rel} uses ${href}`);
  }
});

test('rendered hero snippet links meet 4.5:1 contrast on all six local answer pages', async () => {
  const server = await startStaticServer();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome',
  });

  try {
    const page = await browser.newPage();
    for (const path of LOCAL_ANSWER_PAGES) {
      await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' });

      const metrics = await page.evaluate(() => {
        const snippet = document.querySelector('.answer-hero .answer-snippet');
        if (!snippet) throw new Error('missing .answer-hero .answer-snippet');

        let link = snippet.querySelector('a:not(.btn):not(.hero-cta):not(.lp-primary-call)');
        if (!link) {
          link = document.createElement('a');
          link.href = '#contrast-probe';
          link.textContent = 'contrast probe';
          snippet.appendChild(link);
        }

        const linkStyle = getComputedStyle(link);
        const snippetStyle = getComputedStyle(snippet);
        return {
          color: linkStyle.color,
          backgroundColor: snippetStyle.backgroundColor,
        };
      });

      const ratio = contrastRatio(parseRgb(metrics.color), parseRgb(metrics.backgroundColor));
      assert.ok(
        ratio >= 4.5,
        `${path} snippet link contrast ${ratio.toFixed(2)} (fg ${metrics.color}, bg ${metrics.backgroundColor})`,
      );

      await page.locator('.answer-hero .answer-snippet a').last().hover();
      const hoverColor = await page.evaluate(() => {
        const snippet = document.querySelector('.answer-hero .answer-snippet');
        const link = snippet.querySelector('a:not(.btn):not(.hero-cta):not(.lp-primary-call)');
        return getComputedStyle(link).color;
      });
      const hoverRatio = contrastRatio(parseRgb(hoverColor), parseRgb(metrics.backgroundColor));
      assert.ok(
        hoverRatio >= 4.5,
        `${path} snippet link hover contrast ${hoverRatio.toFixed(2)} (fg ${hoverColor}, bg ${metrics.backgroundColor})`,
      );
    }
  } finally {
    await browser.close();
    server.close();
  }
});
