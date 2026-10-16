import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PRIMARY_BROKER = '/medicare-broker-lakeland-fl/';
const TPMO =
  'We do not offer every plan available in your area. Currently we represent 8 organizations which offer 65 products in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local State Health Insurance Program (SHIP) to get information on all of your options.';

function source(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function sectionEndFrom(html, startIndex) {
  const tokenRe = /<section\b|<\/section>/gi;
  tokenRe.lastIndex = startIndex;
  let depth = 0;
  let match;
  while ((match = tokenRe.exec(html))) {
    if (/^<section\b/i.test(match[0])) depth += 1;
    else if (--depth === 0) return match.index + match[0].length;
  }
  return null;
}

function heroMarkup(html) {
  const start = html.indexOf('<section class="answer-hero');
  assert.ok(start >= 0, 'page includes an answer-hero section');
  const end = sectionEndFrom(html, start);
  assert.ok(end, 'answer-hero section closes');
  return html.slice(start, end);
}

function homepageLeadShellMarkup(html) {
  const start = html.indexOf('<div class="lhi-hero-shell">');
  assert.ok(start >= 0, 'page includes a homepage-style lhi-hero-shell');
  let depth = 0;
  for (let i = start; i < html.length; i += 1) {
    if (html.startsWith('<div', i)) depth += 1;
    if (html.startsWith('</div>', i)) {
      depth -= 1;
      if (depth === 0) return html.slice(start, i + '</div>'.length);
    }
  }
  assert.fail('lhi-hero-shell never closes');
}

function firstCtaRow(html) {
  const match = html.match(/<div class="cta-row[^"]*"[\s\S]*?<\/div>/);
  assert.ok(match, 'page includes a hero CTA row');
  return match[0];
}

test('Medicare hub leads with Call David, then Get Help and the primary broker URL', () => {
  const html = source('medicare/index.html');
  const shell = homepageLeadShellMarkup(html);
  const hero = heroMarkup(shell);
  const h1At = hero.search(/<h1 id="medicare-title"/);
  const ledeAt = hero.search(/class="lead lhi-hero-lede"/);
  const formAt = hero.search(/<form class="lhi-lead-hero__form"/);
  const directAt = shell.search(/class="lead medicare-direct-answer"/);
  const callAt = shell.search(/href="tel:\+18636403102"[^>]*>Call David</);
  const helpAt = shell.search(/href="\/get-help\/\?intent=medicare&amp;source_page_key=medicare&amp;source_cta_key=start_review_hero"/);
  const brokerAt = shell.search(/href="\/medicare-broker-lakeland-fl\/"/);

  assert.ok(formAt > 0, 'hub keeps the site Medicare lead form');
  assert.ok(h1At >= 0 && ledeAt > h1At && formAt > ledeAt, 'mobile-first hero order: H1, short lede, then form');
  assert.ok(directAt > formAt, 'direct answer follows the lead form in DOM');
  assert.ok(callAt > formAt, 'Call David appears after the lead form in the hero stack');
  assert.ok(helpAt > formAt, 'Get Help with medicare intent params appears after the form');
  assert.ok(brokerAt > formAt, 'primary broker URL appears after the form');
  assert.ok(callAt < helpAt, 'Call David is earlier than Get Help in the hero');

  const row = firstCtaRow(shell);
  assert.match(row, /class="btn primary" href="tel:\+18636403102">Call David</);
  assert.match(row, /Get Help</);
  assert.match(row, /Lakeland Medicare broker</);
  assert.match(html, new RegExp(TPMO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  assert.match(html, /<title>Medicare Help in Lakeland, FL \| Doctors, Rx &amp; 2027 AEP<\/title>/);
  assert.match(html, /licensed Florida health agent \(FL #W371813 \/ NPN 18213932\)/);
  assert.doesNotMatch(html, /<title>[^<]*Medicare Broker[^<]*<\/title>/i);
  assert.doesNotMatch(html, /Florida Blue|HealthMarkets|broker license/i);
  assert.doesNotMatch(html, /href="\/best-medicare-broker-lakeland-fl\//);
  assert.doesNotMatch(html, /href="\/local-medicare-broker-lakeland-fl\//);
  assert.equal(existsSync(join(ROOT, 'best-medicare-broker-lakeland-fl/index.html')), false);
});

test('ACA Lakeland lander leads with Call David and Get Help intent params', () => {
  const html = source('aca-health-insurance-lakeland-fl/index.html');
  const shell = homepageLeadShellMarkup(html);
  const formAt = shell.search(/<form class="sitelink-lead-form"/);
  const h1At = shell.search(/<h1\b/);
  const ledeAt = shell.search(/class="lead lhi-hero-lede"/);

  assert.ok(formAt > 0, 'ACA above-fold shell includes the sitelink lead form');
  assert.ok(h1At > 0 && ledeAt > h1At, 'short mobile lede follows H1');
  assert.ok(formAt > ledeAt, 'sitelink form follows the short lede');
  assert.match(html, /class="answer-snippet"/, 'page keeps the cite-ready snippet');
  assert.match(html, /class="lhi-lead-hero lhi-hero-grid-lead"/);

  const row = firstCtaRow(html);
  assert.match(row, /class="btn primary" href="tel:\+18636403102">Call David</);
  assert.match(row, /href="\/get-help\/\?intent=aca">Get Help</);
  assert.doesNotMatch(row, /href="\/medicare-broker-lakeland-fl\//);

  assert.match(html, /<title>ACA Health Insurance in Lakeland, FL \| Eligibility &amp; Dates<\/title>/);
  assert.match(html, /licensed Florida health agent \(FL #W371813 \/ NPN 18213932\)/);
  assert.match(html, /href="\/get-help\/\?intent=aca"/);
  assert.doesNotMatch(html, /Florida Blue|HealthMarkets|broker license/i);
  assert.doesNotMatch(html, /href="\/best-medicare-broker-lakeland-fl\//);
  assert.equal(existsSync(join(ROOT, 'aca-health-insurance-lakeland-fl/index.html')), true);
  assert.equal(existsSync(join(ROOT, 'best-medicare-broker-lakeland-fl/index.html')), false);
});

test('PR-C does not invent a second commercial Medicare broker doorway', () => {
  assert.equal(existsSync(join(ROOT, 'medicare-broker-lakeland-fl/index.html')), true);
  assert.equal(existsSync(join(ROOT, 'best-medicare-broker-lakeland-fl/index.html')), false);
  assert.match(source('medicare/index.html'), new RegExp(`href="${PRIMARY_BROKER}"`));
  assert.doesNotMatch(source('medicare/index.html'), /href="\/(?:best|local)-medicare-broker-lakeland-fl\//);
  assert.doesNotMatch(source('aca-health-insurance-lakeland-fl/index.html'), /href="\/(?:best|local)-medicare-broker-lakeland-fl\//);
});
