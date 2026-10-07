import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  evaluateLeadSpam,
  hashIdentifier,
  honeypotFilled,
  validateHumanTiming,
  _test: spamTest
} = require('../netlify/functions/lib/form-spam-guard.js');

test('honeypot detection only checks bot-field', () => {
  assert.equal(honeypotFilled({ 'bot-field': '' }), false);
  assert.equal(honeypotFilled({ 'bot-field': 'filled' }), true);
  assert.equal(honeypotFilled({ website: 'https://spam.example' }), false);
  assert.equal(honeypotFilled({ company: 'Acme' }), false);
});

test('human timing accepts realistic submissions and rejects instant bots', () => {
  const startedAt = Date.now() - 2_100;
  const payload = {
    started_at: String(startedAt),
    human_check: Buffer.from(`${startedAt}:lakeland-human`).toString('base64')
  };
  const accepted = validateHumanTiming(payload, 'lp-aca-lead');
  assert.equal(accepted.ok, true);
  assert.ok(accepted.elapsedMs >= 2_000);

  const fastStart = Date.now() - 50;
  const fastPayload = {
    started_at: String(fastStart),
    human_check: Buffer.from(`${fastStart}:lakeland-human`).toString('base64')
  };
  assert.equal(validateHumanTiming(fastPayload, 'lp-aca-lead').ok, false);
});

test('evaluateLeadSpam hashes identifiers without logging raw email', () => {
  const startedAt = Date.now() - 2_000;
  const payload = {
    'form-name': 'newsletter-signup',
    email: 'reader@example.com',
    started_at: String(startedAt),
    human_check: Buffer.from(`${startedAt}:lakeland-human`).toString('base64')
  };
  const result = evaluateLeadSpam(payload, 'newsletter-signup', {
    'x-nf-client-connection-ip': '203.0.113.10'
  });
  assert.equal(result.spam, false);
  assert.equal(result.emailHash, hashIdentifier('reader@example.com'));
  assert.equal(String(result.emailHash).includes('@'), false);
});

test('rate limiting blocks excessive bursts from one IP hash bucket', () => {
  spamTest.rateLimitBuckets.clear();
  const headers = { 'x-nf-client-connection-ip': '198.51.100.44' };
  const startedAt = Date.now() - 2_000;
  const payload = {
    email: 'burst@example.com',
    started_at: String(startedAt),
    human_check: Buffer.from(`${startedAt}:lakeland-human`).toString('base64')
  };

  let limited = false;
  for (let i = 0; i < 12; i += 1) {
    const evaluation = evaluateLeadSpam(payload, 'homepage-newsletter', headers);
    if (evaluation.spam && evaluation.reason === 'rate_limited') limited = true;
  }
  assert.equal(limited, true);
});
