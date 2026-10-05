import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { findFaqVisibleMatchIssues } from '../scripts/faq-visible-match.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PRIMARY = '/medicare-broker-lakeland-fl/';
const BEST = '/best-medicare-broker-lakeland-fl/';

function source(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function flatten(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const item of node) flatten(item, out);
    return out;
  }
  if (node['@type'] || node['@id']) out.push(node);
  if (node['@graph']) flatten(node['@graph'], out);
  return out;
}

function jsonLdNodes(html) {
  const nodes = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    flatten(JSON.parse(match[1]), nodes);
  }
  return nodes;
}

test('primary broker URL stays the only commercial lander and best-broker still 301s', () => {
  assert.equal(existsSync(join(ROOT, 'medicare-broker-lakeland-fl/index.html')), true);
  assert.equal(existsSync(join(ROOT, 'best-medicare-broker-lakeland-fl/index.html')), false);
  const redirects = source('_redirects');
  assert.match(redirects, /\/best-medicare-broker-lakeland-fl\/ \/medicare-broker-lakeland-fl\/ 301!/);
  assert.doesNotMatch(redirects, /\/best-medicare-broker-lakeland-fl\/index\.html 200/);
});

test('primary broker snippet and FAQ cover licensed local agent language without ranking claims', () => {
  const html = source('medicare-broker-lakeland-fl/index.html');
  assert.match(html, /<title>Medicare Broker in Lakeland, FL \| Doctors, Rx &amp; AEP Review<\/title>/);
  assert.match(html, /Licensed Florida health agent \(FL #W371813\)/);
  assert.match(html, /<h1>Medicare broker in Lakeland, FL — licensed local agent for doctors, prescriptions, and AEP\.<\/h1>/);
  assert.match(html, /Licensed local Medicare agent · Lakeland, FL/);
  assert.match(html, /How do I find a licensed local Medicare agent in Lakeland\?/);
  assert.match(html, /If I search for a local Medicare agent, is a broker the same thing\?/);
  assert.match(html, /licensed Florida health agent \(FL #W371813 \/ NPN 18213932\)/);
  assert.match(html, /hero-actions[\s\S]*Call David[\s\S]*Get Help/);
  assert.match(html, /<strong>Doctors and facilities<\/strong>/);
  assert.match(html, /<strong>Prescriptions<\/strong>/);
  assert.match(html, /<strong>Annual cost<\/strong>/);
  assert.doesNotMatch(html, /\b(?:#1|number one|top-rated|best medicare broker)\b/i);
  assert.doesNotMatch(html, /Florida Blue|HealthMarkets|broker license/i);

  const issues = findFaqVisibleMatchIssues('medicare-broker-lakeland-fl/index.html', html);
  assert.deepEqual(issues, [], issues.join('\n'));

  const faq = jsonLdNodes(html).find((node) => node['@type'] === 'FAQPage');
  const names = (faq?.mainEntity || []).map((item) => item.name);
  assert.ok(names.includes('How do I find a licensed local Medicare agent in Lakeland?'));
  assert.ok(names.includes('If I search for a local Medicare agent, is a broker the same thing?'));
});

test('homepage Medicare paths, Medicare hub, and working-past-65 link only to the primary broker URL', () => {
  const pages = [
    ['index.html', /href="\/medicare-broker-lakeland-fl\/">Medicare broker in Lakeland</],
    ['medicare/index.html', /href="\/medicare-broker-lakeland-fl\/"/],
    ['working-past-65-medicare-lakeland-fl/index.html', /href="\/medicare-broker-lakeland-fl\/">Licensed Lakeland Medicare agent</]
  ];
  for (const [rel, required] of pages) {
    const html = source(rel);
    assert.match(html, required, `${rel} links to ${PRIMARY}`);
    assert.doesNotMatch(html, /href="\/best-medicare-broker-lakeland-fl\//, `${rel} must not link to ${BEST}`);
    assert.doesNotMatch(html, /href="\/local-medicare-broker-lakeland-fl\//, `${rel} must not invent a doorway`);
    assert.doesNotMatch(html, /Florida Blue|HealthMarkets/i, `${rel} must not add carrier or HealthMarkets branding`);
  }
  assert.match(source('index.html'), /href="\/medicare-broker-lakeland-fl\/"[\s\S]*Local Medicare agent/);
});
