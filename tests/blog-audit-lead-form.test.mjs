import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const ACA_SAMPLES = [
  'blog/health-insurance-tampa-2026.html',
  'blog/aca-subsidy-cliff.html',
  'blog/dental-insurance-guide.html',
  'blog/index.html'
];
const MEDICARE_SAMPLES = [
  'blog/medicare-advantage-lakeland-2026.html',
  'blog/turning-65-medicare-checklist-florida.html'
];

function formName(rel) {
  const html = readFileSync(join(ROOT, rel), 'utf8');
  const block = html.match(/<section class="lhi-lead-hero"[\s\S]*?<\/section>/i)?.[0] ?? '';
  return block.match(/name="(site-(?:medicare|aca)-lead)"/)?.[1] ?? '';
}

test('ACA-topic blog samples embed site-aca-lead', () => {
  for (const rel of ACA_SAMPLES) {
    assert.equal(formName(rel), 'site-aca-lead', rel);
  }
});

test('Medicare-topic blog samples embed site-medicare-lead', () => {
  for (const rel of MEDICARE_SAMPLES) {
    assert.equal(formName(rel), 'site-medicare-lead', rel);
  }
});

test('blog posts do not keep static site-page-disclosures TPMO blocks', () => {
  for (const name of readdirSync(join(ROOT, 'blog'))) {
    if (!name.endsWith('.html')) continue;
    const html = readFileSync(join(ROOT, 'blog', name), 'utf8');
    assert.doesNotMatch(
      html,
      /class="site-page-disclosures"/,
      `blog/${name} relies on footer TPMO only`
    );
  }
});
