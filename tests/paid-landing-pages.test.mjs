import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const ACA = readFileSync(resolve(ROOT, 'lp/aca/index.html'), 'utf8');
const MEDICARE = readFileSync(resolve(ROOT, 'lp/medicare/index.html'), 'utf8');

const BRAND_LINE = 'Where enrollment is just the beginning of the relationship.';
const PHONE_HREF = 'tel:+18636403102';

function formFrom(html, name) {
  const form = html.match(new RegExp(`<form[^>]*name="${name}"[\\s\\S]*?<\\/form>`));
  assert.ok(form, `${name} form is present`);
  return form[0];
}

function headerFrom(html) {
  const header = html.match(/<header\b[\s\S]*?<\/header>/i);
  assert.ok(header, 'focused header is present');
  return header[0];
}

function footerFrom(html) {
  const footer = html.match(/<footer\b[\s\S]*?<\/footer>/i);
  assert.ok(footer, 'focused footer is present');
  return footer[0];
}

for (const [label, html, canonical, formName] of [
  ['ACA', ACA, 'https://lakelandhealthinsurance.com/lp/aca/', 'lp-aca-lead'],
  ['Medicare', MEDICARE, 'https://lakelandhealthinsurance.com/lp/medicare/', 'lp-medicare-lead']
]) {
  test(`${label} paid page preserves the ad-only route and focused chrome`, () => {
    assert.match(html, /<meta name="robots" content="noindex, follow">/);
    assert.match(html, new RegExp(`<link rel="canonical" href="${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`));
    assert.match(html, /<body class="paid-landing-page [^"]+">/);
    assert.match(html, /<img class="lp-headshot"[^>]*david-huff-blue-polo-480\.jpg/);
    assert.ok(html.includes(BRAND_LINE));
    assert.match(html, new RegExp(`href="${PHONE_HREF.replace('+', '\\+')}"[^>]*>Call \\(863\\) 640-3102<`));
    assert.match(html, /Florida license W371813/);
    assert.match(html, /NPN 18213932/);
    assert.doesNotMatch(html, /No fluff\. Just Huff\./i);
    assert.doesNotMatch(html, /healthsherpa\.com|Self-Service ACA Quote/i);
    assert.doesNotMatch(html, /\/js\/site-template\.js/, `${label} does not load global site chrome`);

    const header = headerFrom(html);
    assert.doesNotMatch(header, /<nav\b|menu-button|dropdown-menu|nav-links/i);
    assert.doesNotMatch(header, /href="\/(?:"|aca-|medicare|plans|blog|about|contact)/i);

    const footer = footerFrom(html);
    assert.doesNotMatch(footer, /footer-grid|Quick Links|healthsherpa\.com|Self-Service ACA Quote/i);

    const form = formFrom(html, formName);
    assert.match(form, /method="POST"/);
    assert.match(form, /action="\/thanks\.html"/);
    assert.match(form, /data-netlify="true"/);
    assert.match(form, /data-funnel-track/);
    for (const field of ['full_name', 'phone', 'zip_code', 'coverage_status', 'consent']) {
      assert.match(form, new RegExp(`name="${field}"[^>]*required`), `${label} requires ${field}`);
    }
    assert.doesNotMatch(form, /name="(?:email|best_time_to_reach|age_timeline|household_size)"/);
    assert.match(form, /Reply STOP to cancel or HELP for help/);
  });
}

test('ACA paid page uses the approved conversion copy and audience', () => {
  assert.match(ACA, /<h1[^>]*>Job change or 1099 income\? Compare Marketplace coverage before you buy COBRA\.<\/h1>/);
  assert.match(ACA, /David Huff, licensed independent broker\. I compare 2026 Marketplace plans for Lakeland and Polk County and I answer my own phone\./);
  assert.match(ACA, /<h2>Request a plan comparison\.<\/h2>/);
  assert.match(ACA, /<button[^>]*>Request a callback<\/button>/);
  assert.match(ACA, /Recent job loss/);
  assert.match(ACA, /1099 or self-employed/);
  assert.match(ACA, /Families shopping the Marketplace/);
  assert.doesNotMatch(ACA, /Turning 65/i);
});

test('Medicare paid page keeps compensation and required disclosures below the service content', () => {
  assert.match(MEDICARE, /<h1[^>]*>Review your Medicare plan before doctors, drugs, or costs change\.<\/h1>/);
  assert.match(MEDICARE, /David Huff, licensed independent broker in Lakeland and Polk County\. I answer my own phone\. This is not a call center\./);
  assert.doesNotMatch(MEDICARE.match(/<section class="lp-hero"[\s\S]*?<\/section>/i)?.[0] || '', /Broker Compensation/i);

  const disclosuresAt = MEDICARE.indexOf('<section class="lp-disclosures"');
  const contentAt = MEDICARE.indexOf('<section class="lp-content"');
  const mainEndsAt = MEDICARE.indexOf('</main>');
  assert.ok(disclosuresAt > contentAt, 'disclosures follow the service content');
  assert.ok(mainEndsAt > disclosuresAt, 'disclosures remain inside main');
  assert.match(MEDICARE.slice(disclosuresAt, mainEndsAt), /not connected with or endorsed by the U\.S\. government or the federal Medicare program/);
  assert.match(MEDICARE.slice(disclosuresAt, mainEndsAt), /Insurance carriers generally compensate appointed brokers/);
  assert.doesNotMatch(MEDICARE, /grocery card|extra benefits|\$0 premium/i);
});
