import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { findFaqVisibleMatchIssues } from '../scripts/faq-visible-match.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'local-health-insurance-answers/lakeland-regional-unitedhealthcare-2027/index.html';

function source(rel = PAGE) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

test('LRH UnitedHealthcare 2027 answer page: URL, compliance guardrails, and citations', () => {
  const html = source();

  assert.match(html, /rel="canonical" href="https:\/\/lakelandhealthinsurance\.com\/local-health-insurance-answers\/lakeland-regional-unitedhealthcare-2027\/"/);
  assert.match(html, /<h1>Is Lakeland Regional Health in network with UnitedHealthcare for 2027\?<\/h1>/);
  assert.match(html, /Last checked: October 12, 2026/);
  assert.match(html, /meta name="lhi-chrome-intent" content="medicare"/);
  assert.match(html, /answer-pages\.css\?v=20261009-hero-header-offset/);
  assert.match(html, /class="site-page-disclosures"/);
  assert.match(html, /Please contact Medicare\.gov, 1-800-MEDICARE, or your local State Health Insurance Program \(SHIP\)/);

  assert.doesNotMatch(html, /\bfree\b/i, 'must not use the word free');
  assert.doesNotMatch(html, /benefitmims\.com|practicesol\.com/i);
  assert.doesNotMatch(html, /2029|September 30, 2029|new deal|new contract|three-year/i);
  assert.doesNotMatch(html, /healthmarkets/i);
  assert.doesNotMatch(html, /48-hour|48 hour/i);

  assert.match(html, /We have not found a confirmed public announcement from Lakeland Regional Health or UnitedHealthcare about network participation for calendar year 2027/);
  assert.match(html, /LRH's page stated|reviewed October 12, 2026|Lakeland Regional Health's UnitedHealthcare page/);
  assert.match(html, /https:\/\/www\.medicare\.gov\/plan-compare\//);
  assert.match(html, /joining-a-plan/);
  assert.match(html, /special-enrollment-periods/);
  assert.match(html, /https:\/\/www\.mylrh\.org\/unitedhealthcare\//);
  assert.match(html, /https:\/\/www\.floridashine\.org\//);

  assert.match(html, /href="\/local-health-insurance-answers\/"/);
  assert.match(html, /href="\/medicare-broker-lakeland-fl\/"/);
  assert.match(html, /href="\/medicare-part-d-lakeland-fl\/"/);
  assert.match(html, /href="\/blog\/central-florida-health-insurance-competition\.html"/);
  assert.match(html, /href="\/carriers\/unitedhealthcare-aca-2026\/"/);
  assert.doesNotMatch(html, /retiring-and-medicare-lakeland-fl/);

  assert.match(html, /tel:\+18636403102/);
  assert.doesNotMatch(html, /474-2500|18634742500/, 'must not use the legacy 474-2500 call number');
  assert.match(html, /site-template\.js\?v=20261012-lrh-uhc-medicare-path/);
  assert.match(html, /Florida residents/);

  const internalPromoLinks = [...html.matchAll(/<a href="\/[^"]*">([^<]+)<\/a>/g)]
    .map((m) => m[1])
    .filter((text) => /UnitedHealthcare|WellMed|AARP|Lakeland Regional Health/i.test(text));
  assert.equal(internalPromoLinks.length, 0, `internal promo anchors must stay generic: ${internalPromoLinks.join(', ')}`);
  assert.match(html, /Lakeland Regional Health's UnitedHealthcare page/);
});

test('LRH UnitedHealthcare 2027 answer page: FAQPage JSON-LD matches visible FAQ text', () => {
  const issues = findFaqVisibleMatchIssues(PAGE, source());
  assert.deepEqual(issues, [], issues.join('\n'));
});

test('site-template lists LRH UHC 2027 under Medicare paths for SHIP footer', () => {
  const template = source('js/site-template.js');
  assert.match(
    template,
    /'\/local-health-insurance-answers\/lakeland-regional-unitedhealthcare-2027\/'/,
  );
});

test('sitemap lists the new answer page with 2026-10-12 lastmod', () => {
  const sitemap = source('sitemap.xml');
  assert.match(
    sitemap,
    /<loc>https:\/\/lakelandhealthinsurance\.com\/local-health-insurance-answers\/lakeland-regional-unitedhealthcare-2027\/<\/loc>\s*<lastmod>2026-10-12<\/lastmod>/,
  );
});
