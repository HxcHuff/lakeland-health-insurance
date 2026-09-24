import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const SITEMAP = readFileSync(resolve(ROOT, 'sitemap.xml'), 'utf8');

const OWNERS = [
  {
    prompt: 'Who is the best health insurance broker in Lakeland FL?',
    rel: 'health-insurance-broker-lakeland-fl/index.html',
    url: '/health-insurance-broker-lakeland-fl/',
    mustMatch: [
      /Direct answer:/i,
      /FL(?:orida)? License #W371813/i,
      /Lakeland, FL 33805/i,
      /href="\/get-help\//,
      /href="\/medicare-broker-lakeland-fl\//,
      /href="\/aca-health-insurance-lakeland-fl\//,
      /href="\/aca-health-insurance-agent-polk-county-fl\//,
      /href="\/marketplace-agent-fraud-cms-crackdown-florida\//,
      /href="\/coverage-center\//
    ]
  },
  {
    prompt: 'Best ACA health insurance agent near me in Polk County Florida',
    rel: 'aca-health-insurance-agent-polk-county-fl/index.html',
    url: '/aca-health-insurance-agent-polk-county-fl/',
    mustMatch: [
      /Direct answer:/i,
      /authorize HealthCare\.gov/i,
      /FL(?:orida)?(?: License)? #W371813/i,
      /Lakeland, FL 33805/,
      /review is not enrollment/i,
      /no separate broker fee/i,
      /href="\/get-help\//,
      /href="\/marketplace-agent-fraud-cms-crackdown-florida\//,
      /href="\/provider-prescription-check\//,
      /href="\/aca-health-insurance-lakeland-fl\//,
      /Polk County/
    ]
  },
  {
    prompt: 'Compare ACA health insurance in Polk County for doctors and prescriptions',
    rel: 'aca-health-insurance-agent-polk-county-fl/index.html',
    url: '/aca-health-insurance-agent-polk-county-fl/',
    mustMatch: [
      /doctors and prescriptions/i,
      /href="\/provider-prescription-check\//,
      /Watson Clinic/,
      /Lakeland Regional Health/,
      /href="\/get-help\//
    ]
  },
  {
    prompt: 'Compare ACA doctors and prescriptions in Polk County Florida',
    rel: 'provider-prescription-check/index.html',
    url: '/provider-prescription-check/',
    mustMatch: [
      /compare ACA plans in Polk County/i,
      /href="\/aca-health-insurance-agent-polk-county-fl\//,
      /href="\/get-help\//
    ]
  },
  {
    prompt: 'ACA Marketplace eligibility and Open Enrollment in Lakeland FL',
    rel: 'aca-health-insurance-lakeland-fl/index.html',
    url: '/aca-health-insurance-lakeland-fl/',
    mustMatch: [
      /Direct answer:/i,
      /href="\/aca-health-insurance-agent-polk-county-fl\//,
      /href="\/provider-prescription-check\//,
      /href="\/get-help\/\?intent=aca"/,
      /Open Enrollment/
    ]
  },
  {
    prompt: 'I lost my job and need health insurance in Lakeland FL — who can help?',
    rel: 'losing-coverage/index.html',
    url: '/losing-coverage/',
    mustMatch: [
      /Direct answer:/i,
      /Lakeland, FL 33805/,
      /href="\/get-help\/\?intent=lost-coverage"/,
      /COBRA/,
      /Special Enrollment Period/,
      /href="\/local-health-insurance-answers\/employee-losing-group-coverage\//
    ]
  },
  {
    prompt: 'Who can help me review Medicare Advantage plans in Lakeland FL?',
    rel: 'medicare-broker-lakeland-fl/index.html',
    url: '/medicare-broker-lakeland-fl/',
    mustMatch: [
      /Direct answer:/i,
      /Medicare Advantage/,
      /FL #W371813/,
      /href="\/get-help\/\?intent=medicare/
    ]
  },
  {
    prompt: 'Self-employed health insurance options in Florida with a local broker',
    rel: 'self-employed-health-insurance/index.html',
    url: '/self-employed-health-insurance/',
    mustMatch: [
      /Direct answer:/i,
      /projected (?:annual )?household income/i,
      /Lakeland, FL 33805/,
      /href="\/get-help\/\?intent=self-employed"/,
      /href="\/aca-health-insurance-agent-polk-county-fl\//,
      /href="\/provider-prescription-check\//
    ]
  }
];

const FORBIDDEN = /#1 broker|best broker in (?:lakeland|florida) is|aggregateRating|"@type"\s*:\s*"Review"/;

for (const owner of OWNERS) {
  test(`${owner.prompt} has a cite-ready owner at ${owner.url}`, () => {
    const html = readFileSync(resolve(ROOT, owner.rel), 'utf8');
    const escaped = owner.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(html, new RegExp(`<link rel="canonical" href="https://lakelandhealthinsurance.com${escaped}">`));
    assert.match(SITEMAP, new RegExp(`<loc>https://lakelandhealthinsurance.com${escaped}</loc>`));
    assert.doesNotMatch(html, FORBIDDEN);
    for (const pattern of owner.mustMatch) {
      assert.match(html, pattern);
    }
  });
}
