import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://lakelandhealthinsurance.com';
const SITEMAP = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const SITEMAP_INDEX = readFileSync(join(ROOT, 'sitemap_index.xml'), 'utf8');
const SITE_TEMPLATE = readFileSync(join(ROOT, 'js/site-template.js'), 'utf8');
const TPMO = 'We do not offer every plan available in your area. Currently we represent 10 organizations which offer 73 products in your area.';

const LIVE = [
  ['states/index.html', '/states/'],
  ['health-insurance-texas/index.html', '/health-insurance-texas/'],
  ['health-insurance-north-carolina/index.html', '/health-insurance-north-carolina/'],
  ['health-insurance-south-carolina/index.html', '/health-insurance-south-carolina/'],
  ['health-insurance-tennessee/index.html', '/health-insurance-tennessee/'],
  ['health-insurance-alabama/index.html', '/health-insurance-alabama/']
];

const ALL_STATE_HTML = [
  ...LIVE,
  ['health-insurance-georgia/index.html', '/health-insurance-georgia/']
];

function source(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => JSON.parse(match[1]));
}

test('sitemap index is a real XML index pointing at sitemap.xml, not a 404 page', () => {
  assert.match(SITEMAP_INDEX, /<sitemapindex\b/);
  assert.match(SITEMAP_INDEX, /<loc>https:\/\/lakelandhealthinsurance.com\/sitemap.xml<\/loc>/);
  assert.doesNotMatch(SITEMAP_INDEX, /<html\b/i);
  assert.doesNotMatch(SITEMAP_INDEX, /\b404\b/);
  assert.match(readFileSync(join(ROOT, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/lakelandhealthinsurance.com\/sitemap.xml/);
  assert.match(readFileSync(join(ROOT, '_headers'), 'utf8'), /\/sitemap_index\.xml/);
});

test('live hub and Wave 1 FFE pages are indexable and listed in sitemap.xml', () => {
  for (const [rel, url] of LIVE) {
    const html = source(rel);
    assert.match(html, /<meta name="robots" content="index, follow">/);
    assert.match(SITEMAP, new RegExp(`<loc>${ORIGIN}${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`));
    assert.equal(existsSync(join(ROOT, rel)), true);
  }
});

test('Georgia stays noindex until Access certification is confirmed and is omitted from the sitemap', () => {
  const html = source('health-insurance-georgia/index.html');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /\[TODO: Georgia Access PY2027 certification/);
  assert.doesNotMatch(SITEMAP, /health-insurance-georgia/);
  assert.match(readFileSync(join(ROOT, '_headers'), 'utf8'), /\/health-insurance-georgia\/\n\s+X-Robots-Tag: noindex, nofollow/);
});

test('state pages and the hub are ACA/under-65 only and do not ship Florida Medicare TPMO copy', () => {
  for (const [rel] of ALL_STATE_HTML) {
    const html = source(rel);
    assert.doesNotMatch(html, new RegExp(TPMO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(html, /footer-tpmo/);
    assert.doesNotMatch(html, /Medicare Advantage|Medigap|Part D|1-800-MEDICARE/i);
    assert.doesNotMatch(html, /HealthMarkets|Florida Blue/i);
    assert.doesNotMatch(html, /33801|2298 Lakeland Hills/);
    assert.doesNotMatch(html, /href="\/provider-prescription-check\//);
    assert.doesNotMatch(html, /I hold a Alabama/);
    assert.match(html, /licensed health agent/i);
    assert.match(html, /Lakeland, FL 33805/);
    assert.match(html, /under 65 who are not on Medicare/i);
  }
});

test('state-page JSON-LD includes InsuranceAgency, Service areaServed, breadcrumbs, and matching FAQPage text', () => {
  for (const [rel, url] of ALL_STATE_HTML) {
    if (rel.startsWith('states/')) continue;
    const html = source(rel);
    const blocks = jsonLdBlocks(html);
    const graphDoc = blocks.find((block) => Array.isArray(block['@graph']));
    const faqDoc = blocks.find((block) => block['@type'] === 'FAQPage');
    assert.ok(graphDoc, `${rel} has an @graph block`);
    const types = graphDoc['@graph'].flatMap((node) => [].concat(node['@type']));
    assert.ok(types.includes('InsuranceAgency'), `${rel} includes InsuranceAgency`);
    const service = graphDoc['@graph'].find((node) => node['@type'] === 'Service');
    assert.equal(service?.areaServed?.['@type'], 'State');
    assert.ok(graphDoc['@graph'].some((node) => node['@type'] === 'BreadcrumbList'));
    assert.ok(faqDoc, `${rel} includes FAQPage`);
    for (const question of faqDoc.mainEntity) {
      const name = question.name;
      const text = question.acceptedAnswer.text;
      assert.ok(html.includes(name), `${rel} visible FAQ is missing ${name}`);
      assert.ok(html.includes(text), `${rel} FAQPage text does not match visible copy for ${name}`);
    }
    const georgiaService = service?.areaServed?.name === 'Georgia';
    if (georgiaService) {
      assert.equal(service.areaServed.sameAs, 'https://en.wikipedia.org/wiki/Georgia_(U.S._state)');
    }
    assert.match(html, new RegExp(`<link rel="canonical" href="${ORIGIN}${url}">`));
  }
});

test('hub lists all 21 licensed states and routes Florida to existing pages', () => {
  const html = source('states/index.html');
  for (const name of [
    'Alabama', 'Arizona', 'Florida', 'Georgia', 'Iowa', 'Indiana', 'Louisiana',
    'Maryland', 'Michigan', 'Missouri', 'Mississippi', 'North Carolina', 'Nebraska',
    'New Jersey', 'Ohio', 'South Carolina', 'Tennessee', 'Texas', 'Virginia',
    'Washington', 'West Virginia'
  ]) {
    assert.match(html, new RegExp(name));
  }
  assert.match(html, /href="\/aca-health-insurance-lakeland-fl\/"/);
  assert.match(html, /href="\/aca-health-insurance-agent-polk-county-fl\/"/);
  assert.match(html, /href="\/medicare\/"/);
  assert.match(html, /Medicare \(Florida only\)/);
  assert.doesNotMatch(html, /href="\/health-insurance-florida\//);
  assert.doesNotMatch(html, /href="\/health-insurance-arizona\//);
  const graph = jsonLdBlocks(html).find((block) => Array.isArray(block['@graph']));
  const collection = graph['@graph'].find((node) => node['@type'] === 'CollectionPage');
  assert.equal(collection.areaServed.length, 21);
});

test('shared chrome skips TPMO and HealthSherpa on multi-state pages without changing Florida-only license wording', () => {
  const sandbox = {
    document: { readyState: 'loading', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, body: { getAttribute() { return ''; } } },
    location: { pathname: '/', search: '' },
    window: {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SITE_TEMPLATE, sandbox, { filename: 'site-template.js' });
  const chrome = sandbox.LHISiteChrome;
  assert.equal(chrome.isMultiStatePage('/states/'), true);
  assert.equal(chrome.isMultiStatePage('/health-insurance-texas/'), true);
  assert.equal(chrome.isMultiStatePage('/health-insurance-broker-lakeland-fl/'), false);
  assert.equal(chrome.shouldShowTpmoDisclaimer('/health-insurance-alabama/'), false);
  assert.match(SITE_TEMPLATE, /States I'm licensed in/);
  assert.match(SITE_TEMPLATE, /Licensed Florida health agent #W371813/);
  assert.match(SITE_TEMPLATE, /Remote assistance across Florida/);
  assert.match(SITE_TEMPLATE, /Lakeland-based health insurance assistance for Florida residents/);
});
