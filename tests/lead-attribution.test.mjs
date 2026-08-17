import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createRequire } from 'node:module';

const ENV_KEYS = [
  'CONTEXT',
  'META_PIXEL_ID',
  'META_CAPI_ACCESS_TOKEN',
  'META_CAPI_TEST_EVENT_CODE',
  'MAILCHIMP_API_KEY',
  'MAILCHIMP_AUDIENCE_ID',
  'MAILCHIMP_SERVER_PREFIX',
  'OPENAI_ADS_PIXEL_ID',
  'OPENAI_ADS_CAPI_KEY',
  'LEAD_FORMS_ORIGIN',
  'LEAD_ALLOWED_ORIGINS'
];
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
process.env.CONTEXT = 'production';
process.env.META_PIXEL_ID = 'test-pixel';
process.env.META_CAPI_ACCESS_TOKEN = 'test-token';
process.env.LEAD_FORMS_ORIGIN = 'https://lakelandhealthinsurance.com';
process.env.LEAD_ALLOWED_ORIGINS = 'https://lakelandhealthinsurance.com';
delete process.env.META_CAPI_TEST_EVENT_CODE;
delete process.env.MAILCHIMP_API_KEY;
delete process.env.MAILCHIMP_AUDIENCE_ID;
delete process.env.MAILCHIMP_SERVER_PREFIX;
delete process.env.OPENAI_ADS_PIXEL_ID;
delete process.env.OPENAI_ADS_CAPI_KEY;

const require = createRequire(import.meta.url);
const { handler, _test } = require('../netlify/functions/lead.js');

after(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] == null) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function getHelpPayload(overrides = {}) {
  const startedAt = Date.now() - 2_000;
  return {
    'form-name': 'get-help',
    started_at: String(startedAt),
    human_check: Buffer.from(`${startedAt}:lakeland-human`).toString('base64'),
    full_name: 'Jane Example',
    phone: '863-555-1212',
    email: 'jane@example.com',
    zip_code: '33801',
    normalized_intent: 'medicare',
    inquiry_type: 'Medicare guidance',
    line_of_business: 'Medicare',
    need_timing: 'Within 30 days',
    preferred_contact_method: 'Phone call',
    coverage_status: 'Uninsured',
    consent_request: 'yes',
    consent_call: 'yes',
    consent_sms: 'yes',
    consent_email: 'yes',
    consent_marketing_email: 'yes',
    source_page: '/get-help/?email=jane@example.com',
    source_url: 'https://lakelandhealthinsurance.com/get-help/?email=jane@example.com#contact',
    source_page_key: 'best_medicare_broker_lakeland_fl',
    source_page_role: 'attacker-role',
    source_cta_key: 'request_review_hero',
    content_cluster: 'attacker-cluster',
    current_plan: 'Sensitive current plan',
    providers: 'Sensitive Clinic',
    prescriptions: 'Sensitive prescription',
    coverage_end: '2026-09-30',
    plan_year: '2027',
    notes: 'Sensitive note',
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'medicare-review',
    utm_content: 'hero',
    utm_term: 'must-drop',
    gclid: 'must-drop',
    fbclid: 'must-drop',
    mystery: 'must-drop',
    consent_recorded_at: '1999-01-01T00:00:00.000Z',
    consent_text_version: 'attacker-version',
    consent_call_state: 'not_granted',
    accepted_at: 'attacker-accepted',
    ...overrides
  };
}

async function invoke(payload, { formsStatus = 200, headers = {}, method = 'POST', body } = {}) {
  const calls = [];
  const logs = [];
  const originalFetch = global.fetch;
  const originalConsole = {
    info: console.info,
    warn: console.warn,
    error: console.error
  };
  global.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith('https://graph.facebook.com/')) {
      return { ok: true, status: 200 };
    }
    return { ok: formsStatus >= 200 && formsStatus < 300, status: formsStatus };
  };
  console.info = (...args) => logs.push(['info', ...args]);
  console.warn = (...args) => logs.push(['warn', ...args]);
  console.error = (...args) => logs.push(['error', ...args]);

  try {
    const response = await handler({
      httpMethod: method,
      headers: {
        origin: 'https://lakelandhealthinsurance.com',
        referer: 'https://lakelandhealthinsurance.com/get-help/?private=query',
        ...headers
      },
      body: body === undefined ? JSON.stringify(payload) : body
    });
    return { response, calls, logs };
  } finally {
    global.fetch = originalFetch;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }
}

test('Forms acceptance mints receipt metadata, authorizes consent, and returns canonical Medicare attribution', async () => {
  const { response, calls, logs } = await invoke(getHelpPayload());
  const result = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(result.ok, true);
  assert.equal(result.forms, true);
  assert.match(result.event_id, /^[0-9a-f-]{36}$/i);
  assert.equal(Date.parse(result.server_received_at) <= Date.parse(result.accepted_at), true);
  assert.deepEqual({
    source_page_key: result.source_page_key,
    source_page_role: result.source_page_role,
    source_cta_key: result.source_cta_key,
    content_cluster: result.content_cluster
  }, {
    source_page_key: 'best_medicare_broker_lakeland_fl',
    source_page_role: 'selection',
    source_cta_key: 'request_review_hero',
    content_cluster: 'lakeland_medicare_broker'
  });

  assert.equal(calls[0].url, 'https://lakelandhealthinsurance.com/');
  const form = new URLSearchParams(calls[0].init.body);
  assert.equal(form.get('event_id'), result.event_id);
  assert.equal(form.get('server_received_at'), result.server_received_at);
  assert.equal(form.get('source_url'), '/get-help/');
  assert.equal(form.get('source_page'), '/get-help/');
  assert.equal(form.get('source_page_role'), 'selection');
  assert.equal(form.get('content_cluster'), 'lakeland_medicare_broker');
  assert.equal(form.get('current_plan'), null);
  assert.equal(form.get('providers'), null);
  assert.equal(form.get('prescriptions'), null);
  assert.equal(form.get('coverage_end'), '2026-09-30');
  assert.equal(form.get('plan_year'), '2027');
  assert.equal(form.get('consent_recorded_at'), result.server_received_at);
  assert.equal(form.get('consent_text_version'), 'get-help-2026-07-30-v1');
  assert.equal(form.get('consent_page'), '/get-help/');
  assert.equal(form.get('consent_request_state'), 'granted');
  assert.equal(form.get('consent_call_state'), 'granted');
  assert.equal(form.get('consent_sms_state'), 'granted');
  assert.equal(form.get('consent_email_state'), 'granted');
  assert.equal(form.get('consent_marketing_email_state'), 'granted');
  assert.equal(form.get('consent_withdrawal_state'), 'not_withdrawn_at_submission');
  for (const key of ['mystery', 'utm_term', 'gclid', 'fbclid', 'accepted_at']) {
    assert.equal(form.has(key), false, `${key} is not forwarded`);
  }
  assert.equal(form.toString().includes('attacker-role'), false);
  assert.equal(form.toString().includes('attacker-cluster'), false);

  assert.equal(calls.length, 2, 'Forms precedes the single Meta request');
  const meta = JSON.parse(calls[1].init.body);
  assert.equal(meta.data[0].event_id, result.event_id);
  assert.equal(meta.data[0].event_source_url, 'https://lakelandhealthinsurance.com/get-help/');

  const outcome = JSON.parse(String(logs.find((entry) => entry[0] === 'info')[1]));
  assert.equal(outcome.type, 'forms_forward_outcome_v1');
  assert.equal(outcome.event_id, result.event_id);
  const serializedLogs = JSON.stringify(logs);
  for (const secret of ['Jane Example', 'jane@example.com', 'Sensitive Clinic', 'Sensitive prescription', 'Sensitive note']) {
    assert.equal(serializedLogs.includes(secret), false, `logs exclude ${secret}`);
  }
});

test('Medicare hub attribution is canonicalized as the hub role', async () => {
  const { response } = await invoke(getHelpPayload({
    source_page_key: 'medicare',
    source_page_role: 'attacker-role',
    source_cta_key: 'start_review_hero'
  }));
  const result = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.deepEqual({
    source_page_key: result.source_page_key,
    source_page_role: result.source_page_role,
    source_cta_key: result.source_cta_key,
    content_cluster: result.content_cluster
  }, {
    source_page_key: 'medicare',
    source_page_role: 'hub',
    source_cta_key: 'start_review_hero',
    content_cluster: 'lakeland_medicare_broker'
  });
});

test('Medicare education-page attribution is canonicalized as the education role', async () => {
  const { response } = await invoke(getHelpPayload({
    source_page_key: 'moving_florida_medicare',
    source_page_role: 'attacker-role',
    source_cta_key: 'request_move_review'
  }));
  const result = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.deepEqual({
    source_page_key: result.source_page_key,
    source_page_role: result.source_page_role,
    source_cta_key: result.source_cta_key,
    content_cluster: result.content_cluster
  }, {
    source_page_key: 'moving_florida_medicare',
    source_page_role: 'education',
    source_cta_key: 'request_move_review',
    content_cluster: 'lakeland_medicare_broker'
  });
});

test('Medicare attribution rejects prototype-chain registry keys without throwing', () => {
  for (const hostileKey of ['constructor', 'toString', '__proto__']) {
    const hostilePage = getHelpPayload({
      source_page_key: hostileKey,
      source_cta_key: 'start_review_hero'
    });
    assert.equal(_test.canonicalizeMedicareAttribution(hostilePage), null);
    for (const field of ['source_page_key', 'source_page_role', 'source_cta_key', 'content_cluster']) {
      assert.equal(field in hostilePage, false);
    }

    const hostileCta = getHelpPayload({
      source_page_key: 'medicare',
      source_cta_key: hostileKey
    });
    assert.equal(_test.canonicalizeMedicareAttribution(hostileCta), null);
    for (const field of ['source_page_key', 'source_page_role', 'source_cta_key', 'content_cluster']) {
      assert.equal(field in hostileCta, false);
    }
  }
});

test('Forms failure does not call Meta or return accepted_at/canonical attribution', async () => {
  const { response, calls } = await invoke(getHelpPayload(), { formsStatus: 503 });
  const result = JSON.parse(response.body);

  assert.equal(response.statusCode, 502);
  assert.equal(calls.length, 1);
  assert.match(result.event_id, /^[0-9a-f-]{36}$/i);
  assert.ok(result.server_received_at);
  assert.equal('accepted_at' in result, false);
  assert.equal('source_page_key' in result, false);
  assert.equal('source_page_role' in result, false);
  assert.equal('source_cta_key' in result, false);
  assert.equal('content_cluster' in result, false);
});

test('get-help rejects missing request consent before Forms or integrations', async () => {
  const payload = getHelpPayload();
  delete payload.consent_request;
  const { response, calls } = await invoke(payload);

  assert.equal(response.statusCode, 422);
  assert.equal(JSON.parse(response.body).error, 'request consent is required');
  assert.equal(calls.length, 0);
});

test('form schemas preserve declared live fields and discard arbitrary keys', () => {
  const newsletter = _test.filterPayloadForForm({
    first_name: 'Reader',
    email: 'reader@example.com',
    interest: 'Medicare',
    mystery: 'drop'
  }, 'newsletter-signup').payload;
  assert.equal(newsletter.first_name, 'Reader');
  assert.equal(newsletter.interest, 'Medicare');
  assert.equal('mystery' in newsletter, false);

  const local = _test.filterPayloadForForm({
    full_name: 'Local Lead',
    phone_number: '8635551212',
    zip_code: '33801',
    primary_provider: 'Clinic',
    mystery: 'drop'
  }, 'winter-haven-health-insurance').payload;
  assert.equal(local.primary_provider, 'Clinic');
  assert.equal('mystery' in local, false);

  const lp = _test.filterPayloadForForm({ utm_term: 'legacy-keyword', household_size: '3' }, 'lp-aca-lead').payload;
  assert.equal(lp.utm_term, 'legacy-keyword');
  assert.equal(lp.household_size, '3');
});

test('Medicare general intake strips known plan and health-detail fields without changing other intents', () => {
  const medicare = _test.minimizeGetHelpPayload({
    'form-name': 'get-help',
    normalized_intent: 'medicare',
    current_plan: 'Sensitive plan',
    providers: 'Sensitive provider',
    prescriptions: 'Sensitive prescription',
    primary_concern: 'Enrollment timing'
  });
  assert.equal('current_plan' in medicare, false);
  assert.equal('providers' in medicare, false);
  assert.equal('prescriptions' in medicare, false);
  assert.equal(medicare.primary_concern, 'Enrollment timing');

  const providerCheck = _test.minimizeGetHelpPayload({
    'form-name': 'get-help',
    normalized_intent: 'provider-check',
    providers: 'Provider needed for follow-up'
  });
  assert.equal(providerCheck.providers, 'Provider needed for follow-up');
});

test('CORS, body shape, and body size fail closed', async () => {
  const denied = await invoke(getHelpPayload(), { headers: { origin: 'https://evil.example' } });
  assert.equal(denied.response.statusCode, 403);
  assert.equal(denied.response.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal(denied.calls.length, 0);

  const preflight = await invoke({}, { method: 'OPTIONS' });
  assert.equal(preflight.response.statusCode, 204);
  assert.equal(preflight.response.headers['Access-Control-Allow-Origin'], 'https://lakelandhealthinsurance.com');
  assert.notEqual(preflight.response.headers['Access-Control-Allow-Origin'], '*');

  const arrayBody = await invoke({}, { body: '[]' });
  assert.equal(arrayBody.response.statusCode, 400);
  assert.equal(arrayBody.calls.length, 0);

  const oversized = await invoke({}, { body: JSON.stringify({ value: 'x'.repeat(70 * 1024) }) });
  assert.equal(oversized.response.statusCode, 413);
  assert.equal(oversized.calls.length, 0);
});

test('source URL sanitizer keeps only same-site paths', () => {
  assert.equal(_test.sanitizeSourcePath('/get-help/?email=jane@example.com#x'), '/get-help/');
  assert.equal(_test.sanitizeSourcePath('https://www.lakelandhealthinsurance.com/lp/medicare/?gclid=secret'), '/lp/medicare/');
  assert.equal(_test.sanitizeSourcePath('https://evil.example/get-help/?email=jane@example.com'), '/');
});
