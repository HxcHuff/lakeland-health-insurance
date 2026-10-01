import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const ORIGIN = 'https://lakelandhealthinsurance.com';
const REDIRECTS = readFileSync(join(ROOT, '_redirects'), 'utf8');
const SITEMAP = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');

const PAGES = [
  {
    rel: 'terms/index.html',
    canonical: `${ORIGIN}/terms/`,
    heading: 'Terms of Service'
  },
  {
    rel: 'data-deletion/index.html',
    canonical: `${ORIGIN}/data-deletion/`,
    heading: 'Data Deletion'
  }
];

function source(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteRule(pathname) {
  const lines = REDIRECTS.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  return lines
    .map((line) => line.split(/\s+/))
    .find(([from, , status]) => from === pathname && status === '200');
}

test('Meta App Review legal pages exist, have canonical URLs, and are in the sitemap', () => {
  for (const page of PAGES) {
    assert.equal(existsSync(join(ROOT, page.rel)), true, page.rel);
    const html = source(page.rel);
    assert.match(html, new RegExp(`<link rel="canonical" href="${escapeRegExp(page.canonical)}">`));
    assert.match(html, new RegExp(`<h1[^>]*>${page.heading}</h1>`));
    assert.match(SITEMAP, new RegExp(`<loc>${escapeRegExp(page.canonical)}</loc>`));
  }
});

test('slashless legal URLs rewrite to the directory index with HTTP 200', () => {
  for (const pathname of ['/terms', '/terms/', '/data-deletion', '/data-deletion/']) {
    const rule = rewriteRule(pathname);
    assert.ok(rule, `${pathname} has a 200 rewrite`);
    assert.equal(rule[1], `${pathname.replace(/\/$/, '')}/index.html`);
  }
});
