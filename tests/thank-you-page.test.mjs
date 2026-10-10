import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SITEMAP = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const REDIRECTS = readFileSync(join(ROOT, '_redirects'), 'utf8');
const HTML = readFileSync(join(ROOT, 'thank-you/index.html'), 'utf8');
const CANONICAL = 'https://lakelandhealthinsurance.com/thank-you/';
const TPMO_SNIPPET = '8 organizations which offer 65 products';

function rewriteRule(pathname) {
  const lines = REDIRECTS.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  return lines
    .map((line) => line.split(/\s+/))
    .find(([from, , status]) => from === pathname && status === '200');
}

test('QR thank-you page is a noindex utility route with 200 rewrites and no sitemap entry', () => {
  assert.match(HTML, /<meta name="robots" content="noindex, follow">/);
  assert.match(HTML, new RegExp(`<link rel="canonical" href="${CANONICAL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`));
  assert.doesNotMatch(SITEMAP, /thank-you/i);

  for (const pathname of ['/thank-you', '/thank-you/']) {
    const rule = rewriteRule(pathname);
    assert.ok(rule, `${pathname} has a 200 rewrite`);
    assert.equal(rule[1], '/thank-you/index.html');
  }
});

test('QR thank-you page keeps bottom TPMO disclosures and no lead form', () => {
  const disclosuresAt = HTML.indexOf('class="site-page-disclosures"');
  const tpmoAt = HTML.indexOf(TPMO_SNIPPET);
  assert.ok(disclosuresAt >= 0, 'bottom disclosure block present');
  assert.ok(tpmoAt >= disclosuresAt, 'TPMO text lives in the bottom disclosure block');
  assert.doesNotMatch(HTML, /class="tpmo-cta-disclaimer"/);
  assert.doesNotMatch(HTML, /<form\b/i);
  assert.doesNotMatch(HTML, /\bfree\b/i);
  assert.doesNotMatch(HTML, /healthmarkets/i);
});

test('QR thank-you page routes booking through the on-site book page', () => {
  assert.match(HTML, /<a class="btn primary" href="\/book\/">Book a review<\/a>/);
  assert.match(HTML, /href="tel:\+18636403102"/);
  assert.match(HTML, /href="mailto:david@lakelandhealthinsurance.com"/);
  assert.match(HTML, /\/js\/analytics\.js\?v=20261010-dual-call-conversion/);
  assert.match(HTML, /thank-you-video-slot" hidden/);
});
