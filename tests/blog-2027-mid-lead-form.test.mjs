import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

const LEGACY_ABOVE_FOLD_EXEMPT = new Set([
  'blog/orlando-health-watson-clinic-insurance-2026.html'
]);

function get2027AndFacebookBlogFiles() {
  const blogDir = join(ROOT, 'blog');
  return readdirSync(blogDir)
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
    .map((f) => `blog/${f}`)
    .filter((rel) => {
      if (LEGACY_ABOVE_FOLD_EXEMPT.has(rel)) return false;
      const html = readFileSync(join(ROOT, rel), 'utf8');
      if (!html.includes('id="lhi-lead-hero"')) return false;
      if (rel.includes('2027')) return true;
      if (html.includes('meta-audience-eligible')) return true;
      if (html.includes('lhi-lead-hero--mid')) return true;
      return false;
    });
}

test('2027 and Facebook blog guides place #lhi-lead-hero mid-article (lhi-lead-hero--mid) after opening educational content', () => {
  const files = get2027AndFacebookBlogFiles();
  assert.equal(files.length, 88, `expected 88 2027/Facebook blog guides, found ${files.length}`);

  for (const rel of files) {
    const html = readFileSync(join(ROOT, rel), 'utf8');

    assert.match(
      html,
      /<section class="lhi-lead-hero lhi-lead-hero--mid"[^>]*id="lhi-lead-hero"/,
      `${rel} must use .lhi-lead-hero--mid on #lhi-lead-hero`
    );

    const leadIdx = html.indexOf('id="lhi-lead-hero"');
    const firstBodyH2Match = [...html.matchAll(/<h2\b[^>]*>/gi)].find(
      (m) => m.index < leadIdx && !html.slice(Math.max(0, m.index - 200), m.index).includes('lhi-lead-hero__intro')
    );
    assert.ok(
      firstBodyH2Match,
      `${rel} must render at least one educational <h2> section before the mid-article #lhi-lead-hero form`
    );
  }
});

test('lead-hero.css styles .lhi-lead-hero--mid in-flow with visible intro and unclamped hero lede', () => {
  const css = readFileSync(join(ROOT, 'css/lead-hero.css'), 'utf8');
  assert.match(css, /section\.lhi-lead-hero\.lhi-lead-hero--mid/);
  assert.match(css, /section\.lhi-lead-hero\.lhi-lead-hero--mid\s+\.lhi-lead-hero__intro[\s\S]*?display:\s*block\s*!important/);
  assert.match(css, /\.lhi-hero-shell:not\(:has\(\.lhi-lead-hero\)\)\s+\.lhi-hero-lede-block\s*>\s*\.lhi-hero-lede/);
});
