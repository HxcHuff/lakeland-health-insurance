import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  'blog/lakeland-regional-health-insurance-accepted.html',
  'blog/polk-healthcare-plan-eligibility.html',
  'blog/dedicated-senior-medical-center-lakeland.html',
  'blog/winter-haven-hospital-insurance.html',
  'blog/adventhealth-heart-of-florida-insurance.html',
  'blog/lrh-physician-group-insurance.html',
  'blog/lakeland-regional-freestanding-emergency-department.html',
  'blog/central-florida-health-care-polk-county.html',
  'blog/lakeland-regional-urgent-care.html',
  'blog/bartow-regional-medical-center-insurance.html',
  'blog/bond-clinic-winter-haven-insurance.html',
  'blog/gessler-clinic-insurance.html',
  'blog/adventhealth-lake-wales-insurance.html',
  'blog/carol-jenkins-barnett-pavilion-insurance.html',
  'blog/hollis-cancer-center-lakeland-insurance.html',
  'blog/harrell-family-center-for-behavioral-wellness-lakeland.html',
  'blog/hca-florida-lakeland-emergency.html',
  'blog/hca-florida-north-lakeland-emergency.html',
  'blog/watson-clinic-urgent-care.html',
  'blog/centra-care-lakeland.html',
  'blog/lakeland-va-clinic-medicare.html',
  'blog/encompass-health-lakeland-insurance.html',
  'blog/johns-hopkins-all-childrens-lakeland-insurance.html',
  'blog/lakeland-volunteers-in-medicine.html',
  'blog/palm-medical-centers-lakeland.html',
  'blog/good-shepherd-hospice-lakeland-medicare.html',
  'blog/peace-river-center-bartow.html',
  'blog/winter-haven-womens-hospital-insurance.html',
  'blog/cassidy-cancer-center-winter-haven.html',
  'blog/hca-florida-auburndale-emergency.html',
  'blog/hca-florida-haines-city-emergency.html',
  'blog/adventhealth-haines-city.html',
  'blog/florida-cancer-specialists-davenport.html',
  'blog/baycare-urgent-care-lakeland.html',
  'blog/md-now-lakeland.html',
  'blog/owl-now-urgent-care.html',
  'blog/concentra-lakeland.html',
  'blog/sunshine-urgent-care-lakeland.html',
  'blog/tri-county-human-services-lakeland.html',
  'blog/polk-county-health-department-clinic.html',
  'blog/baycare-behavioral-health-winter-haven.html',
  'blog/baycare-urgent-care-winter-haven.html',
  'blog/centra-care-winter-haven.html',
  'blog/central-florida-health-care-winter-haven.html',
  'blog/lakeland-regional-lake-wales.html',
  'blog/baycare-urgent-care-haines-city.html',
  'blog/centra-care-four-corners.html',
  'blog/elon-health-urgent-care-davenport.html',
  'blog/doctor-mulberry-fl.html',
  'blog/doctor-frostproof-fl.html',
  'local-health-insurance-answers/watson-clinic-insurance-network-help/index.html'
];

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function faqPages(html) {
  const pages = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const data = JSON.parse(match[1]);
    const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
    for (const node of nodes) {
      if (node && node['@type'] === 'FAQPage') pages.push(node);
    }
  }
  return pages;
}

function hasVisibleFaq(html) {
  return /<h2[^>]*>\s*(Common questions|FAQ)\s*<\/h2>/i.test(html);
}

test('visible FAQ matches FAQPage JSON-LD word for word on new facility posts', () => {
  for (const rel of FILES) {
    const html = readFileSync(resolve(ROOT, rel), 'utf8');
    const visible = decodeEntities(html);
    const pages = faqPages(html);
    if (!hasVisibleFaq(html)) {
      assert.equal(pages.length, 0, `${rel} has no visible FAQ so it must not include FAQPage`);
      continue;
    }
    assert.ok(pages.length >= 1, `${rel} has a visible FAQ but no FAQPage`);
    for (const question of pages[0].mainEntity || []) {
      assert.ok(visible.includes(question.name), `${rel} visible FAQ is missing ${question.name}`);
      assert.ok(visible.includes(question.acceptedAnswer.text), `${rel} FAQPage text does not match visible copy for ${question.name}`);
    }
  }
});
