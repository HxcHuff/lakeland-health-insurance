import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const resend = require('../netlify/functions/lib/newsletter-resend.js');
const hopper = require('../netlify/functions/lib/newsletter-hopper.js');
const confirm = require('../netlify/functions/newsletter-confirm.js');

test('normalizeEmail rejects invalid addresses', () => {
  assert.equal(resend.normalizeEmail(''), '');
  assert.equal(resend.normalizeEmail('not-an-email'), '');
  assert.equal(resend.normalizeEmail(' Reader@Example.COM '), 'reader@example.com');
});

test('confirm token verifies, carries form name, and expires', () => {
  const secret = 'test-secret-for-newsletter';
  const email = 'reader@example.test';
  const token = resend.mintConfirmToken(email, secret, Date.now(), 'newsletter-signup');
  const ok = resend.verifyConfirmToken(token, secret, Date.now());
  assert.equal(ok.ok, true);
  assert.equal(ok.email, email);
  assert.equal(ok.sourceForm, 'newsletter-signup');

  const expired = resend.verifyConfirmToken(token, secret, Date.now() + 8 * 24 * 60 * 60 * 1000);
  assert.equal(expired.ok, false);
  assert.equal(expired.reason, 'expired');
});

test('websiteNewsletterSource maps form ids for Resend source property', () => {
  assert.equal(resend.websiteNewsletterSource('homepage-newsletter'), 'website-homepage-newsletter');
  assert.equal(resend.websiteNewsletterSource('newsletter-signup'), 'website-newsletter-signup');
});

test('buildConfirmedContactProperties sets source and optin_at', () => {
  const props = resend.buildConfirmedContactProperties('homepage-newsletter', '2026-10-07T20:00:00.000Z');
  assert.equal(props.source, 'website-homepage-newsletter');
  assert.equal(props.optin_at, '2026-10-07T20:00:00.000Z');
  assert.equal(props.lhi_confirm_status, 'confirmed');
});

test('buildContactProperties stores consent metadata', () => {
  const props = resend.buildContactProperties({
    consentText: 'Example consent',
    consentVersion: 'newsletter-signup-2026-10-07-v1',
    sourceForm: 'newsletter-signup',
    signupPage: '/newsletter/',
    signupAt: '2026-10-07T12:00:00.000Z',
    interest: 'medicare'
  });
  assert.equal(props.lhi_confirm_status, 'pending');
  assert.equal(props.lhi_consent_version, 'newsletter-signup-2026-10-07-v1');
  assert.equal(props.lhi_interest, 'medicare');
});

test('hopper quick-add defaults when env unset', () => {
  assert.equal(hopper.hopperConfigured(), false);
});

test('newsletter confirm redirects to status page', () => {
  assert.equal(confirm._test.redirectPath('confirmed'), '/newsletter/confirmed/?status=confirmed');
});
