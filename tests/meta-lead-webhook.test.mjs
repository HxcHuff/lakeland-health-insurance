import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, test } from 'node:test';
import handler, { config } from '../netlify/functions/meta-lead-webhook.mjs';

const ENV_KEYS = [
  'META_VERIFY_TOKEN',
  'META_APP_SECRET_4',
  'META_PAGE_ACCESS_TOKEN',
  'LEAD_BRIDGE_URL',
  'LEAD_BRIDGE_KEY',
  'RESEND_API_KEY',
  'NOTIFY_EMAIL',
  'TWILIO_SID',
  'TWILIO_AUTH',
  'TWILIO_FROM',
  'TWILIO_TO'
];
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

after(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] == null) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function setEnv(overrides = {}) {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, overrides);
}

function signBody(body, secret) {
  return `sha256=${crypto.createHmac('sha256', secret).update(body, 'utf-8').digest('hex')}`;
}

function captureConsole() {
  const logs = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (...args) => logs.push(args.map((a) => String(a)).join(' '));
  console.error = (...args) => logs.push(args.map((a) => String(a)).join(' '));
  return {
    logs,
    restore() {
      console.log = origLog;
      console.error = origError;
    }
  };
}

test('meta-lead-webhook exposes expected route config', () => {
  assert.equal(config.path, '/api/meta-lead-webhook');
});

test('GET verification fails closed when META_VERIFY_TOKEN is unset and verifies constant-time', async () => {
  setEnv();
  const unconfigured = await handler(
    new Request('https://lakelandhealthinsurance.com/api/meta-lead-webhook?hub.mode=subscribe&hub.verify_token=secret&hub.challenge=123', {
      method: 'GET'
    })
  );
  assert.equal(unconfigured.status, 503);
  assert.equal(unconfigured.headers.get('cache-control'), 'no-store');

  setEnv({ META_VERIFY_TOKEN: 'verify-tok-123' });
  const logsCapture = captureConsole();
  try {
    const denied = await handler(
      new Request('https://lakelandhealthinsurance.com/api/meta-lead-webhook?hub.mode=subscribe&hub.verify_token=wrong-secret&hub.challenge=123', {
        method: 'GET'
      })
    );
    assert.equal(denied.status, 403);
    assert.equal(logsCapture.logs.join('\n').includes('wrong-secret'), false);

    const ok = await handler(
      new Request('https://lakelandhealthinsurance.com/api/meta-lead-webhook?hub.mode=subscribe&hub.verify_token=verify-tok-123&hub.challenge=chal-999', {
        method: 'GET'
      })
    );
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('cache-control'), 'no-store');
    assert.equal(await ok.text(), 'chal-999');
  } finally {
    logsCapture.restore();
  }
});

test('POST enforces secret configuration, HMAC signature, body cap, and JSON validation', async () => {
  setEnv();
  const payload = JSON.stringify({ entry: [] });
  const missingSecret = await handler(
    new Request('https://lakelandhealthinsurance.com/api/meta-lead-webhook', {
      method: 'POST',
      body: payload
    })
  );
  assert.equal(missingSecret.status, 503);

  setEnv({ META_APP_SECRET_4: 'app-secret-123' });
  const badSig = await handler(
    new Request('https://lakelandhealthinsurance.com/api/meta-lead-webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': 'sha256=0000' },
      body: payload
    })
  );
  assert.equal(badSig.status, 403);

  const huge = 'x'.repeat(130 * 1024);
  const tooLarge = await handler(
    new Request('https://lakelandhealthinsurance.com/api/meta-lead-webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': signBody(huge, 'app-secret-123') },
      body: huge
    })
  );
  assert.equal(tooLarge.status, 413);

  const badJsonBody = '{not-json';
  const badJson = await handler(
    new Request('https://lakelandhealthinsurance.com/api/meta-lead-webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': signBody(badJsonBody, 'app-secret-123') },
      body: badJsonBody
    })
  );
  assert.equal(badJson.status, 400);

  const badShapeBody = JSON.stringify({ hello: 'world' });
  const badShape = await handler(
    new Request('https://lakelandhealthinsurance.com/api/meta-lead-webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': signBody(badShapeBody, 'app-secret-123') },
      body: badShapeBody
    })
  );
  assert.equal(badShape.status, 400);
});

test('POST derives state from ZIP without FL default, sets timeouts, strips PII logs, and skips bad leadgen_id', async () => {
  setEnv({
    META_APP_SECRET_4: 'app-secret-123',
    META_PAGE_ACCESS_TOKEN: 'page-token-xyz',
    LEAD_BRIDGE_URL: 'https://bridge.example.test/hooks',
    LEAD_BRIDGE_KEY: 'bridge-key-123'
  });

  const body = JSON.stringify({
    entry: [{
      id: '9988776655',
      changes: [
        {
          field: 'leadgen',
          value: {
            leadgen_id: '../evil/path',
            form_id: '5544332211',
            page_id: '9988776655'
          }
        },
        {
          field: 'leadgen',
          value: {
            leadgen_id: '123456789012',
            form_id: '5544332211',
            ad_id: '777888999',
            page_id: '9988776655'
          }
        }
      ]
    }]
  });

  const fetchCalls = [];
  const origFetch = globalThis.fetch;
  const logsCapture = captureConsole();
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    fetchCalls.push({ url: target, init });
    if (target.includes('/me/accounts')) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    if (target.includes('/123456789012?')) {
      return new Response(JSON.stringify({
        id: '123456789012',
        campaign_id: 'camp_1',
        campaign_name: 'Georgia ACA',
        field_data: [
          { name: 'full_name', values: ['Jane Prospect'] },
          { name: 'email', values: ['jane.prospect@example.test'] },
          { name: 'phone_number', values: ['4045550101'] },
          { name: 'zip_code', values: ['30301'] }
        ]
      }), { status: 200 });
    }
    if (target.includes('/5544332211?')) {
      return new Response(JSON.stringify({ name: 'ACA Quote Form' }), { status: 200 });
    }
    if (target === 'https://bridge.example.test/hooks/website/lead') {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  };

  try {
    const res = await handler(
      new Request('https://lakelandhealthinsurance.com/api/meta-lead-webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': signBody(body, 'app-secret-123') },
        body
      })
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(fetchCalls.some((c) => c.url.includes('..')), false);
    for (const call of fetchCalls) {
      assert.ok(call.init.signal, `expected AbortSignal on ${call.url}`);
    }
    const bridgeCall = fetchCalls.find((c) => c.url === 'https://bridge.example.test/hooks/website/lead');
    assert.ok(bridgeCall);
    const bridgePayload = JSON.parse(bridgeCall.init.body);
    assert.equal(bridgePayload.state, 'GA');
    assert.equal(bridgePayload.zip, '30301');

    const logText = logsCapture.logs.join('\n');
    assert.equal(logText.includes('Jane Prospect'), false);
    assert.equal(logText.includes('jane.prospect@example.test'), false);
    assert.equal(logText.includes('4045550101'), false);
  } finally {
    globalThis.fetch = origFetch;
    logsCapture.restore();
  }
});

test('POST returns 502 on bridge failure or non-HTTPS bridge config so Meta retries', async () => {
  setEnv({
    META_APP_SECRET_4: 'app-secret-123',
    META_PAGE_ACCESS_TOKEN: 'page-token-xyz',
    LEAD_BRIDGE_URL: 'https://bridge.example.test/hooks',
    LEAD_BRIDGE_KEY: 'bridge-key-123'
  });

  const body = JSON.stringify({
    entry: [{
      id: '9988776655',
      changes: [{
        field: 'leadgen',
        value: { leadgen_id: '123456789012', form_id: '5544332211', page_id: '9988776655' }
      }]
    }]
  });

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/me/accounts')) return new Response(JSON.stringify({ data: [] }), { status: 200 });
    if (target.includes('/123456789012?')) {
      return new Response(JSON.stringify({ id: '123456789012', field_data: [{ name: 'zip', values: ['33805'] }] }), { status: 200 });
    }
    if (target.includes('/5544332211?')) return new Response(JSON.stringify({ name: 'Test Form' }), { status: 200 });
    return new Response('bridge down', { status: 500 });
  };

  try {
    const bridgeDown = await handler(
      new Request('https://lakelandhealthinsurance.com/api/meta-lead-webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': signBody(body, 'app-secret-123') },
        body
      })
    );
    assert.equal(bridgeDown.status, 502);
    assert.equal(bridgeDown.headers.get('cache-control'), 'no-store');

    process.env.LEAD_BRIDGE_URL = 'http://insecure.example.com/hooks';
    const invalidUrl = await handler(
      new Request('https://lakelandhealthinsurance.com/api/meta-lead-webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': signBody(body, 'app-secret-123') },
        body
      })
    );
    assert.equal(invalidUrl.status, 502);
  } finally {
    globalThis.fetch = origFetch;
  }
});
