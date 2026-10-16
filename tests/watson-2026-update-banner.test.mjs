import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PAGE = 'blog/orlando-health-watson-clinic-insurance-2026.html';

const TEASER_BODY =
  'There is news about Orlando Health and Watson Clinic in Lakeland and Polk County that is not published online yet. David Huff spoke directly with the clinic in October 2026.';

const WATSON_HARD_LIMIT = /\b(the network framework|shared specialists or facilities|no PCP at Lakeland Highlands)\b/i;

function html() {
  return readFileSync(join(ROOT, PAGE), 'utf8');
}

function extractBanner(block) {
  const match = block.match(
    /<section class="lhi-alert-notice" aria-labelledby="watson-2027-update-banner-heading">[\s\S]*?<\/section>/
  );
  return match?.[0] ?? '';
}

test('PR A: 2027 update banner precedes Humana notice on Watson insurance guide', () => {
  const source = html();
  const updateIdx = source.indexOf('watson-2027-update-banner-heading');
  const humanaIdx = source.indexOf('watson-humana-2027-heading');
  assert.ok(updateIdx >= 0 && humanaIdx >= 0);
  assert.ok(updateIdx < humanaIdx);
  const banner = extractBanner(source);
  assert.match(banner, /NEW: 2027 update/);
  assert.match(banner, /Orlando Health and Watson Clinic: news for Lakeland patients/);
  assert.ok(banner.includes(TEASER_BODY));
  assert.match(banner, /href="\/blog\/orlando-health-watson-clinic-2027-plan\.html">Read the 2027 update/);
  assert.match(banner, /href="tel:\+18636403102">Call or text \(863\) 640-3102/);
  assert.doesNotMatch(banner, WATSON_HARD_LIMIT);
});

test('PR A: mid and bottom CTAs use provider-check intent and tel link', () => {
  const source = html();
  assert.match(source, /id="watson-mid-cta-heading">Check if your Watson doctor is in your 2027 plan/);
  assert.match(source, /id="watson-bottom-cta-heading">Check if your Watson doctor is in your 2027 plan/);
  const mid = source.match(/watson-mid-cta-heading[\s\S]*?<\/section>/)?.[0] ?? '';
  const bottom = source.match(/watson-bottom-cta-heading[\s\S]*?<\/section>/)?.[0] ?? '';
  for (const block of [mid, bottom]) {
    assert.match(block, /href="tel:\+18636403102">Call or text \(863\) 640-3102/);
    assert.match(block, /href="\/get-help\/\?intent=provider-check">Request a plan review/);
  }
});

test('PR A: related reading lists 2027 post first; title and meta unchanged', () => {
  const source = html();
  const related = source.match(/id="related-reading-heading"[\s\S]*?<\/section>/)?.[0] ?? '';
  const firstLink = related.match(/<a href="([^"]+)">/)?.[1];
  assert.equal(firstLink, '/blog/orlando-health-watson-clinic-2027-plan.html');
  assert.match(source, /<title>Watson Clinic Insurance Accepted 2026 &amp; 2027 \| Lakeland Guide<\/title>/);
  assert.match(
    source,
    /meta name="description" content="What insurance does Watson Clinic accept in 2026 and 2027\? Review Medicare Advantage, Marketplace, and commercial plan types, 2027 network changes, and how to verify your doctor before you enroll\."/
  );
  assert.doesNotMatch(source, /watson-clinic-lakeland-highlands-david-huff/);
});

test('PR A: dateModified and last reviewed show October 16, 2026', () => {
  const source = html();
  assert.match(source, /"dateModified": "2026-10-16"/);
  assert.match(source, /Last reviewed: October 16, 2026/);
});
