import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const MEDICARE_CANONICAL = readFileSync(resolve(ROOT, 'medicare/index.html'), 'utf8');
const MEDICARE_TPMO_BLOCK = MEDICARE_CANONICAL.match(
  /<section class="site-page-disclosures"[\s\S]*?<\/section>/
)?.[0];
const FULL_SHIP =
  'We do not offer every plan available in your area. Currently we represent 8 organizations which offer 65 products in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local State Health Insurance Program (SHIP) to get information on all of your options.';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'search-engine-from-zip', '.ai-worker-local']);

function walkHtml(dir = ROOT, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (entry.endsWith('.html')) out.push(relative(ROOT, full).replace(/\\/g, '/'));
  }
  return out;
}

test('homepage ships site ACA lead hero above the fold', () => {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  assert.match(html, /\/css\/lead-hero\.css\?v=20261015-v6merge2/);
  assert.match(html, /\/js\/lead-hero\.js\?v=20261015-v6merge2/);
  assert.match(html, /data-form-name="site-aca-lead"/);
  assert.ok(html.includes('class="lhi-lead-hero'));
});

test('homepage DOM order keeps branded hero before lead capture for LCP', () => {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  const heroIdx = html.indexOf('class="hero home-hero"');
  const leadIdx = html.search(/class="lhi-lead-hero/);
  assert.ok(heroIdx > 0 && leadIdx > 0);
  assert.ok(heroIdx < leadIdx, 'branded home hero must precede the site lead form block');
});

test('sample blog post uses medicare site lead variant', () => {
  const html = readFileSync(resolve(ROOT, 'blog/aep-2026-polk-county-checklist.html'), 'utf8');
  assert.match(html, /data-variant="medicare"/);
  assert.match(html, /name="site-medicare-lead"/);
});

test('every site-medicare-lead page includes the Medicare hub bottom TPMO block', () => {
  assert.ok(MEDICARE_TPMO_BLOCK, 'medicare/index.html exposes the canonical bottom TPMO block');
  for (const rel of walkHtml()) {
    const html = readFileSync(resolve(ROOT, rel), 'utf8');
    if (!html.includes('name="site-medicare-lead"')) continue;
    assert.ok(html.includes(FULL_SHIP), `${rel} includes the approved SHIP TPMO sentence`);
    assert.ok(html.includes('8 organizations which offer 65 products'), `${rel} keeps 8/65 inventory wording`);
    const disclosures = html.match(/class="site-page-disclosures"[\s\S]*?<\/section>/g) || [];
    assert.equal(disclosures.length, 1, `${rel} keeps one bottom site-page-disclosures block`);
    assert.ok(disclosures[0].includes(FULL_SHIP), `${rel} renders the SHIP TPMO sentence in the bottom disclosure block`);
    assert.ok(
      disclosures[0].includes('class="tpmo-standard-disclaimer"') ||
        disclosures[0].includes('Company inventory note:'),
      `${rel} uses the standard TPMO markup or the broker-style inventory note in the bottom block`
    );
  }
});
