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
      /no separate agent fee/i,
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
  },
  {
    prompt: 'Which states is David Huff licensed in for ACA Marketplace help?',
    rel: 'states/index.html',
    url: '/states/',
    mustMatch: [
      /Direct answer:/i,
      /22 states/,
      /licensed health agent/i,
      /href="\/health-insurance-texas\//,
      /href="\/aca-health-insurance-lakeland-fl\//,
      /href="\/aca-health-insurance-agent-polk-county-fl\//,
      /href="\/medicare\//,
      /href="\/get-help\//
    ]
  },
  {
    prompt: 'Texas ACA health insurance agent for 2027 HealthCare.gov',
    rel: 'health-insurance-texas/index.html',
    url: '/health-insurance-texas/',
    mustMatch: [
      /Direct answer:/i,
      /HealthCare\.gov/,
      /licensed health agent/i,
      /Lakeland, FL 33805/,
      /href="\/get-help\/\?state=TX/,
      /href="\/states\//,
      /review is not enrollment/i,
      /no separate agent fee/i
    ]
  },
  {
    prompt: 'North Carolina ACA Marketplace agent for 2027 open enrollment',
    rel: 'health-insurance-north-carolina/index.html',
    url: '/health-insurance-north-carolina/',
    mustMatch: [
      /Direct answer:/i,
      /HealthCare\.gov/,
      /href="\/get-help\/\?state=NC/,
      /under 65 who are not on Medicare/i
    ]
  },
  {
    prompt: 'South Carolina ACA health insurance agent HealthCare.gov 2027',
    rel: 'health-insurance-south-carolina/index.html',
    url: '/health-insurance-south-carolina/',
    mustMatch: [
      /Direct answer:/i,
      /HealthCare\.gov/,
      /href="\/get-help\/\?state=SC/
    ]
  },
  {
    prompt: 'Tennessee ACA Marketplace plan review for 2027',
    rel: 'health-insurance-tennessee/index.html',
    url: '/health-insurance-tennessee/',
    mustMatch: [
      /Direct answer:/i,
      /HealthCare\.gov/,
      /href="\/get-help\/\?state=TN/
    ]
  },
  {
    prompt: 'Alabama ACA health insurance agent for HealthCare.gov 2027',
    rel: 'health-insurance-alabama/index.html',
    url: '/health-insurance-alabama/',
    mustMatch: [
      /Direct answer:/i,
      /HealthCare\.gov/,
      /href="\/get-help\/\?state=AL/
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
