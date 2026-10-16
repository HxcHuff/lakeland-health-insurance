import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

/** Pages that carry the Oct 16, 2026 Watson teaser banner (not the dedicated 2027-plan post). */
export const WATSON_2026_UPDATE_BANNER_PAGES = [
  'local-health-insurance-answers/watson-clinic-insurance-network-help/index.html',
  'blog/orlando-health-watson-clinic-insurance-2026.html',
  'blog/orlando-health-watson-clinic-doctors-network-2026.html',
  'blog/watson-clinic-urgent-care.html',
  'blog/change-florida-blue-myblue-pcp-watson-clinic.html'
];

const BANNER_HEADING = 'Update (October 16, 2026)';
const BANNER_LEDE =
  'There is news about Orlando Health and Watson Clinic in Lakeland and Polk County—including Watson Clinic Lakeland Highlands—that is not published online yet. David Huff went straight to the source in a direct conversation with the clinic in October 2026.';
const BLOG_LINK = '/blog/orlando-health-watson-clinic-2027-plan.html';
const BANNED_IN_BANNER = /\b(framework|PCP|primary care|specialist|facilities)\b/i;

function readPage(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function extractUpdateBanner(html) {
  const match = html.match(
    /<section class="lhi-alert-notice" aria-labelledby="watson-update-20261016-heading">[\s\S]*?<\/section>/
  );
  return match?.[0] ?? '';
}

test('Watson Oct 16 update banner is on every qualifying page', () => {
  for (const rel of WATSON_2026_UPDATE_BANNER_PAGES) {
    const html = readPage(rel);
    assert.match(html, /id="watson-update-20261016-heading"/, rel);
    assert.match(html, new RegExp(BANNER_HEADING.replace(/[()]/g, '\\$&')), rel);
    assert.match(html, /href="tel:\+18636403102"/, rel);
    assert.match(html, /\(863\) 640-3102/, rel);
    assert.match(html, new RegExp(BLOG_LINK.replace(/\//g, '\\/')), rel);
  }
});

test('Watson update banner uses approved teaser copy and hard-limit terms', () => {
  for (const rel of WATSON_2026_UPDATE_BANNER_PAGES) {
    const banner = extractUpdateBanner(readPage(rel));
    assert.ok(banner.length > 0, `${rel} missing update banner block`);
    assert.match(banner, /Call or text \(863\) 640-3102/);
    assert.ok(banner.includes(BANNER_LEDE), `${rel} lede mismatch`);
    assert.doesNotMatch(banner, BANNED_IN_BANNER, `${rel} banned term in banner`);
  }
});

test('Humana notice follows Watson update banner when both are present', () => {
  const withHumana = WATSON_2026_UPDATE_BANNER_PAGES.filter((rel) => rel.includes('network-help') || rel.includes('insurance-2026') || rel.includes('doctors-network') || rel.includes('urgent-care'));
  for (const rel of withHumana) {
    const html = readPage(rel);
    const updateIdx = html.indexOf('watson-update-20261016-heading');
    const humanaIdx = html.indexOf('watson-humana-2027-heading');
    assert.ok(updateIdx >= 0 && humanaIdx >= 0, rel);
    assert.ok(updateIdx < humanaIdx, `${rel} update banner must precede Humana notice`);
  }
});

test('2027-plan blog keeps hero lede teaser without duplicate in-page banner', () => {
  const html = readPage('blog/orlando-health-watson-clinic-2027-plan.html');
  assert.doesNotMatch(html, /watson-update-20261016-heading/);
  assert.match(html, /direct conversation with the clinic in October 2026/);
});
