import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://lakelandhealthinsurance.com';
const INDEXNOW_KEY = '7c8d24b6c73373168edb06a95e957240';
const require = createRequire(import.meta.url);

const {
  handler,
  pingIndexNow,
  isProductionLakelandDeploy,
  INDEXNOW_KEY: FN_KEY,
  INDEXNOW_KEY_LOCATION,
  MAX_URLS,
} = require('../netlify/functions/deploy-succeeded.js');

function source(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

test('robots.txt names AI crawlers with the same Allow and Disallow rules', () => {
  const robots = source('robots.txt');
  const agents = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-SearchBot',
    'PerplexityBot',
    'Google-Extended',
    'Bingbot',
  ];
  for (const agent of agents) {
    assert.match(robots, new RegExp(`User-agent: ${agent}\\nAllow: /`));
    assert.match(robots, new RegExp(`User-agent: ${agent}[\\s\\S]*?Disallow: /thanks\\.html`));
  }
  assert.match(robots, /Sitemap: https:\/\/lakelandhealthinsurance.com\/sitemap.xml/);
  assert.match(robots, /User-agent: \*/);
});

test('llms.txt lists sitemap URLs and excludes Georgia', () => {
  const llms = source('llms.txt');
  const sitemap = source('sitemap.xml');
  const urls = [...llms.matchAll(/https:\/\/lakelandhealthinsurance\.com\/[^\s)]+/g)].map((match) => match[0].replace(/[.,]$/, ''));
  assert.ok(urls.length > 50, `expected a full catalog, got ${urls.length}`);
  for (const url of urls) {
    assert.match(sitemap, new RegExp(`<loc>${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`), url);
    const pathname = new URL(url).pathname.replace(/^\//, '');
    const rel = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    assert.equal(existsSync(join(ROOT, rel || 'index.html')), true, rel);
  }
  assert.doesNotMatch(llms, /health-insurance-georgia/);
  assert.match(
    llms,
    /We do not offer every plan available in your area\. Currently we represent 8 organizations which offer 65 products in your area\. Please contact Medicare\.gov or 1-800-MEDICARE to get information on all of your options\./,
  );
  assert.match(llms, /health-insurance-texas/);
  assert.match(llms, /lakeland-regional-health-insurance-accepted\.html/);
  assert.match(llms, /licensed Florida health agent/);
});

test('IndexNow key file is public and matches the deploy-succeeded function', () => {
  assert.equal(existsSync(join(ROOT, `${INDEXNOW_KEY}.txt`)), true);
  assert.equal(source(`${INDEXNOW_KEY}.txt`).trim(), INDEXNOW_KEY);
  assert.equal(FN_KEY, INDEXNOW_KEY);
  assert.equal(INDEXNOW_KEY_LOCATION, `${ORIGIN}/${INDEXNOW_KEY}.txt`);
  assert.ok(MAX_URLS < 10000);
});

test('IndexNow ping is production-only, fail-open, and needs no secrets', () => {
  assert.equal(isProductionLakelandDeploy({ context: 'deploy-preview' }, {}).ok, false);
  assert.equal(isProductionLakelandDeploy({ context: 'branch-deploy' }, {}).ok, false);
  assert.equal(isProductionLakelandDeploy({ context: 'production', url: 'https://deploy-preview-9--demo.netlify.app' }, {}).ok, false);
  assert.equal(isProductionLakelandDeploy({ context: 'production', url: `${ORIGIN}/` }, { LHI_SITE_ENV: 'production' }).ok, true);
  assert.equal(
    isProductionLakelandDeploy({
      context: 'production',
      branch: 'main',
      url: `${ORIGIN}/`,
      ssl_url: `${ORIGIN}/`,
      deploy_ssl_url: 'https://main--lhi.netlify.app',
    }, { LHI_SITE_ENV: 'production', URL: 'https://main--lhi.netlify.app' }).ok,
    true,
  );
  assert.equal(
    isProductionLakelandDeploy({
      context: 'deploy-preview',
      url: `${ORIGIN}/`,
      deploy_ssl_url: 'https://deploy-preview-217--lhi.netlify.app',
    }, {}).ok,
    false,
  );

  const sourceText = source('netlify/functions/deploy-succeeded.js');
  assert.doesNotMatch(sourceText, /process\.env\.[A-Z0-9_]+_SECRET|INDEXNOW_API_KEY/);
});

test('IndexNow submits lastmod-changed URLs and swallows handler errors', async () => {
  const sitemap = `<?xml version="1.0"?><urlset>
    <url><loc>${ORIGIN}/blog/a.html</loc><lastmod>2026-09-30</lastmod></url>
    <url><loc>${ORIGIN}/about/</loc><lastmod>2026-07-30</lastmod></url>
  </urlset>`;
  const calls = [];
  const result = await pingIndexNow({
    payload: { context: 'production', url: `${ORIGIN}/`, published_at: '2026-09-30T12:00:00.000Z' },
    env: { CONTEXT: 'production', LHI_SITE_ENV: 'production' },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      if (String(url).includes('sitemap.xml')) return { ok: true, status: 200, text: async () => sitemap };
      return { ok: true, status: 200, text: async () => 'ok' };
    },
    now: new Date('2026-09-30T12:00:00.000Z'),
  });
  assert.equal(result.skipped, false);
  assert.equal(result.mode, 'lastmod-changed');
  assert.equal(result.submitted, 1);
  const posted = JSON.parse(calls.find((call) => String(call.url).includes('indexnow')).options.body);
  assert.deepEqual(posted.urlList, [`${ORIGIN}/blog/a.html`]);

  const productionWithAlias = await pingIndexNow({
    payload: {
      context: 'production',
      branch: 'main',
      url: `${ORIGIN}/`,
      deploy_ssl_url: 'https://main--lhi.netlify.app',
      published_at: '2026-09-30T12:00:00.000Z',
    },
    env: { CONTEXT: 'production', LHI_SITE_ENV: 'production', URL: 'https://main--lhi.netlify.app' },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      if (String(url).includes('sitemap.xml')) return { ok: true, status: 200, text: async () => sitemap };
      return { ok: true, status: 200, text: async () => 'ok' };
    },
    now: new Date('2026-09-30T12:00:00.000Z'),
  });
  assert.equal(productionWithAlias.skipped, false);
  assert.equal(productionWithAlias.submitted, 1);

  const preview = await pingIndexNow({
    payload: { context: 'deploy-preview', deploy_ssl_url: 'https://deploy-preview-217--lhi.netlify.app' },
    fetchImpl: async () => { throw new Error('must not fetch'); },
  });
  assert.equal(preview.skipped, true);

  const failed = await handler({ body: '{' });
  assert.equal(failed.statusCode, 200);
  assert.equal(JSON.parse(failed.body).ok, true);
});

test('sitemap lastmod is on or after each page dateModified', () => {
  const sitemap = source('sitemap.xml');
  const entries = [...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>\s*<lastmod>\s*([^<\s]+)\s*<\/lastmod>/g)];
  assert.ok(entries.length > 100);
  for (const [, loc, lastmod] of entries) {
    const pathname = new URL(loc).pathname;
    const rel = pathname === '/' ? 'index.html' : pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1);
    if (!existsSync(join(ROOT, rel))) continue;
    const html = source(rel);
    const modified = [...html.matchAll(/"dateModified"\s*:\s*"([0-9]{4}-[0-9]{2}-[0-9]{2})"/g)].map((match) => match[1]);
    for (const date of modified) {
      assert.ok(lastmod >= date, `${rel}: lastmod ${lastmod} < dateModified ${date}`);
    }
  }
});

test('facility posts use one question for title, H1, and headline, without ellipsis', () => {
  const titles = {
    'blog/adventhealth-haines-city.html': 'Is the New Centra Care Haines City in My Plan?',
    'blog/centra-care-four-corners.html': 'Does Centra Care Four Corners Take My Insurance?',
    'blog/lrh-physician-group-insurance.html': 'Is My Lakeland Regional Health Doctor in My Plan?',
  };
  for (const [rel, title] of Object.entries(titles)) {
    const html = source(rel);
    assert.match(html, new RegExp(`<title>${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</title>`));
    assert.match(html, new RegExp(`<h1>${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h1>`));
    assert.match(html, new RegExp(`"headline": "${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
    assert.doesNotMatch(html, /<title>[^<]*…/);
    const answer = html.match(/<section class="key-answer"><p><strong>Direct answer:<\/strong>\s*([\s\S]*?)<\/p><\/section>/);
    assert.ok(answer, rel);
    const words = answer[1].replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length;
    assert.ok(words >= 40 && words <= 60, `${rel} answer words ${words}`);
  }
});

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test('Direct answer box keeps navy text on mint at 4.5:1 inside dark heroes', () => {
  const css = source('css/blog-unified.css');
  assert.match(
    css,
    /body\.blog-post \.hero \.key-answer[\s\S]*?color:\s*var\(--lhi-navy,\s*#1B2A4A\)\s*!important/,
  );
  const ratio = contrastRatio('#1B2A4A', '#F0FDFA');
  assert.ok(ratio >= 4.5, `navy on mint contrast ${ratio.toFixed(2)}`);

  const affected = [
    'blog/adventhealth-haines-city.html',
    'blog/florida-insurance-guide.html',
    'blog/health-insurance-tampa-2026.html',
    'blog/lakeland-regional-health-insurance-accepted.html',
    'blog/health-insurance-wesley-chapel-2026.html',
  ];
  for (const rel of affected) {
    const html = source(rel);
    assert.match(html, /\/css\/blog-unified\.css/);
    assert.match(html, /class="key-answer"/);
  }
});

test('Florida Medicare guide title, H1, and headline no longer split 2026/2027', () => {
  const html = source('blog/florida-insurance-guide.html');
  assert.match(html, /<title>Florida Medicare Guide: Enrollment and Plan Strategy<\/title>/);
  assert.match(html, /<h1>Florida Medicare Guide: Enrollment and Plan Strategy<\/h1>/);
  assert.match(html, /"headline": "Florida Medicare Guide: Enrollment and Plan Strategy"/);
});
