import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  BLOCK_MESSAGE,
  buildBlockedResponse,
  decideGeoBlock,
  isAllowlistedPath,
  isGeoBlockEnabled,
} from '../netlify/edge-functions/lib/geo-block-logic.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('geo block kill switch is off unless GEO_BLOCK_ENABLED is exactly true', () => {
  assert.equal(isGeoBlockEnabled(undefined), false);
  assert.equal(isGeoBlockEnabled(''), false);
  assert.equal(isGeoBlockEnabled('false'), false);
  assert.equal(isGeoBlockEnabled('TRUE'), false);
  assert.equal(isGeoBlockEnabled('true'), true);
});

test('geo block allows US, territories, and unknown country when enabled', () => {
  const base = { enabled: true, pathname: '/medicare/', method: 'GET', userAgent: 'Mozilla/5.0' };
  assert.equal(decideGeoBlock({ ...base, countryCode: 'US' }).action, 'allow');
  assert.equal(decideGeoBlock({ ...base, countryCode: 'PR' }).action, 'allow');
  assert.equal(decideGeoBlock({ ...base, countryCode: 'GU' }).action, 'allow');
  assert.equal(decideGeoBlock({ ...base, countryCode: '' }).action, 'allow');
  assert.equal(decideGeoBlock({ ...base, countryCode: null }).action, 'allow');
});

test('geo block returns 403 for non-US when enabled', () => {
  const decision = decideGeoBlock({
    enabled: true,
    countryCode: 'DE',
    pathname: '/',
    method: 'GET',
    userAgent: 'Mozilla/5.0',
  });
  assert.equal(decision.action, 'block');
  const blocked = buildBlockedResponse();
  assert.equal(blocked.status, 403);
  assert.match(blocked.body, new RegExp(BLOCK_MESSAGE.replace(/[()]/g, '\\$&')));
  assert.equal(blocked.headers['cache-control'], 'no-store');
  assert.equal(blocked.headers['x-robots-tag'], 'noindex');
  assert.equal(blocked.headers['x-lhi-geo'], 'block');
});

test('geo block allowlists crawler user agents outside the US', () => {
  const decision = decideGeoBlock({
    enabled: true,
    countryCode: 'FR',
    pathname: '/medicare/',
    method: 'GET',
    userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  });
  assert.equal(decision.action, 'allow');
  assert.equal(decision.reason, 'crawler');
});

test('geo block allowlists infrastructure paths from any country', () => {
  for (const pathname of [
    '/.netlify/functions/lead',
    '/.netlify/builders',
    '/api/lead',
    '/robots.txt',
    '/sitemap.xml',
    '/sitemap-news.xml',
    '/llms.txt',
    '/7c8d24b6c73373168edb06a95e957240.txt',
    '/.well-known/security.txt',
    '/assets/ads/dg-2027/foo.jpg',
    '/favicon.ico',
    '/icons/icon-192.png',
  ]) {
    assert.ok(isAllowlistedPath(pathname), pathname);
    const decision = decideGeoBlock({
      enabled: true,
      countryCode: 'CA',
      pathname,
      method: 'GET',
      userAgent: 'Mozilla/5.0',
    });
    assert.equal(decision.action, 'allow', pathname);
    assert.equal(decision.reason, 'path', pathname);
  }
});

test('geo block passes POST through when enabled', () => {
  const decision = decideGeoBlock({
    enabled: true,
    countryCode: 'GB',
    pathname: '/get-help/',
    method: 'POST',
    userAgent: 'Mozilla/5.0',
  });
  assert.equal(decision.action, 'allow');
  assert.equal(decision.reason, 'post');
});

test('geo block passes everything when disabled', () => {
  const decision = decideGeoBlock({
    enabled: false,
    countryCode: 'CN',
    pathname: '/medicare/',
    method: 'GET',
    userAgent: 'Mozilla/5.0',
  });
  assert.equal(decision.action, 'allow');
  assert.equal(decision.reason, 'disabled');
});

test('netlify.toml declares geo-block edge function on all paths', () => {
  const toml = readFileSync(join(ROOT, 'netlify.toml'), 'utf8');
  assert.match(toml, /\[\[edge_functions\]\]/);
  assert.match(toml, /path = "\/\*"/);
  assert.match(toml, /function = "geo-block"/);
  assert.doesNotMatch(toml, /GEO_BLOCK_ENABLED\s*=\s*"true"/);
});
