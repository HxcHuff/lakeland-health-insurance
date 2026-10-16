import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = resolve(new URL('..', import.meta.url).pathname);
const lead = require('../netlify/functions/lead.js');
const { deliverSiteLeadToHopper } = require('../netlify/functions/lib/site-lead-hopper.js');

const {
  authorizeSiteLeadV2Consent,
  applyNonGetHelpConsentRecord,
  isExistingClientServiceIntent,
  SITE_LEAD_V2_CONSENT_TEXT_VERSION
} = lead._test;

test('site lead v2 records separate channel consents when phone and email present', () => {
  const payload = {
    consent_text_version: SITE_LEAD_V2_CONSENT_TEXT_VERSION,
    consent_request: 'yes',
    consent_call: 'yes',
    consent_sms: 'yes',
    consent_email: 'yes',
    phone: '8635550100',
    email: 'pat@example.com',
    source_page: '/'
  };
  const check = authorizeSiteLeadV2Consent(payload, 'site-aca-lead');
  assert.equal(check.ok, true);
  applyNonGetHelpConsentRecord(payload, 'site-aca-lead', '/', '2026-10-16T12:00:00.000Z');
  assert.equal(payload.consent_call_state, 'granted');
  assert.equal(payload.consent_sms_state, 'granted');
  assert.equal(payload.consent_email_state, 'granted');
  assert.equal(payload.consent_request_state, 'granted');
});

test('site lead v2 requires at least one contact channel', () => {
  const payload = {
    consent_text_version: SITE_LEAD_V2_CONSENT_TEXT_VERSION,
    consent_request: 'yes',
    phone: '8635550100',
    source_page: '/'
  };
  const check = authorizeSiteLeadV2Consent(payload, 'site-medicare-lead');
  assert.equal(check.ok, false);
  assert.match(check.error, /at least one contact channel/i);
});

test('existing client intent is flagged for conversion suppression', () => {
  assert.equal(isExistingClientServiceIntent({ normalized_intent: 'current-client-review' }), true);
  assert.equal(isExistingClientServiceIntent({ normalized_intent: 'medicare' }), false);
});

test('hopper payload includes email and consent flags in notes', async () => {
  process.env.HOPPER_INTAKE_URL = 'https://huff-health-app.vercel.app/api/leads/quick-add';
  process.env.HOPPER_INTAKE_KEY = 'test-hopper-key';
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response('{}', { status: 200 });
  };
  const result = await deliverSiteLeadToHopper({
    form_name: 'site-aca-lead',
    name: 'Pat Example',
    phone: '8635550100',
    email: 'pat@example.com',
    zip: '33801',
    line_of_business: 'Supplemental',
    coverage_status: 'supplemental_accident',
    consent_call: 'yes',
    consent_sms: 'yes',
    page_url: 'https://lakelandhealthinsurance.com/supplemental-insurance/'
  }, { fetchImpl });
  assert.equal(result.ok, true);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.email, 'pat@example.com');
  assert.match(body.notes, /consent_call=yes/);
  assert.match(body.notes, /line_of_business=Supplemental/);
});

test('homepage ships lf2 v2 form markup', () => {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  assert.match(html, /class="lf2/);
  assert.match(html, /site-lead-v2-2026-11-v1/);
  assert.match(html, /lead-form-v2\.js\?v=20261016-lead-form-v2/);
  assert.match(html, /name="normalized_intent"/);
});

test('LP medicare page keeps lp-medicare-lead without lf2', () => {
  const html = readFileSync(resolve(ROOT, 'lp/medicare/index.html'), 'utf8');
  assert.match(html, /lp-medicare-lead/);
  assert.doesNotMatch(html, /data-lf2-mode="site"/);
});
