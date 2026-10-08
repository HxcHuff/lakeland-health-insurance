import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const DOC = readFileSync(resolve(ROOT, 'docs/consent-versions.md'), 'utf8');
const SITELINK_V1_REQUEST =
  'I am asking Lakeland Health Insurance to review and respond to this insurance request. I understand this is not an enrollment, eligibility determination, or proof of coverage.';
const SITELINK_PAGES = [
  'blog/index.html',
  'carriers/index.html',
  'dental-vision/index.html',
  'medicare/index.html',
  'plans/index.html',
  'private-medical-insurance/index.html',
  'supplemental-insurance/index.html'
];
const CITY_PAGES = [
  'brandon-health-insurance/index.html',
  'clearwater-health-insurance/index.html',
  'davenport-health-insurance/index.html',
  'haines-city-health-insurance/index.html',
  'lake-alfred-health-insurance/index.html',
  'largo-health-insurance/index.html',
  'new-port-richey-health-insurance/index.html',
  'riverview-health-insurance/index.html',
  'st-petersburg-health-insurance/index.html',
  'tampa-health-insurance/index.html',
  'wesley-chapel-health-insurance/index.html',
  'winter-haven-health-insurance/index.html'
];

function parseConsentDoc(markdown) {
  const sections = [];
  const parts = markdown.split(/^## /m).slice(1);
  for (const part of parts) {
    const lines = part.split('\n');
    const id = lines[0].trim();
    const superseded = /^\s*- Status: superseded\b/m.test(part);
    const pages = [...part.matchAll(/^\s+- `([^`]+\.html)`$/gm)].map((match) => match[1]);
    const labels = {};
    const labelBlocks = part.split(/^### /m).slice(1);
    for (const block of labelBlocks) {
      const name = block.split('\n', 1)[0].trim();
      const html = block.match(/```html\n([\s\S]*?)\n```/);
      if (html) labels[name] = html[1];
    }
    sections.push({ id, pages, labels, superseded });
  }
  return sections;
}

test('documented consent label text matches the live HTML on every listed page', () => {
  const sections = parseConsentDoc(DOC);
  assert.deepEqual(sections.map((section) => section.id), [
    'get-help-2026-07-30-v1',
    'get-help-2026-09-29-v2',
    'lp-aca-2026-09-29-v1',
    'lp-medicare-2026-09-29-v1',
    'lp-gap-2026-09-29-v1',
    'lp-aca-2026-09-29-v2',
    'lp-medicare-2026-09-29-v2',
    'lp-gap-2026-09-29-v2',
    'homepage-newsletter-2026-10-07-v1',
    'newsletter-signup-2026-10-07-v1',
    'none'
  ]);

  for (const section of sections) {
    assert.ok(section.pages.length > 0, `${section.id} lists pages`);
    if (section.superseded) {
      assert.ok(Object.keys(section.labels).length > 0, `${section.id} keeps superseded label text`);
      continue;
    }
    for (const rel of section.pages) {
      const html = readFileSync(resolve(ROOT, rel), 'utf8');
      for (const [name, text] of Object.entries(section.labels)) {
        assert.ok(html.includes(text), `${rel} still contains ${section.id} ${name} label`);
      }
    }
  }
});

test('private-medical request-consent sentence matches the other sitelink v1 forms byte for byte', () => {
  const sentences = SITELINK_PAGES.map((rel) => {
    const html = readFileSync(resolve(ROOT, rel), 'utf8');
    const match = html.match(/<label class="sitelink-request-consent">[\s\S]*?<span>([\s\S]*?)<\/span><\/label>/);
    assert.ok(match, `${rel} has a sitelink request-consent sentence`);
    return { rel, sentence: match[1] };
  });

  for (const { rel, sentence } of sentences) {
    assert.equal(sentence, SITELINK_V1_REQUEST, rel);
  }
  assert.match(
    readFileSync(resolve(ROOT, 'private-medical-insurance/index.html'), 'utf8'),
    /name="consent_text_version" value="get-help-2026-07-30-v1"/
  );
});

test('city health-insurance forms have no SMS checkbox', () => {
  for (const rel of CITY_PAGES) {
    const html = readFileSync(resolve(ROOT, rel), 'utf8');
    assert.doesNotMatch(html, /name="consent_sms"/, rel);
    assert.doesNotMatch(html, /name="consent_text_version"/, rel);
    assert.doesNotMatch(html, /Reply STOP to cancel/i, rel);
  }
});

test('get-help keeps the v2 consent version and has no marketing-email list fields', () => {
  const html = readFileSync(resolve(ROOT, 'get-help/index.html'), 'utf8');
  assert.doesNotMatch(html, /ongoing educational and marketing emails/);
  assert.match(html, /name="consent_text_version" value="get-help-2026-09-29-v2"/);
});

test('lp-gap declares the server-set consent fields lead.js forwards', () => {
  const html = readFileSync(resolve(ROOT, 'lp/gap/index.html'), 'utf8');
  const form = html.match(/<form id="gapLeadForm"[\s\S]*?<\/form>/)[0];
  for (const field of [
    'consent_sms_state',
    'consent_email_state',
    'consent_call_state',
    'consent_recorded_at',
    'consent_page',
    'consent_sms',
    'consent_call',
    'consent_email',
    'consent_version_source',
    'consent_version_mismatch',
    'event_id',
    'server_received_at',
    'source_url'
  ]) {
    assert.match(form, new RegExp(`name="${field}"`), field);
  }
  assert.match(form, /name="consent_page" value="\/lp\/gap\/"/);
  assert.match(form, /name="consent_text_version" value="lp-gap-2026-09-29-v2"/);
});

test('lp lead forms send their dedicated consent_text_version hidden fields', () => {
  const cases = [
    ['lp/aca/index.html', 'lp-aca-lead', 'lp-aca-2026-09-29-v2'],
    ['lp/medicare/index.html', 'lp-medicare-lead', 'lp-medicare-2026-09-29-v2'],
    ['lp/gap/index.html', 'lp-gap-lead', 'lp-gap-2026-09-29-v2']
  ];
  for (const [rel, formName, version] of cases) {
    const html = readFileSync(resolve(ROOT, rel), 'utf8');
    assert.match(html, new RegExp(`name="form-name" value="${formName}"`));
    assert.match(html, new RegExp(`name="consent_text_version" value="${version}"`));
  }
});

test('lp consent checkboxes stay optional and unchecked by default', () => {
  for (const rel of ['lp/aca/index.html', 'lp/medicare/index.html', 'lp/gap/index.html']) {
    const html = readFileSync(resolve(ROOT, rel), 'utf8');
    const checkbox = html.match(/<input type="checkbox" id="consent" name="consent" value="yes">/);
    assert.ok(checkbox, `${rel} keeps the optional consent checkbox`);
    assert.doesNotMatch(html, /<input type="checkbox" id="consent"[^>]*\brequired\b/, `${rel} consent is not required`);
    assert.doesNotMatch(html, /<input type="checkbox" id="consent"[^>]*\bchecked\b/, `${rel} consent is unchecked`);
    assert.doesNotMatch(html, /please agree/i, `${rel} has no please-agree gate copy`);
  }
});
