import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const agencyId = 'https://lakelandhealthinsurance.com/#agency';
const personId = 'https://lakelandhealthinsurance.com/about/#david-huff';
const websiteId = 'https://lakelandhealthinsurance.com/#website';

const corePages = [
  'index.html',
  'about/index.html',
  'contact/index.html',
  'our-approach.html',
  'plans/index.html',
  'get-help/index.html'
];

const answerPages = [
  'blog/lost-job-coverage-aca-insurance-florida.html',
  'blog/aca-subsidy-wrong-income-florida.html',
  'blog/medicare-advantage-vs-supplement.html',
  'blog/keep-doctor-switch-medicare-plans-florida.html',
  'blog/health-insurance-too-much-income-aca-subsidy-florida.html',
  'blog/common-medicare-health-insurance-questions-florida.html'
];

const sharedTemplateFiles = [
  'blog/index.html',
  'js/site-template.js',
  'js/blog-cta.js'
];

function jsonLdBlocks(html, file) {
  const matches = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return matches.map((match, index) => {
    try {
      return JSON.parse(match[1]);
    } catch (error) {
      throw new Error(`${file} JSON-LD block ${index + 1} is invalid: ${error.message}`);
    }
  });
}

function flatten(value, output = []) {
  if (!value || typeof value !== 'object') return output;
  output.push(value);
  if (Array.isArray(value)) {
    for (const item of value) flatten(item, output);
    return output;
  }
  for (const child of Object.values(value)) flatten(child, output);
  return output;
}

test('canonical website, agency, and David Huff entities use stable identifiers', async () => {
  const homepage = await readFile('index.html', 'utf8');
  const about = await readFile('about/index.html', 'utf8');
  const nodes = flatten([...jsonLdBlocks(homepage, 'index.html'), ...jsonLdBlocks(about, 'about/index.html')]);

  assert.ok(nodes.some((node) => node['@id'] === websiteId && node['@type'] === 'WebSite'));
  assert.ok(nodes.some((node) => node['@id'] === agencyId && node['@type'] === 'InsuranceAgency'));
  assert.ok(nodes.some((node) => node['@id'] === personId && node['@type'] === 'Person'));
});

test('core authority pages retain the approved Florida identity facts', async () => {
  for (const file of corePages) {
    const html = await readFile(file, 'utf8');
    jsonLdBlocks(html, file);
    assert.doesNotMatch(html, /david@lakelandhealthinsurance\.com/i, `${file} has the retired email`);
    assert.doesNotMatch(html, /serving most of the United States|serving families and businesses nationwide|coverage across the nation/i, `${file} has an unverified nationwide claim`);
  }

  for (const file of sharedTemplateFiles) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /serving most of the United States|serving families and businesses (?:nationwide|across the nation)|coverage across the nation|get free quote/i, `${file} has retired identity or CTA copy`);
  }

  const homepage = await readFile('index.html', 'utf8');
  const about = await readFile('about/index.html', 'utf8');
  const contact = await readFile('contact/index.html', 'utf8');
  for (const [file, html] of [['index.html', homepage], ['about/index.html', about], ['contact/index.html', contact]]) {
    assert.match(html, /W371813/, `${file} is missing the Florida license`);
    assert.match(html, /18213932/, `${file} is missing the NPN`);
    assert.match(html, /dhuff@healthmarkets\.com/, `${file} is missing the approved email`);
  }
});

test('answer pages connect to canonical entities and retain GEO conversion elements', async () => {
  for (const file of answerPages) {
    const html = await readFile(file, 'utf8');
    const nodes = flatten(jsonLdBlocks(html, file));

    assert.ok(nodes.some((node) => node['@id'] === personId), `${file} is missing the canonical David Huff entity`);
    assert.ok(nodes.some((node) => node['@id'] === agencyId), `${file} is missing the canonical agency entity`);
    assert.ok(nodes.some((node) => node['@id'] === websiteId), `${file} is missing the canonical website relationship`);
    assert.ok(nodes.some((node) => node['@type'] === 'FAQPage'), `${file} is missing FAQPage schema`);
    assert.match(html, /class=["'][^"']*key-answer/, `${file} is missing a direct-answer section`);
    assert.match(html, /When to talk to David/i, `${file} is missing the David guidance section`);
    assert.match(html, /href=["']\/get-help\//, `${file} is missing the Get Help link`);
    assert.match(html, /disclosure/i, `${file} is missing a visible disclosure`);
  }
});

test('the common questions article covers the four approved consumer questions', async () => {
  const file = 'blog/common-medicare-health-insurance-questions-florida.html';
  const html = await readFile(file, 'utf8');
  const requiredQuestions = [
    'How do I sign up for Medicare?',
    'How do I sign up for Medicare Part D?',
    'What happens if I do not sign up for Medicare?',
    'I just lost my job and need health insurance. What should I do?'
  ];

  for (const question of requiredQuestions) {
    assert.match(html, new RegExp(question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }

  assert.match(html, /ssa\.gov\/medicare\/sign-up/);
  assert.match(html, /medicare\.gov\/health-drug-plans\/part-d/);
  assert.match(html, /healthcare\.gov\/have-job-based-coverage\/if-you-lose-job-based-coverage/);
});
