import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  createSubmissionCreatedHandler,
  _test
} = require('../netlify/functions/submission-created.js');
const {
  OUTBOX,
  buildWebsiteLeadPayload,
  createBridgeRetryHandler,
  deliverWebsiteLead,
  outboxKey,
  readBridgeConfig,
  resolveBridgeEndpoint
} = require('../netlify/functions/lib/lead-bridge');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const DEPLOYMENT_ID = 'AKfycbSYNTHETIC_HUFFSHERPA_DEPLOYMENT_001';
const ENDPOINT = 'https://script.google.com/macros/s/' + DEPLOYMENT_ID + '/exec';
const REDIRECT = 'https://script.googleusercontent.com/opaque/content-service/result-v2'
  + '?one_time=SYNTHETIC_USER_CONTENT_KEY_001&deployment=SYNTHETIC_LIBRARY_001';
const BRIDGE_URL = 'https://google-ads-lead-relay.vercel.app';
const BRIDGE_ENDPOINT = BRIDGE_URL + '/website/lead';
const BRIDGE_KEY = 'synthetic-lead-bridge-key-001';
const NOW = Date.parse('2026-09-30T16:00:00.000Z');
const SUBMISSION_ID = '0123456789abcdef01234567';

function memoryStore() {
  const entries = new Map();
  const history = [];
  return {
    entries,
    history,
    async delete(key) {
      history.push({ operation: 'delete', key });
      entries.delete(key);
    },
    async getWithMetadata(key) {
      const record = entries.get(key);
      return record ? { data: record.data, metadata: { ...record.metadata } } : null;
    },
    async list({ prefix } = {}) {
      return {
        blobs: Array.from(entries.keys())
          .filter((key) => !prefix || key.startsWith(prefix))
          .sort()
          .map((key) => ({ key }))
      };
    },
    async set(key, data, options = {}) {
      const metadata = { ...(options.metadata || {}) };
      history.push({ operation: 'set', key, data, metadata });
      entries.set(key, { data, metadata });
    }
  };
}

function productionEnv(overrides = {}) {
  return {
    CONTEXT: 'production',
    HUFFSHERPA_LEAD_WEBHOOK_URL_V1: ENDPOINT,
    HUFFSHERPA_LEAD_WEBHOOK_HMAC_SECRET_V1: SECRET,
    LHI_SITE_ENV: 'production',
    LEAD_BRIDGE_URL: BRIDGE_URL,
    LEAD_BRIDGE_KEY: BRIDGE_KEY,
    ...overrides
  };
}

function routedFetch(calls, { bridgeStatus = 200, bridgeOk = true } = {}) {
  return async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/website/lead')) {
      return new Response(JSON.stringify({ ok: bridgeOk }), {
        status: bridgeStatus,
        headers: { 'content-type': 'application/json' }
      });
    }
    if (String(url) === ENDPOINT) {
      return new Response(null, { status: 302, headers: { location: REDIRECT } });
    }
    if (String(url) === REDIRECT) {
      return new Response(JSON.stringify({ ok: true, outcome: 'STAGED', reason: null }), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
}

function submission(overrides = {}) {
  return {
    body: JSON.stringify({
      payload: {
        id: SUBMISSION_ID,
        created_at: '2026-09-30T15:59:00.000Z',
        form_name: 'get-help',
        data: {
          full_name: 'Avery Fixture',
          phone: '(863) 555-0118',
          email: 'AVERY.FIXTURE@EXAMPLE.TEST',
          zip_code: '33801',
          line_of_business: 'ACA',
          normalized_intent: 'aca',
          inquiry_type: 'ACA guidance',
          event_id: '11111111-2222-4333-a444-555555555555',
          source_url: '/get-help/',
          source_page: '/get-help/',
          utm_source: 'google',
          utm_medium: 'cpc',
          utm_campaign: 'get-help',
          utm_term: 'health insurance lakeland',
          utm_content: 'hero',
          first_utm_source: 'google',
          first_utm_campaign: 'first_touch',
          consent_request: 'yes',
          consent_call: 'yes',
          consent_sms: 'no',
          consent_email: 'yes',
          consent: 'must-not-forward',
          notes: 'Sensitive note must not forward',
          prescriptions: 'Sensitive prescription must not forward'
        },
        ...overrides
      }
    })
  };
}

test('bridge helpers resolve the authenticated website lead route from env', () => {
  assert.equal(resolveBridgeEndpoint(BRIDGE_URL), BRIDGE_ENDPOINT);
  assert.equal(resolveBridgeEndpoint(BRIDGE_URL + '/'), BRIDGE_ENDPOINT);
  assert.equal(resolveBridgeEndpoint(BRIDGE_ENDPOINT), BRIDGE_ENDPOINT);
  assert.equal(resolveBridgeEndpoint('http://google-ads-lead-relay.vercel.app'), null);
  assert.equal(resolveBridgeEndpoint('https://google-ads-lead-relay.vercel.app/other'), null);
  assert.deepEqual(readBridgeConfig({
    LEAD_BRIDGE_URL: BRIDGE_URL,
    LEAD_BRIDGE_KEY: BRIDGE_KEY
  }), { endpoint: BRIDGE_ENDPOINT, key: BRIDGE_KEY });
  assert.equal(readBridgeConfig({
    LEAD_BRIDGE_URL: BRIDGE_URL,
    LEAD_BRIDGE_KEY: 'placeholder'
  }), null);
  assert.equal(readBridgeConfig({ LEAD_BRIDGE_URL: BRIDGE_URL }), null);
});

test('website lead payload keeps contact, intent, consent, UTMs, and the submission id', () => {
  const lead = buildWebsiteLeadPayload({
    formName: 'get-help',
    submissionId: SUBMISSION_ID,
    createdAt: '2026-09-30T15:59:00.000Z',
    filtered: {
      full_name: 'Avery Fixture',
      phone: '(863) 555-0118',
      email: 'AVERY.FIXTURE@EXAMPLE.TEST',
      zip_code: '33801',
      normalized_intent: 'aca',
      inquiry_type: 'ACA guidance',
      line_of_business: 'ACA',
      source_page: '/get-help/',
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'get-help',
      utm_content: 'hero',
      consent_request: 'yes',
      consent_call: 'yes',
      consent_sms: 'no',
      consent_email: 'yes'
    },
    data: {
      event_id: '11111111-2222-4333-a444-555555555555',
      source_url: '/get-help/',
      notes: 'Sensitive note must not forward',
      consent: 'must-not-forward'
    }
  });

  assert.equal(lead.source, 'website_form');
  assert.equal(lead.submission_id, SUBMISSION_ID);
  assert.equal(lead.event_id, '11111111-2222-4333-a444-555555555555');
  assert.equal(lead.name, 'Avery Fixture');
  assert.equal(lead.first, 'Avery');
  assert.equal(lead.last, 'Fixture');
  assert.equal(lead.email, 'avery.fixture@example.test');
  assert.equal(lead.phone, '8635550118');
  assert.equal(lead.zip, '33801');
  assert.equal(lead.intent, 'aca');
  assert.equal(lead.insurance_type, 'ACA');
  assert.equal(lead.form_name, 'get-help');
  assert.equal(lead.page_url, 'https://lakelandhealthinsurance.com/get-help/');
  assert.equal(lead.utm_source, 'google');
  assert.equal(lead.consent.request, true);
  assert.equal(typeof lead.consent.sms, 'boolean');
  assert.equal(lead.consent.sms, false);
  assert.equal(JSON.parse(JSON.stringify(lead.consent)).sms, false);
  assert.equal(lead.consent.granted, true);
  assert.equal(JSON.stringify(lead).includes('Sensitive note'), false);
  assert.equal(JSON.stringify(lead).includes('must-not-forward'), false);
  assert.equal(Object.hasOwn(lead, 'state'), false);
});

test('city and landing-page forms map name, phone, insurance type, and page URL', () => {
  const city = buildWebsiteLeadPayload({
    formName: 'tampa-health-insurance',
    submissionId: SUBMISSION_ID,
    filtered: {
      full_name: 'Casey Tampa',
      phone_number: '8635550199',
      zip_code: '33602',
      coverage_type: 'ACA',
      source_page: '/tampa-health-insurance/'
    }
  });
  assert.equal(city.first, 'Casey');
  assert.equal(city.last, 'Tampa');
  assert.equal(city.phone, '8635550199');
  assert.equal(city.insurance_type, 'ACA');
  assert.equal(city.page_url, 'https://lakelandhealthinsurance.com/tampa-health-insurance/');

  const lp = buildWebsiteLeadPayload({
    formName: 'lp-medicare-lead',
    submissionId: SUBMISSION_ID,
    filtered: {
      full_name: 'Morgan Medicare',
      phone: '8635550177',
      email: 'morgan@example.test',
      consent: 'yes',
      source_page: '/lp/medicare/'
    }
  });
  assert.equal(lp.form_name, 'lp-medicare-lead');
  assert.equal(lp.consent.granted, true);
  assert.equal(lp.consent.request, true);
  assert.equal(typeof lp.consent.sms, 'boolean');
  assert.equal(lp.consent.sms, false);
});

test('consent.sms is always a real boolean for checked and unchecked SMS', () => {
  const grantedSms = buildWebsiteLeadPayload({
    formName: 'get-help',
    submissionId: SUBMISSION_ID,
    filtered: {
      full_name: 'SMS Granted',
      phone: '8635550118',
      consent_request: 'yes',
      consent_sms: 'yes'
    }
  });
  const withheldSms = buildWebsiteLeadPayload({
    formName: 'get-help',
    submissionId: SUBMISSION_ID,
    filtered: {
      full_name: 'SMS Withheld',
      email: 'sms.withheld@example.test',
      consent_request: 'yes',
      consent_email: 'yes'
    }
  });
  assert.equal(grantedSms.consent.sms, true);
  assert.equal(withheldSms.consent.sms, false);
  assert.equal(typeof grantedSms.consent.sms, 'boolean');
  assert.equal(typeof withheldSms.consent.sms, 'boolean');
  assert.equal(JSON.parse(JSON.stringify(grantedSms)).consent.sms, true);
  assert.equal(JSON.parse(JSON.stringify(withheldSms)).consent.sms, false);
});

test('missing bridge env skips without a network call or outbox write', async () => {
  const calls = [];
  const store = memoryStore();
  const result = await deliverWebsiteLead({
    lead: buildWebsiteLeadPayload({
      formName: 'get-help',
      submissionId: SUBMISSION_ID,
      filtered: { full_name: 'Avery Fixture', phone: '8635550118' }
    }),
    environment: { LHI_SITE_ENV: 'production', CONTEXT: 'production' },
    fetchImpl: async (...args) => {
      calls.push(args);
      throw new Error('must not fetch');
    },
    storeFactory: async () => store
  });
  assert.deepEqual(result, { skipped: true, reason: 'missing_configuration' });
  assert.equal(calls.length, 0);
  assert.equal(store.entries.size, 0);
});

test('preview context never posts to the bridge', async () => {
  const calls = [];
  const result = await deliverWebsiteLead({
    lead: buildWebsiteLeadPayload({
      formName: 'get-help',
      submissionId: SUBMISSION_ID,
      filtered: { full_name: 'Avery Fixture', email: 'avery@example.test' }
    }),
    environment: productionEnv({ CONTEXT: 'deploy-preview', LHI_SITE_ENV: 'preview' }),
    fetchImpl: async (...args) => {
      calls.push(args);
      throw new Error('must not fetch');
    }
  });
  assert.deepEqual(result, { skipped: true, reason: 'non_production' });
  assert.equal(calls.length, 0);
});

test('successful bridge POST uses x-bridge-key and does not write the outbox', async () => {
  const calls = [];
  const store = memoryStore();
  const lead = buildWebsiteLeadPayload({
    formName: 'get-help',
    submissionId: SUBMISSION_ID,
    filtered: { full_name: 'Avery Fixture', phone: '8635550118', email: 'avery@example.test' }
  });
  const result = await deliverWebsiteLead({
    lead,
    environment: productionEnv(),
    fetchImpl: routedFetch(calls),
    storeFactory: async () => {
      throw new Error('store must not open on success');
    }
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, BRIDGE_ENDPOINT);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['x-bridge-key'], BRIDGE_KEY);
  assert.equal(calls[0].options.headers['content-type'], 'application/json');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.submission_id, SUBMISSION_ID);
  assert.equal(body.form_name, 'get-help');
  assert.equal(store.entries.size, 0);
});

test('failed bridge POST is queued for retry instead of being dropped', async () => {
  const calls = [];
  const store = memoryStore();
  const lead = buildWebsiteLeadPayload({
    formName: 'get-help',
    submissionId: SUBMISSION_ID,
    filtered: { full_name: 'Avery Fixture', phone: '8635550118' }
  });
  const result = await deliverWebsiteLead({
    lead,
    environment: productionEnv(),
    fetchImpl: routedFetch(calls, { bridgeStatus: 503, bridgeOk: false }),
    storeFactory: async () => store,
    now: () => NOW
  });
  assert.equal(result.ok, false);
  assert.equal(result.queued, true);
  assert.equal(store.entries.size, 1);
  const record = store.entries.get(outboxKey(SUBMISSION_ID));
  assert.equal(record.metadata.state, 'PENDING');
  assert.equal(JSON.parse(record.data).phone, '8635550118');
});

test('scheduled retry delivers a queued lead and deletes the outbox record', async () => {
  const store = memoryStore();
  const lead = buildWebsiteLeadPayload({
    formName: 'lp-aca-lead',
    submissionId: SUBMISSION_ID,
    filtered: {
      full_name: 'Riley ACA',
      phone: '8635550100',
      email: 'riley@example.test',
      consent: 'yes',
      source_page: '/lp/aca/'
    }
  });
  await deliverWebsiteLead({
    lead,
    environment: productionEnv(),
    fetchImpl: async () => new Response(null, { status: 502 }),
    storeFactory: async () => store,
    now: () => NOW
  });
  assert.equal(store.entries.size, 1);

  const calls = [];
  const retry = createBridgeRetryHandler({
    environment: productionEnv(),
    fetchImpl: routedFetch(calls),
    storeFactory: async () => store,
    now: () => NOW + OUTBOX.retryBaseMilliseconds + 1
  });
  const outcome = await retry({});
  assert.equal(outcome.statusCode, 200);
  assert.deepEqual(JSON.parse(outcome.body), {
    ok: true,
    outcome: 'RECONCILED',
    processed: 1
  });
  assert.equal(calls[0].url, BRIDGE_ENDPOINT);
  assert.equal(store.entries.size, 0);
});

test('submission-created posts get-help to the bridge without changing HuffSherpa or notifying the lead', async () => {
  const calls = [];
  const store = memoryStore();
  const logs = [];
  const handler = createSubmissionCreatedHandler({
    environment: productionEnv(),
    fetchImpl: routedFetch(calls),
    logger: (entry) => logs.push(entry),
    now: () => NOW,
    randomBytes: () => Buffer.alloc(32, 7),
    storeFactory: async () => {
      throw new Error('HuffSherpa hot path must not open Blobs');
    },
    bridgeStoreFactory: async () => store,
    alertImpl: async () => {
      throw new Error('must not email');
    }
  });
  const result = await handler(submission());
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), { ok: true, outcome: 'STAGED' });

  const bridgeCall = calls.find((call) => call.url === BRIDGE_ENDPOINT);
  const huffsherpaCall = calls.find((call) => call.url === ENDPOINT);
  assert.ok(bridgeCall);
  assert.ok(huffsherpaCall);
  assert.equal(bridgeCall.options.headers['x-bridge-key'], BRIDGE_KEY);
  const lead = JSON.parse(bridgeCall.options.body);
  assert.equal(lead.submission_id, SUBMISSION_ID);
  assert.equal(lead.form_name, 'get-help');
  assert.equal(lead.intent, 'aca');
  assert.equal(lead.page_url, 'https://lakelandhealthinsurance.com/get-help/');
  assert.equal(JSON.stringify(lead).includes('Sensitive note'), false);
  assert.equal(JSON.stringify(lead).includes('must-not-forward'), false);

  const envelope = JSON.parse(huffsherpaCall.options.body);
  assert.equal(envelope.payload.form_name, 'get-help');
  assert.equal(envelope.payload.data.phone, '8635550118');
  assert.equal(JSON.stringify(envelope).includes('must-not-forward'), false);
  assert.equal(store.entries.size, 0);
  assert.equal(logs.some((entry) => entry.event === 'website_lead_bridge'), true);
  assert.equal(logs.at(-1).reason, 'direct_preferred');
  assert.equal(JSON.stringify(logs).includes('Avery'), false);
  assert.equal(JSON.stringify(logs).includes(BRIDGE_KEY), false);
});

test('other allowlisted lead forms also build a website lead for the bridge', () => {
  const forms = [
    ['aca-lakeland-lead', { full_name: 'Local Lead', phone_number: '8635550118' }],
    ['lp-aca-lead', { full_name: 'LP ACA', phone: '8635550118', email: 'lp@example.test' }],
    ['lp-gap-lead', { full_name: 'LP Gap', phone: '8635550118' }],
    ['winter-haven-health-insurance', { full_name: 'WH Lead', phone_number: '8635550118' }],
    ['subsidy-estimator-lead', { first_name: 'Estimator', phone: '8635550118' }]
  ];
  for (const [formName, data] of forms) {
    const normalized = _test.parseNetlifyEvent({
      body: JSON.stringify({
        payload: {
          id: SUBMISSION_ID,
          created_at: '2026-09-30T15:59:00.000Z',
          form_name: formName,
          data
        }
      })
    });
    assert.equal(normalized.formName, formName);
    assert.equal(normalized.websiteLead.form_name, formName);
    assert.ok(normalized.websiteLead.phone || normalized.websiteLead.email);
    assert.ok(normalized.websiteLead.name || normalized.websiteLead.first);
  }
});

test('bridge failures do not fail HuffSherpa or email the lead', async () => {
  const calls = [];
  const store = memoryStore();
  const handler = createSubmissionCreatedHandler({
    environment: productionEnv(),
    fetchImpl: routedFetch(calls, { bridgeStatus: 500, bridgeOk: false }),
    logger: () => {},
    now: () => NOW,
    randomBytes: () => Buffer.alloc(32, 7),
    storeFactory: async () => {
      throw new Error('HuffSherpa hot path must not open Blobs');
    },
    bridgeStoreFactory: async () => store,
    alertImpl: async () => {
      throw new Error('must not email');
    }
  });
  const result = await handler(submission());
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), { ok: true, outcome: 'STAGED' });
  assert.equal(calls.some((call) => call.url === ENDPOINT), true);
  assert.equal(store.entries.size, 1);
});

test('Hopper ingest is gone and no function texts or emails a lead from the bridge', () => {
  const functionsRoot = path.join(ROOT, 'netlify/functions');
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (/\.(js|mjs|cjs)$/.test(entry.name)) files.push(absolute);
    }
  }
  walk(functionsRoot);

  assert.equal(fs.existsSync(path.join(functionsRoot, 'lib/hopper-ingest.js')), false);
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file);
    if (rel === 'netlify/functions/meta-lead-webhook.mjs') continue;
    if (rel === 'netlify/functions/google-lead-webhook.mjs') continue;
    if (rel === 'netlify/functions/lib/google-ads-crm-relay.mjs') continue;
    assert.equal(source.includes('HOPPER_LEAD_INGEST_SECRET'), false, rel);
    assert.equal(source.includes('HOPPER_INGEST_URL'), false, rel);
    assert.equal(source.includes('huff-health-app.netlify.app'), false, rel);
    assert.equal(source.includes('forwardGetHelpToHopper'), false, rel);
  }

  const bridge = fs.readFileSync(path.join(functionsRoot, 'lib/lead-bridge.js'), 'utf8');
  assert.equal(bridge.includes('twilio'), false);
  assert.equal(bridge.includes('TWILIO'), false);
  assert.equal(bridge.includes('RESEND'), false);
  assert.equal(bridge.includes('NOTIFY_EMAIL'), false);
  assert.equal(bridge.includes('LEAD_BRIDGE_KEY'), true);
  assert.equal(/x-bridge-key/.test(bridge), true);
  assert.equal(bridge.includes('google-ads-lead-relay.vercel.app'), false);
});
