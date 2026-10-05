import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PRIMARY_BROKER = '/medicare-broker-lakeland-fl/';
const TPMO =
  'We do not offer every plan available in your area. Currently we represent 8 organizations which offer 65 products in your area. Please contact Medicare.gov or 1-800-MEDICARE to get information on all of your options.';

function source(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function heroMarkup(html) {
  const match = html.match(/<section class="answer-hero[^"]*"[\s\S]*?<\/section>/);
  assert.ok(match, 'page includes an answer-hero section');
  return match[0];
}

function firstCtaRow(html) {
  const match = html.match(/<div class="cta-row[^"]*"[\s\S]*?<\/div>/);
  assert.ok(match, 'page includes a hero CTA row');
  return match[0];
}

test('Medicare hub leads with Call David, then Get Help and the primary broker URL', () => {
  const html = source('medicare/index.html');
  const hero = heroMarkup(html);
  const formAt = hero.search(/<form class="sitelink-lead-form"/);
  const callAt = hero.search(/href="tel:\+18636403102"[^>]*>Call David</);
  const helpAt = hero.search(/href="\/get-help\/\?intent=medicare&amp;source_page_key=medicare&amp;source_cta_key=start_review_hero"/);
  const brokerAt = hero.search(/href="\/medicare-broker-lakeland-fl\/"/);

  assert.ok(formAt > 0, 'hub keeps the sitelink lead form');
  assert.ok(callAt > 0 && callAt < formAt, 'Call David appears before the sitelink form');
  assert.ok(helpAt > 0 && helpAt < formAt, 'Get Help with medicare intent params appears before the form');
  assert.ok(brokerAt > 0 && brokerAt < formAt, 'primary broker URL appears before the form');
  assert.ok(callAt < helpAt, 'Call David is earlier than Get Help in the hero');

  const row = firstCtaRow(hero);
  assert.match(row, /class="btn primary" href="tel:\+18636403102">Call David</);
  assert.match(row, /Get Help</);
  assert.match(row, /Lakeland Medicare broker</);
  assert.match(row, new RegExp(TPMO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

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
  const hero = heroMarkup(html);
  const snippetAt = hero.search(/class="answer-snippet"/);
  const callAt = hero.search(/href="tel:\+18636403102"[^>]*>Call David</);
  const helpAt = hero.search(/href="\/get-help\/\?intent=aca"/);

  assert.ok(snippetAt > 0, 'ACA hero keeps the cite-ready snippet');
  assert.ok(callAt > 0 && callAt < snippetAt, 'Call David appears before the eligibility snippet');
  assert.ok(helpAt > 0 && helpAt < snippetAt, 'Get Help with ACA intent appears before the snippet');
  assert.ok(callAt < helpAt, 'Call David is earlier than Get Help in the hero');

  const row = firstCtaRow(hero);
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
