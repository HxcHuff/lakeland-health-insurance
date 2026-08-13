import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { inspectSite } from '../scripts/check-site-integrity.mjs';

const ORIGIN = 'https://lakelandhealthinsurance.com';

function page({ canonical = '/', body = '', robots = 'index, follow', jsonLd = '{"@context":"https://schema.org"}' } = {}) {
  return `<!doctype html><html><head><link rel="canonical" href="${ORIGIN}${canonical}"><meta name="robots" content="${robots}"><script type="application/ld+json">${jsonLd}</script></head><body>${body}</body></html>`;
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'lhi-site-integrity-'));
  mkdirSync(join(root, 'assets'));
  mkdirSync(join(root, 'our approach'));
  writeFileSync(join(root, 'assets', 'app.js'), 'void 0;');
  writeFileSync(join(root, 'our approach', 'index.html'), page({ canonical: '/our%20approach/', body: '<h1 id="details">Details</h1>' }));
  writeFileSync(join(root, 'index.html'), page({ body: '<h1 id="top">Home</h1><a href="/our%20approach/?from=home#details">Details</a><script src="/assets/app.js?v=1"></script><a href="https://example.com/x">External</a><a href="mailto:test@example.invalid">Mail</a>' }));
  writeFileSync(join(root, 'private.html'), page({ canonical: '/private.html', robots: 'noindex, nofollow' }));
  writeFileSync(join(root, 'sitemap.xml'), `<?xml version="1.0"?><urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/our%20approach/</loc></url></urlset>`);
  writeFileSync(join(root, '_redirects'), '/old / 301!\n');
  return root;
}

function withFixture(fn) {
  const root = fixture();
  try { fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('fully passing fixture handles encoded paths, query strings, fragments, noindex, schemes, assets, and external URLs offline', () => {
  withFixture((root) => {
    const result = inspectSite({ root });
    assert.equal(result.ok, true, result.issues.join('\n'));
    assert.equal(result.summary.externalUrls, 1);
  });
});

test('reports broken links, missing assets, invalid fragments, duplicate ids, and malformed JSON-LD deterministically', () => {
  withFixture((root) => {
    writeFileSync(join(root, 'index.html'), page({
      body: '<div id="same"></div><div id="same"></div><a href="/missing.html">Broken</a><img src="/assets/missing.png"><a href="#absent">Fragment</a>',
      jsonLd: '{broken',
    }));
    const first = inspectSite({ root });
    const second = inspectSite({ root });
    assert.equal(first.ok, false);
    assert.deepEqual(first.issues, second.issues);
    assert.ok(first.issues.some((issue) => issue.includes('duplicate-id')));
    assert.ok(first.issues.some((issue) => issue.includes('missing target /missing.html')));
    assert.ok(first.issues.some((issue) => issue.includes('missing target /assets/missing.png')));
    assert.ok(first.issues.some((issue) => issue.includes('fragment-rule')));
    assert.ok(first.issues.some((issue) => issue.includes('json-ld')));
  });
});

test('reports duplicate sitemap URLs and sitemap/canonical mismatch while excluding noindex pages', () => {
  withFixture((root) => {
    writeFileSync(join(root, 'sitemap.xml'), `<?xml version="1.0"?><urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/private.html</loc></url><url><loc>${ORIGIN}/our%20approach/</loc></url></urlset>`);
    writeFileSync(join(root, 'our approach', 'index.html'), page({ canonical: '/wrong/' }));
    const result = inspectSite({ root });
    assert.ok(result.issues.some((issue) => issue.includes('duplicate-url')));
    assert.ok(result.issues.some((issue) => issue.includes('noindex-rule')));
    assert.ok(result.issues.some((issue) => issue.includes('canonical-mismatch')));
    assert.ok(result.issues.some((issue) => issue.includes('canonical-target')));
  });
});

test('rejects path traversal attempts and filenames with shell metacharacters remain inert', () => {
  withFixture((root) => {
    writeFileSync(join(root, 'odd;$(touch never).html'), page({ canonical: '/odd;$(touch%20never).html' }));
    writeFileSync(join(root, 'index.html'), page({ body: '<a href="/%2e%2e/outside.txt">Escape</a><a href="/odd;$(touch%20never).html">Odd</a>' }));
    const result = inspectSite({ root });
    assert.ok(result.issues.some((issue) => issue.includes('path traversal segment')));
  });
});

test('rejects symlinks that escape the approved root where supported', (t) => {
  withFixture((root) => {
    const outside = mkdtempSync(join(tmpdir(), 'lhi-site-outside-'));
    try {
      writeFileSync(join(outside, 'outside.js'), 'void 0;');
      try { symlinkSync(join(outside, 'outside.js'), join(root, 'assets', 'escape.js')); }
      catch (error) { t.skip(`symlink unsupported: ${error.code}`); return; }
      writeFileSync(join(root, 'index.html'), page({ body: '<script src="/assets/escape.js"></script>' }));
      const result = inspectSite({ root });
      assert.ok(result.issues.some((issue) => issue.includes('symlink escapes repository root')));
    } finally { rmSync(outside, { recursive: true, force: true }); }
  });
});
