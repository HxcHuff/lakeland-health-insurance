import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'retiring-and-medicare-lakeland-fl/index.html';
const FULL_SHIP =
  'We do not offer every plan available in your area. Currently we represent 8 organizations which offer 65 products in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local State Health Insurance Program (SHIP) to get information on all of your options.';

function html() {
  return readFileSync(join(ROOT, PAGE), 'utf8');
}

test('T12 retiring-and-medicare-lakeland-fl page metadata and hero', () => {
  const source = html();
  assert.match(source, /<title>Retiring in Lakeland, FL and Need Medicare\? What to Do and When<\/title>/);
  assert.match(
    source,
    /<h1>Retiring in Lakeland and Need Medicare: What to Do, Step by Step<\/h1>/
  );
  assert.match(
    source,
    /name="description" content="Retiring in Lakeland, FL\? Learn when to enroll in Medicare, how to time Part B with your employer plan, and how to compare options in Polk County\."/
  );
  assert.match(source, /rel="canonical" href="https:\/\/lakelandhealthinsurance\.com\/retiring-and-medicare-lakeland-fl\/"/);
  assert.match(source, /answer-pages\.css\?v=20261016-no-red-banner/);
  assert.match(source, /site-template\.js\?v=20261016-no-red-banner/);
  assert.match(source, /How to decide \(neutral comparison\)[\s\S]*<div class="table-wrap">/);
  assert.match(source, /class="answer-snippet"/);
  assert.match(source, /seven-month Initial Enrollment Period/);
  assert.match(source, /eight-month Special Enrollment Period/);
});

test('T12 page includes FAQPage JSON-LD and body FAQ', () => {
  const source = html();
  assert.match(source, /"@type": "FAQPage"/);
  assert.match(source, /I'm retiring\. When do I sign up for Medicare\?/);
  assert.match(source, /Do I need Part D if I pick Medigap\?/);
  assert.match(source, /id="faq"/);
});

test('T12 page internal links and compliance surfaces', () => {
  const source = html();
  for (const href of [
    '/retiring-before-65-florida/',
    '/working-past-65-medicare-lakeland-fl/',
    '/blog/city-of-lakeland-retiree-medicare-spouse-premium.html',
    '/provider-prescription-check/',
    '/medicare-part-d-lakeland-fl/',
    'https://www.medicare.gov/',
    'https://www.ssa.gov/',
    'https://www.cms.gov/'
  ]) {
    assert.ok(source.includes(href), `expected link ${href}`);
  }
  assert.ok(source.includes(FULL_SHIP));
  assert.doesNotMatch(source, /HealthMarkets/i);
  assert.doesNotMatch(source, /48-hour/i);
  assert.doesNotMatch(source, /\bFREE\b/);
  assert.match(source, /data-page-key="retiring_and_medicare_lakeland_fl"/);
  assert.match(source, /FL License #W371813/);
});

test('T12 sitemap entry uses lastmod 2026-10-12', () => {
  const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
  assert.match(
    sitemap,
    /<loc>https:\/\/lakelandhealthinsurance\.com\/retiring-and-medicare-lakeland-fl\/<\/loc>\s*<lastmod>2026-10-12<\/lastmod>/
  );
});

test('T12 comparison table uses scrollable table-wrap and answer-card overflow CSS', () => {
  const css = readFileSync(join(ROOT, 'css/answer-pages.css'), 'utf8');
  assert.match(css, /\.answer-card \{\s*min-width: 0;/);
  assert.match(css, /\.answer-card \.table-wrap \{\s*overflow-x: auto;/);
});

test('inbound links point to T12 from retiring-before-65, working-past-65, and city blog', () => {
  const before65 = readFileSync(join(ROOT, 'retiring-before-65-florida/index.html'), 'utf8');
  const workingPast = readFileSync(join(ROOT, 'working-past-65-medicare-lakeland-fl/index.html'), 'utf8');
  const cityBlog = readFileSync(join(ROOT, 'blog/city-of-lakeland-retiree-medicare-spouse-premium.html'), 'utf8');
  const link = 'href="/retiring-and-medicare-lakeland-fl/">Retiring in Lakeland and need Medicare</a>';
  assert.ok(before65.includes(link), 'retiring-before-65 includes required cross-link');
  assert.ok(workingPast.includes('/retiring-and-medicare-lakeland-fl/'), 'working-past-65 links to T12');
  assert.ok(cityBlog.includes('/retiring-and-medicare-lakeland-fl/'), 'city blog links to T12');
});
