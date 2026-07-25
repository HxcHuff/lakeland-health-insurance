import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

const publicFunnels = [
  'coverage-change-checkup/index.html',
  'turning-65-medicare-countdown/index.html',
  'provider-prescription-check/index.html',
  'aging-off-26/index.html',
  'self-employed-income-checkup/index.html',
  'employer-offboarding/index.html'
];

const serviceFunnels = [
  'client-review/index.html',
  'post-enrollment-checkup/index.html'
];

function read(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

test('public intent funnels have canonical, analytics, forms, and sitemap entries', () => {
  const sitemap = read('sitemap.xml');
  for (const rel of publicFunnels) {
    const html = read(rel);
    const route = '/' + rel.replace('/index.html', '/') ;
    assert.match(html, /<link rel="canonical" href="https:\/\/lakelandhealthinsurance\.com\//, rel + ' canonical');
    assert.match(html, /\/js\/analytics\.js/, rel + ' analytics');
    assert.match(html, /data-intent-form/, rel + ' shared funnel form');
    assert.match(html, /data-funnel-track/, rel + ' funnel tracking');
    assert.match(html, /data-funnel-event="Lead"/, rel + ' lead event');
    assert.ok(sitemap.includes('https://lakelandhealthinsurance.com' + route), rel + ' sitemap entry');
  }
});

test('client lifecycle pages are noindex ServiceRequest forms', () => {
  for (const rel of serviceFunnels) {
    const html = read(rel);
    assert.match(html, /<meta name="robots" content="noindex, follow">/, rel + ' noindex');
    assert.match(html, /data-funnel-event="ServiceRequest"/, rel + ' service request event');
    assert.doesNotMatch(html, /data-funnel-event="Lead"/, rel + ' not lead event');
  }
});

test('new funnel pages avoid unsupported guarantee language', () => {
  const forbidden = [
    /guarantee(?:d)? eligibility/i,
    /guarantee(?:d)? savings/i,
    /all carriers/i,
    /nine times out of ten/i,
    /within one business day/i,
    /within 24 hours/i,
    /5-60 minutes/i
  ];
  for (const rel of [...publicFunnels, ...serviceFunnels, 'get-help/index.html', 'thanks.html']) {
    const html = read(rel);
    for (const pattern of forbidden) {
      assert.doesNotMatch(html, pattern, rel + ' avoids ' + pattern);
    }
  }
});

test('newsletter forms use Subscriber and preference segmentation', () => {
  for (const rel of ['index.html', 'newsletter/index.html']) {
    const html = read(rel);
    assert.match(html, /data-funnel-event="Subscriber"/, rel + ' subscriber event');
    assert.match(html, /name="newsletter_preference"/, rel + ' preference field');
  }
});
