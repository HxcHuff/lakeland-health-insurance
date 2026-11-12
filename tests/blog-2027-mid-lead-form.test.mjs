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
  assert.equal(files.length, 89, `expected 89 2027/Facebook blog guides, found ${files.length}`);

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

test('lead-hero.css styles .lhi-lead-hero--mid in-flow with visible intro and centered single-column hero lede', () => {
  const css = readFileSync(join(ROOT, 'css/lead-hero.css'), 'utf8');
  assert.match(css, /section\.lhi-lead-hero\.lhi-lead-hero--mid/);
  assert.match(css, /section\.lhi-lead-hero\.lhi-lead-hero--mid\s+\.lhi-lead-hero__intro[\s\S]*?display:\s*block\s*!important/);
  assert.match(css, /\.lhi-hero-shell:not\(:has\(\.lhi-lead-hero\)\)\s+\.lhi-hero-lede-block\s*>\s*\.lhi-hero-lede/);
  assert.match(css, /\.lhi-hero-shell:not\(:has\(\.lhi-lead-hero\)\)\s+\.container\.hero-grid\s*\{[\s\S]*?max-width:\s*920px\s*!important[\s\S]*?text-align:\s*center\s*!important/);
  assert.match(css, /\.lhi-hero-shell:not\(:has\(\.lhi-lead-hero\)\)\s+\.lhi-hero-deferred-block\s+\.cta-row\s*\{[\s\S]*?justify-content:\s*center\s*!important/);
});

test('blog index (/blog/) uses knowledge hub H1, single topic filter bar, 2027 priority guides, inline CRO CTA, and isolated multi-state accordion', () => {
  const html = readFileSync(join(ROOT, 'blog/index.html'), 'utf8');
  assert.match(html, /<title>Florida Health Insurance &amp; Medicare Knowledge Hub<\/title>/);
  assert.match(html, /<h1>Florida Health Insurance &amp; Medicare Knowledge Hub<\/h1>/);
  assert.match(html, /Independent network guides, subsidy rules, and local enrollment updates for Polk County and beyond\./);
  assert.doesNotMatch(html, /<div class="search-suggestions"/);
  assert.match(html, /<h2 id="featured-under65-heading">2027 Priority Guides<\/h2>/);
  assert.match(html, /Watson Clinic &amp; Orlando Health 2027 Network Guide/);
  assert.match(html, /2027 Florida ACA Auto-Renewal 5-Point Checklist \(Dec 15 Deadline\)/);
  assert.match(html, /Medicare Part D \$2,400 Cap &amp; ANOC Audit Checklist/);
  assert.match(html, /Need your doctor, clinic, or prescriptions verified for 2027\?/);
  assert.match(html, /<a href="\/get-help\/" class="cta-button">Request a Plan Review<\/a>/);
  assert.match(html, /Looking for other licensed states\? Browse multi-state network guides/);
  assert.match(html, /<h2 id="article-library-heading">Latest health insurance guidance<\/h2>/);
  assert.match(html, /<section class="lhi-lead-hero lhi-lead-hero--mid"[^>]*id="lhi-lead-hero"/);
  assert.match(html, /id="coverage-insider-newsletter"[\s\S]*?name="homepage-newsletter"/);
  assert.match(html, /id="blog_email"\s+name="email"/);

  const searchIdx = html.indexOf('class="blog-index-tools"');
  const featuredIdx = html.indexOf('id="featured-under65-heading"');
  const inlineCtaIdx = html.indexOf('id="blog-inline-cta-heading"');
  const libraryIdx = html.indexOf('id="article-library-heading"');
  const leadIdx = html.indexOf('id="lhi-lead-hero"');
  assert.ok(
    searchIdx > 0 &&
      featuredIdx > searchIdx &&
      inlineCtaIdx > featuredIdx &&
      libraryIdx > inlineCtaIdx &&
      leadIdx > libraryIdx,
    'blog/index.html orders Search -> 2027 Priority Guides -> Inline CRO CTA -> Article Library -> Mid-page Lead Hero'
  );
});
