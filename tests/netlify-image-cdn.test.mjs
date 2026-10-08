import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { netlifyImage, netlifySrcset } = require('../js/lhi-netlify-image.js');
const ROOT = join(import.meta.dirname, '..');

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

test('netlifyImage builds local asset URLs', () => {
  assert.equal(
    netlifyImage('/assets/example.jpg', { w: 800, fm: 'webp', q: 80 }),
    '/.netlify/images?url=%2Fassets%2Fexample.jpg&w=800&fm=webp&q=80'
  );
});

test('netlifySrcset joins width descriptors', () => {
  const set = netlifySrcset('/assets/example.jpg', [480, 800], { fm: 'webp', q: 80 });
  assert.match(set, /480w/);
  assert.match(set, /800w/);
  assert.match(set, /fm=webp/);
});

test('homepage hero uses Netlify Image CDN with srcset', () => {
  const html = read('index.html');
  assert.match(html, /hero-portrait-frame[\s\S]*?\/\.netlify\/images\?url=/);
  assert.match(html, /srcset="[^"]*\/\.netlify\/images\?url=[^"]*480w/);
  assert.match(html, /width="900"\s+height="900"/);
  assert.match(html, /fetchpriority="high"/);
});

test('featured blog posts serve large images through the CDN', () => {
  for (const file of [
    'blog/dont-overlook-rx-costs-2027.html',
    'blog/orlando-health-lakeland-quality-approval-2026.html'
  ]) {
    const html = read(file);
    assert.match(html, /\/\.netlify\/images\?url=\/assets\//);
    assert.match(html, /srcset="/);
    assert.doesNotMatch(html, /og:image" content="https:\/\/[^"]+\/\.netlify\/images/);
  }
});

test('OG and schema image URLs stay on canonical absolute asset paths', () => {
  const orlando = read('blog/orlando-health-lakeland-quality-approval-2026.html');
  assert.match(
    orlando,
    /"https:\/\/lakelandhealthinsurance\.com\/assets\/watson-clinic-lakeland-highlands\.jpg"/
  );
  assert.match(orlando, /property="og:image" content="https:\/\/lakelandhealthinsurance\.com\/assets\/watson-clinic-lakeland-highlands\.jpg"/);
});
