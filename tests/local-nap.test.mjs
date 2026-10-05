import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const STREET = '2298 Lakeland Hills Blvd';
const MAPS_CID = 'https://www.google.com/maps?cid=5421693615683546210';
const BBB_HREF = 'https://www.bbb.org/us/fl/lakeland/profile/health-insurance/lakeland-health-insurance-0733-235981531/';
const VISIBLE_NAP = '2298 Lakeland Hills Blvd, Lakeland, FL 33805';
const AGENCY_LAT = 28.073688;
const AGENCY_LNG = -81.953367;
const SKIP_DIRS = new Set([
  '.git', '.netlify', '.claude', '.codex', '.playwright-cli',
  '.ai-worker-local', 'node_modules', 'output', 'netlify',
  'scripts', 'tests', 'search-engine-from-zip', 'audit'
]);

function source(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function walkHtml(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkHtml(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
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
    try {
      flatten(JSON.parse(match[1]), nodes);
    } catch {
      // Invalid JSON-LD is covered by other validators.
    }
  }
  return nodes;
}

test('homepage #agency JSON-LD includes 2298 streetAddress, phone, Maps sameAs, and verified geo', () => {
  const html = source('index.html');
  const agency = jsonLdNodes(html).find((node) => (
    node['@type'] === 'InsuranceAgency' && String(node['@id'] || '').endsWith('#agency')
  ));
  assert.ok(agency, 'homepage defines InsuranceAgency #agency');
  assert.equal(agency.address?.streetAddress, STREET);
  assert.equal(agency.address?.addressLocality, 'Lakeland');
  assert.equal(agency.address?.addressRegion, 'FL');
  assert.equal(agency.address?.postalCode, '33805');
  assert.equal(agency.address?.addressCountry, 'US');
  assert.equal(agency.telephone, '+1-863-640-3102');
  assert.ok(Array.isArray(agency.sameAs), 'agency sameAs is an array');
  assert.ok(agency.sameAs.includes(MAPS_CID), 'agency sameAs includes Maps cid');
  assert.ok(agency.sameAs.includes(BBB_HREF), 'agency sameAs includes homepage BBB URL');
  assert.equal(agency.sameAs.some((url) => /linkedin|facebook|healthmarkets/i.test(url)), false);
  assert.equal(agency.geo?.['@type'], 'GeoCoordinates');
  assert.equal(Number(agency.geo?.latitude), AGENCY_LAT);
  assert.equal(Number(agency.geo?.longitude), AGENCY_LNG);
});

test('footer partial and required visible NAP surfaces show 2298 street and By appointment', () => {
  const footer = source('js/site-template.js');
  assert.match(footer, /2298 Lakeland Hills Blvd, Lakeland, FL 33805 · By appointment/);
  assert.doesNotMatch(footer, /healthmarkets/i);

  const home = source('index.html');
  assert.match(home, /Lakeland Health Insurance · 2298 Lakeland Hills Blvd, Lakeland, FL 33805 · By appointment/);
  assert.match(home, /2298 Lakeland Hills Blvd, Lakeland, FL 33805 · By appointment/);

  const contact = source('contact/index.html');
  assert.match(contact, /<strong>Lakeland Health Insurance<\/strong><br>2298 Lakeland Hills Blvd, Lakeland, FL 33805<br>By appointment/);
  assert.match(contact, /2298 Lakeland Hills Blvd, Lakeland, FL 33805 · By appointment/);

  const about = source('about/index.html');
  assert.match(about, /Lakeland Health Insurance · 2298 Lakeland Hills Blvd, Lakeland, FL 33805 · By appointment/);
});

test('every InsuranceAgency #agency and Person #david-huff address uses the confirmed street', () => {
  const agencies = [];
  const people = [];
  for (const file of walkHtml()) {
    const rel = relative(ROOT, file);
    const nodes = jsonLdNodes(readFileSync(file, 'utf8'));
    for (const node of nodes) {
      const types = [].concat(node['@type']);
      const id = String(node['@id'] || '');
      if (types.includes('InsuranceAgency') && id.endsWith('#agency')) {
        agencies.push({ rel, node });
      }
      if (types.includes('Person') && id.endsWith('#david-huff') && node.address) {
        people.push({ rel, node });
      }
    }
  }

  assert.ok(agencies.length >= 8, `expected homepage, states hub, and state pages; found ${agencies.length}`);
  for (const { rel, node } of agencies) {
    assert.equal(node.address?.streetAddress, STREET, `${rel} #agency streetAddress`);
    assert.equal(node.telephone, '+1-863-640-3102', `${rel} #agency telephone`);
    assert.ok(Array.isArray(node.sameAs) && node.sameAs.includes(MAPS_CID), `${rel} #agency sameAs Maps cid`);
    assert.ok(node.sameAs.includes(BBB_HREF), `${rel} #agency sameAs BBB`);
    assert.equal(node.geo?.['@type'], 'GeoCoordinates', `${rel} #agency geo @type`);
    assert.equal(Number(node.geo?.latitude), AGENCY_LAT, `${rel} #agency latitude`);
    assert.equal(Number(node.geo?.longitude), AGENCY_LNG, `${rel} #agency longitude`);
  }

  assert.ok(people.length >= 2, `expected homepage and about Person addresses; found ${people.length}`);
  for (const { rel, node } of people) {
    assert.equal(node.address?.streetAddress, STREET, `${rel} Person streetAddress`);
    assert.equal(node.sameAs, undefined, `${rel} must not invent Person sameAs`);
  }

  assert.match(source('index.html'), new RegExp(VISIBLE_NAP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
