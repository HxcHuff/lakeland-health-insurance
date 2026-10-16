import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const HTML = readFileSync(resolve(ROOT, 'medicare-2027-check/index.html'), 'utf8');
const HEADERS = readFileSync(resolve(ROOT, '_headers'), 'utf8');
const SITEMAP = readFileSync(resolve(ROOT, 'sitemap.xml'), 'utf8');

const V2_SMS_SNIPPET =
  'By checking this box, I give my prior express consent for Lakeland Health Insurance (David Huff, licensed insurance agent) to send text messages about this request to the mobile number I entered above.';

test('medicare-2027-check is a noindex demand-gen route excluded from sitemap and Meta audience', () => {
  assert.match(HTML, /<meta name="robots" content="noindex, follow">/);
  assert.match(HTML, /<link rel="canonical" href="https:\/\/lakelandhealthinsurance\.com\/medicare-2027-check\/">/);
  assert.doesNotMatch(HTML, /meta-audience-eligible/i);
  assert.doesNotMatch(SITEMAP, /medicare-2027-check/);
  assert.match(HEADERS, /\/medicare-2027-check\/\n\s+X-Robots-Tag: noindex, follow/);
});

test('medicare-2027-check uses get-help with v2 consent and campaign attribution', () => {
  assert.match(HTML, /<body class="paid-landing-page medicare-paid-landing/);
  const form = HTML.match(/<form[^>]*data-sitelink-lead-form[\s\S]*?<\/form>/);
  assert.ok(form, 'get-help sitelink form is present');
  const markup = form[0];
  assert.match(markup, /name="get-help"/);
  assert.match(markup, /name="consent_text_version" value="get-help-2026-09-29-v2"/);
  assert.match(markup, /name="consent_page" value="\/medicare-2027-check\/"/);
  assert.match(markup, /name="source_page_key" value="medicare_2027_check"/);
  assert.match(markup, /name="source_cta_key" value="start_review_hero"/);
  assert.match(markup, /name="consent_request" value="yes"/);
  assert.match(markup, new RegExp(V2_SMS_SNIPPET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(markup, /action="\/thanks\.html"/);
  assert.doesNotMatch(markup, /lp-medicare-lead/);
});

test('medicare-2027-check keeps TPMO and licensed-agent disclosures at the bottom', () => {
  assert.match(HTML, /tpmo-standard-disclaimer/);
  assert.match(HTML, /We do not offer every plan available in your area\. Currently we represent 8 organizations which offer 65 products/);
  assert.match(HTML, /Florida license W371813/);
  assert.doesNotMatch(HTML, /\/lp\//);
});
