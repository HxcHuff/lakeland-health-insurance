import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const REDIRECTS = readFileSync(join(ROOT, '_redirects'), 'utf8');
const ROBOTS = readFileSync(join(ROOT, 'robots.txt'), 'utf8');
const SITEMAP = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const PLANS = readFileSync(join(ROOT, 'plans/index.html'), 'utf8');
const NETLIFY_IGNORE = readFileSync(join(ROOT, '.netlifyignore'), 'utf8');

const RETIRED_FILES = [
  'blog/ads-manager-setup-checklist.html',
  'blog/campaign-funnel-ab-test.html',
  'blog/facebook-ad-copy-ab-test.html',
  'health-protector-guard/internal-link-anchor-suggestions.txt',
  'health-protector-guard/nav-snippet.html',
  'newsletter/email-newsletter.html',
];

const RETIRED_URL_PARTS = [
  'ads-manager-setup-checklist.html',
  'campaign-funnel-ab-test.html',
  'facebook-ad-copy-ab-test.html',
  'internal-link-anchor-suggestions.txt',
  'nav-snippet.html',
  'search-engine-from-zip',
  'email-newsletter.html',
];

function findDeployableFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) findDeployableFiles(full, out);
    else out.push(relative(ROOT, full));
  }
  return out;
}

function findDiscoveryFiles(dir, out = []) {
  const skippedDirs = new Set(['.git', '.claude', '.netlify', 'docs', 'netlify', 'node_modules', 'scripts', 'tests']);
  for (const name of readdirSync(dir)) {
    if (skippedDirs.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      findDiscoveryFiles(full, out);
      continue;
    }
    if (['.html', '.js', '.jsx'].includes(extname(name)) || name === 'sitemap.xml') out.push(full);
  }
  return out;
}

test('retired operational and newsletter files are absent from the public tree', () => {
  for (const rel of RETIRED_FILES) assert.equal(existsSync(join(ROOT, rel)), false, rel);
  assert.deepEqual(findDeployableFiles(join(ROOT, 'search-engine-from-zip')), []);
});

test('retired operational pages return 410', () => {
  for (const url of [
    '/blog/ads-manager-setup-checklist.html',
    '/blog/campaign-funnel-ab-test.html',
    '/blog/facebook-ad-copy-ab-test.html',
  ]) {
    assert.match(REDIRECTS, new RegExp(`^${url.replaceAll('.', '\\.') }\\s+/404\\.html\\s+410$`, 'm'));
  }
});

test('quote-engine routes consolidate to Get Help while obsolete assets return 404', () => {
  for (const url of [
    '/search-engine-from-zip',
    '/search-engine-from-zip/',
    '/search-engine-from-zip/dist',
    '/search-engine-from-zip/dist/',
  ]) {
    assert.match(REDIRECTS, new RegExp(`^${url}\\s+/get-help/\\s+301!$`, 'm'));
  }
  assert.match(REDIRECTS, /^\/search-engine-from-zip\/\*\s+\/404\.html\s+404!$/m);
  assert.ok(existsSync(join(ROOT, 'get-help/index.html')));
  assert.ok(existsSync(join(ROOT, '404.html')));
});

test('retired newsletter artifact redirects to the public newsletter route', () => {
  assert.match(REDIRECTS, /^\/newsletter\/email-newsletter\.html\s+\/newsletter\/\s+301!$/m);
  assert.ok(existsSync(join(ROOT, 'newsletter/index.html')));
});

test('retired Health ProtectorGuard internal fragments return 404', () => {
  for (const url of [
    '/health-protector-guard/nav-snippet.html',
    '/health-protector-guard/internal-link-anchor-suggestions.txt',
  ]) {
    assert.match(REDIRECTS, new RegExp(`^${url.replaceAll('.', '\\.') }\\s+/404\\.html\\s+404!$`, 'm'));
    assert.ok(NETLIFY_IGNORE.split(/\r?\n/).includes(url.slice(1)), `${url} is excluded from deploy uploads`);
  }
});

test('robots permits crawlers to observe retirement responses', () => {
  for (const part of RETIRED_URL_PARTS) assert.doesNotMatch(ROBOTS, new RegExp(part.replaceAll('.', '\\.')));
});

test('retired URLs are absent from public discovery files and the sitemap', () => {
  for (const file of findDiscoveryFiles(ROOT)) {
    const source = readFileSync(file, 'utf8');
    for (const part of RETIRED_URL_PARTS) {
      assert.equal(source.includes(part), false, `${relative(ROOT, file)} references ${part}`);
    }
  }
  for (const part of RETIRED_URL_PARTS) assert.equal(SITEMAP.includes(part), false, part);
});

test('plans cites the current CMS fact sheet and carries matching freshness metadata', () => {
  const cmsFactSheet = 'https://www.cms.gov/newsroom/fact-sheets/short-term-limited-duration-insurance-and-independent-noncoordinated-excepted-benefits-coverage-cms';
  assert.match(PLANS, new RegExp(cmsFactSheet));
  assert.doesNotMatch(PLANS, /fixed-indemnity-excepted-benefits-coverage-notice\.pdf/);
  assert.match(PLANS, /"dateModified": "2026-08-12"/);
  assert.match(SITEMAP, /<loc>https:\/\/lakelandhealthinsurance\.com\/plans\/<\/loc>\s*<lastmod>2026-08-12<\/lastmod>/);
});

test('audit source and runtime evidence stay outside the public Netlify boundary', () => {
  for (const path of ['audit/', '.audit-data/']) {
    assert.ok(NETLIFY_IGNORE.split(/\r?\n/).includes(path), `${path} is excluded from deploy uploads`);
  }
  assert.match(REDIRECTS, /^\/audit\/\*\s+\/404\.html\s+404!$/m);
  assert.match(REDIRECTS, /^\/\.audit-data\/\*\s+\/404\.html\s+404!$/m);
});
