import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createRequire } from 'node:module';

const ENV_KEYS = ['CONTEXT', 'LHI_SITE_ENV', 'META_PIXEL_ID', 'META_CAPI_ACCESS_TOKEN'];
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
process.env.CONTEXT = 'production';
process.env.LHI_SITE_ENV = 'production';
process.env.META_PIXEL_ID = '1480756087079484';
process.env.META_CAPI_ACCESS_TOKEN = 'test-token';

const require = createRequire(import.meta.url);
const { handler, _test } = require('../netlify/functions/meta-event.js');

after(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] == null) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

async function invoke(body, { headers = {}, method = 'POST' } = {}) {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return { ok: true, status: 200 };
  };
  try {
    const response = await handler({
      httpMethod: method,
      headers: {
        origin: 'https://lakelandhealthinsurance.com',
        'user-agent': 'MetaEventTest/1.0',
        'x-forwarded-for': '203.0.113.10',
        cookie: '',
        ...headers
      },
      body: JSON.stringify(body)
    });
    return { response, calls };
  } finally {
    global.fetch = originalFetch;
  }
}

test('meta-event allowlists phone_click and message_start with empty custom_data', async () => {
  for (const name of ['phone_click', 'message_start']) {
    const prefix = name === 'phone_click' ? 'lhi_ph_' : 'lhi_ms_';
    const { response, calls } = await invoke({
      name,
      event_id: `${prefix}abcdef0123456789`,
      path: '/get-help/'
    });
    assert.equal(response.statusCode, 200, name);
    assert.equal(JSON.parse(response.body).ok, true, name);
    assert.equal(calls.length, 1, name);
    const meta = JSON.parse(calls[0].init.body);
    assert.equal(meta.data.length, 1, name);
    assert.equal(meta.data[0].event_name, name);
    assert.equal(meta.data[0].event_source_url, 'https://lakelandhealthinsurance.com/get-help/');
    assert.equal('custom_data' in meta.data[0], false);
    assert.equal(meta.data[0].user_data.client_ip_address, '203.0.113.10');
    assert.equal(meta.data[0].user_data.client_user_agent, 'MetaEventTest/1.0');
  }
});

test('meta-event rejects ineligible paths and opt-out signals', async () => {
  const rejectedPath = await invoke({
    name: 'phone_click',
    event_id: 'lhi_ph_abcdef0123456789',
    path: '/about/'
  });
  assert.equal(rejectedPath.response.statusCode, 400);

  const denied = await invoke({
    name: 'phone_click',
    event_id: 'lhi_ph_abcdef0123456789',
    path: '/get-help/'
  }, { headers: { cookie: 'lhi_meta_audience_consent=denied' } });
  assert.equal(JSON.parse(denied.response.body).skipped, true);
});

test('meta-event helper validation covers event ids and paths', () => {
  assert.equal(_test.approvedEventId('phone_click', 'lhi_ph_abcdef0123456789'), 'lhi_ph_abcdef0123456789');
  assert.equal(_test.approvedEventId('message_start', 'bad'), null);
  assert.equal(_test.normalizePath('/get-help'), '/get-help/');
  assert.equal(_test.ELIGIBLE_PATHS.has('/get-help/'), true);
  assert.equal(_test.ELIGIBLE_PATHS.has('/aca-subsidy-estimator/'), true);
  assert.equal(_test.ELIGIBLE_PATHS.has('/self-employed-health-insurance/'), true);
});

test('meta-event accepts phone_click on newly eligible ACA routes without custom_data', async () => {
  for (const path of [
    '/aca-subsidy-estimator/',
    '/self-employed-health-insurance/',
    '/aca-health-insurance-agent-polk-county-fl/'
  ]) {
    const { response, calls } = await invoke({
      name: 'phone_click',
      event_id: 'lhi_ph_abcdef0123456789',
      path
    });
    assert.equal(response.statusCode, 200, path);
    const meta = JSON.parse(calls[0].init.body);
    assert.equal(meta.data[0].event_source_url, `https://lakelandhealthinsurance.com${path}`, path);
    assert.equal('custom_data' in meta.data[0], false, path);
    assert.doesNotMatch(JSON.stringify(meta), /55000|33805|"income"|"household"|"subsidy_amount"/i);
  }
});
