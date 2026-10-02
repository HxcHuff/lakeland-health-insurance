import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

function source(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

const REFUND = 'blog/healthcare-gov-500-refund-checks-florida.html';
const ENDING = 'blog/marketplace-plan-ending-2027.html';
const EXCLUDED_CARRIER = /\b(?:Aetna|FL\s*Blue|Florida\s+Blue|Capital\s+(?:HP|Health\s+Plan)|Bright\s+Health|Medica|Wellmark|Cigna|Ambetter|Sunshine|Molina)\b/i;

test('refund and plan-ending posts are listed, sourced, and carrier-neutral', () => {
  const refund = source(REFUND);
  const ending = source(ENDING);
  const index = source('blog/index.html');
  const sitemap = source('sitemap.xml');
  const search = source('js/site-search.js');

  assert.match(refund, /<title>\$500 HealthCare.gov Refund Checks in Florida: Who Gets One<\/title>/);
  assert.match(ending, /<title>My Marketplace Plan Is Ending in 2027\. What Now\?<\/title>/);

  assert.match(refund, /127,900/);
  assert.match(refund, /https:\/\/www\.cnbc\.com\/2026\/09\/30\/obamacare-aca-refund-checks\.html/);
  assert.match(refund, /https:\/\/www\.whitehouse\.gov\/fact-sheets\/2026\/09\/fact-sheet-president-donald-j-trump-announces-the-working-families-obamacare-refunds\//);
  assert.match(refund, /https:\/\/consumer\.ftc\.gov\/articles\/how-avoid-government-impersonation-scam/);
  assert.match(refund, /https:\/\/www\.healthcare\.gov\/quick-guide\/dates-and-deadlines\//);
  assert.match(refund, /Do I have to apply for the \$500 HealthCare.gov payment\?/);
  assert.doesNotMatch(refund, /\b(?:avoid|beat|escape|expose|outsmart|stop)\s+(?:the\s+)?scam\b/i);
  assert.doesNotMatch(refund, /\bfree\b/i);

  assert.match(ending, /https:\/\/www\.healthcare\.gov\/keep-or-change-plan\//);
  assert.match(ending, /https:\/\/www\.healthcare\.gov\/keep-or-change-plan\/automatically-enrolled\//);
  assert.match(ending, /https:\/\/www\.healthcare\.gov\/quick-guide\/dates-and-deadlines\//);
  assert.match(ending, /Do my doctors and prescriptions automatically carry over\?/);
  assert.match(ending, /December 15/);
  assert.doesNotMatch(ending, EXCLUDED_CARRIER);
  assert.doesNotMatch(refund, EXCLUDED_CARRIER);

  assert.match(index, /\/blog\/healthcare-gov-500-refund-checks-florida\.html/);
  assert.match(index, /\/blog\/marketplace-plan-ending-2027\.html/);
  assert.match(sitemap, /<loc>https:\/\/lakelandhealthinsurance\.com\/blog\/healthcare-gov-500-refund-checks-florida\.html<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/lakelandhealthinsurance\.com\/blog\/marketplace-plan-ending-2027\.html<\/loc>/);
  assert.match(search, /\/blog\/healthcare-gov-500-refund-checks-florida\.html/);
  assert.match(search, /\/blog\/marketplace-plan-ending-2027\.html/);
});
