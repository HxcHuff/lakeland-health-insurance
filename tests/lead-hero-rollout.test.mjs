import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

test('homepage ships site ACA lead hero above the fold', () => {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  assert.match(html, /\/css\/lead-hero\.css\?v=20261014-lead-hero/);
  assert.match(html, /\/js\/lead-hero\.js\?v=20261014-lead-hero/);
  assert.match(html, /data-form-name="site-aca-lead"/);
  assert.ok(html.indexOf('class="lhi-lead-hero"') > 0);
});

test('sample blog post uses medicare site lead variant', () => {
  const html = readFileSync(resolve(ROOT, 'blog/aep-2026-polk-county-checklist.html'), 'utf8');
  assert.match(html, /data-variant="medicare"/);
  assert.match(html, /name="site-medicare-lead"/);
});
