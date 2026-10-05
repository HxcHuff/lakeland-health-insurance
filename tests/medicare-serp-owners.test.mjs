import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEDICARE = readFileSync(resolve(ROOT, 'medicare/index.html'), 'utf8');
const BROKER = readFileSync(resolve(ROOT, 'medicare-broker-lakeland-fl/index.html'), 'utf8');
const PLANS = readFileSync(resolve(ROOT, 'plans/index.html'), 'utf8');
const LEARNING = readFileSync(resolve(ROOT, 'learning/index.html'), 'utf8');
const HOME = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

test('Medicare hub owns help/decision SERP, not broker phrasing in title', () => {
  assert.match(MEDICARE, /<title>Medicare Help in Lakeland, FL \| Doctors, Rx &amp; 2027 AEP<\/title>/);
  assert.match(
    MEDICARE,
    /content="Local Medicare review for Lakeland and Polk County\. Compare 2027 Advantage, Medigap, and Part D around your doctors and drugs\. A review is not enrollment\."/
  );
  assert.doesNotMatch(MEDICARE, /<title>[^<]*Medicare Broker[^<]*<\/title>/i);
  assert.match(MEDICARE, /href="\/medicare-broker-lakeland-fl\/"/);
});

test('Broker page owns commercial broker SERP while keeping cite-ready direct answer', () => {
  assert.match(BROKER, /<title>Medicare Broker in Lakeland, FL \| Doctors, Rx &amp; AEP Review<\/title>/);
  assert.match(
    BROKER,
    /content="Licensed Florida health agent \(FL #W371813\)\. Compare Advantage, Medigap &amp; Part D around your doctors and prescriptions\. No separate agent fee\."/
  );
  assert.match(BROKER, /<h1>Medicare broker in Lakeland, FL — licensed local agent for doctors, prescriptions, and AEP\.<\/h1>/);
  assert.match(BROKER, /Direct answer:\s*who can help review Medicare Advantage in Lakeland/i);
  assert.match(BROKER, /href="\/get-help\/\?intent=medicare/);
});

test('Plans path chooser uses clickable coverage-path SERP', () => {
  assert.match(PLANS, /<title>Florida Coverage Paths \| ACA, Medicare &amp; Plan Review<\/title>/);
  assert.match(
    PLANS,
    /content="Pick a Florida starting point—ACA Marketplace, Medicare, coverage loss, or extra coverage—then continue to a licensed Lakeland plan review\."/
  );
  assert.match(PLANS, /href="\/medicare\/"/);
  assert.match(PLANS, /href="\/medicare-broker-lakeland-fl\/"/);
});

test('Homepage and Learning reinforce Medicare owner URLs with clear anchors', () => {
  assert.match(HOME, /href="\/medicare-broker-lakeland-fl\/">Medicare broker in Lakeland</);
  assert.match(HOME, /href="\/medicare\/"/);
  assert.match(LEARNING, /href="\/medicare\/">Medicare help in Lakeland and Polk County</);
  assert.match(LEARNING, /href="\/medicare-broker-lakeland-fl\/">Medicare broker in Lakeland, FL</);
});
