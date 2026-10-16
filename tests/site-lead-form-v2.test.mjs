import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = resolve(new URL('..', import.meta.url).pathname);
const lead = require('../netlify/functions/lead.js');
const { handler } = lead;
const { buildHopperBody, deliverSiteLeadToHopper } = require('../netlify/functions/lib/site-lead-hopper.js');

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
  assert.match(html, /lead-form-v2\.js\?v=20261017-lead-form-v338/);
  assert.match(html, /name="normalized_intent"/);
});

test('LP medicare page keeps lp-medicare-lead without lf2', () => {
  const html = readFileSync(resolve(ROOT, 'lp/medicare/index.html'), 'utf8');
  assert.match(html, /lp-medicare-lead/);
  assert.doesNotMatch(html, /data-lf2-mode="site"/);
});

function siteV2LeadPayload(overrides = {}) {
  const startedAt = Date.now() - 5000;
  return {
    form_name: 'site-aca-lead',
    consent_text_version: SITE_LEAD_V2_CONSENT_TEXT_VERSION,
    consent_request: 'yes',
    consent_call: 'yes',
    consent_sms: 'yes',
    consent_email: 'yes',
    full_name: 'Pat Example',
    phone: '8635550100',
    email: 'pat@example.com',
    zip_code: '33801',
    normalized_intent: 'under-65',
    line_of_business: 'ACA',
    source_page: '/',
    source_template: 'homepage',
    started_at: String(startedAt),
    human_check: Buffer.from(`${startedAt}:lakeland-human`).toString('base64'),
    ...overrides
  };
}

async function invokeLead(payload) {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('graph.facebook.com')) {
      return { ok: true, status: 200 };
    }
    return { ok: true, status: 200 };
  };
  try {
    const response = await handler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://lakelandhealthinsurance.com',
        referer: 'https://lakelandhealthinsurance.com/'
      },
      body: JSON.stringify(payload)
    });
    return { response, calls, result: JSON.parse(response.body) };
  } finally {
    global.fetch = originalFetch;
  }
}

test('mocked lead handler forwards v2 channel consents, email, and source keys', async () => {
  const { response, calls, result } = await invokeLead(siteV2LeadPayload());
  assert.equal(response.statusCode, 200);
  assert.equal(result.ok, true);
  assert.equal(result.forms, true);
  const formsCall = calls.find((c) => c.url === 'https://lakelandhealthinsurance.com/');
  assert.ok(formsCall);
  const form = new URLSearchParams(formsCall.init.body);
  assert.equal(form.get('consent_call'), 'yes');
  assert.equal(form.get('consent_sms'), 'yes');
  assert.equal(form.get('consent_email'), 'yes');
  assert.equal(form.get('email'), 'pat@example.com');
  assert.equal(form.get('normalized_intent'), 'under-65');
  assert.equal(form.get('line_of_business'), 'ACA');
  assert.equal(form.get('source_page'), '/');
  assert.equal(form.get('source_template'), 'homepage');
  assert.equal(form.get('consent_text_version'), SITE_LEAD_V2_CONSENT_TEXT_VERSION);
});

test('mocked hopper body from v2 relay fields includes email and consents', () => {
  const body = buildHopperBody({
    form_name: 'site-aca-lead',
    name: 'Pat Example',
    phone: '8635550100',
    email: 'pat@example.com',
    zip: '33801',
    line_of_business: 'ACA',
    consent_call: 'yes',
    consent_sms: 'yes',
    consent_email: 'yes'
  });
  assert.equal(body.email, 'pat@example.com');
  assert.match(body.notes, /consent_call=yes/);
  assert.match(body.notes, /consent_sms=yes/);
  assert.match(body.notes, /consent_email=yes/);
});

test('existing client get-help payload skips ad lead conversions in handler response', async () => {
  const startedAt = Date.now() - 5000;
  const { result } = await invokeLead({
    form_name: 'get-help',
    consent_text_version: 'get-help-2026-09-29-v2',
    consent_request: 'yes',
    consent_call: 'yes',
    phone: '8635550100',
    full_name: 'Pat Example',
    zip_code: '33801',
    normalized_intent: 'current-client-review',
    preferred_contact_method: 'phone_call',
    started_at: String(startedAt),
    human_check: Buffer.from(`${startedAt}:lakeland-human`).toString('base64')
  });
  assert.equal(result.ok, true);
  assert.match(result.ads_capi_error || result.capi_error || '', /existing client service requests/i);
});
