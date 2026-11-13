import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fn = require('../netlify/functions/lead-outcome-webhook.js');

async function withEnv(overrides, callback) {
  const keys = Object.keys(overrides);
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const [k, v] of Object.entries(overrides)) {
      if (v == null) delete process.env[k];
      else process.env[k] = v;
    }
    return await callback();
  } finally {
    for (const k of keys) {
      if (previous[k] == null) delete process.env[k];
      else process.env[k] = previous[k];
    }
  }
}

test('lead-outcome-webhook fails closed when secret missing, wrong, or method invalid', async () => {
  fn._test.clearSeenKeys();
  const getRes = await fn.handler({ httpMethod: 'GET', headers: {}, body: '' });
  assert.equal(getRes.statusCode, 405);
  assert.equal(getRes.headers['Cache-Control'], 'no-store');

  await withEnv({ LEAD_OUTCOME_WEBHOOK_SECRET: null, LHI_LEAD_OUTCOME_WEBHOOK_SECRET: null }, async () => {
    const res = await fn.handler({
      httpMethod: 'POST',
      headers: { 'x-lhi-webhook-secret': 'anything' },
      body: JSON.stringify({ event_name: 'qualify_lead', event_id: 'lead_abc123' })
    });
    assert.equal(res.statusCode, 503);
  });

  await withEnv({ LEAD_OUTCOME_WEBHOOK_SECRET: 'super-secret-token' }, async () => {
    const missingAuth = await fn.handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ event_name: 'qualify_lead', event_id: 'lead_abc123' })
    });
    assert.equal(missingAuth.statusCode, 401);

    const wrongAuth = await fn.handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer wrong-token' },
      body: JSON.stringify({ event_name: 'qualify_lead', event_id: 'lead_abc123' })
    });
    assert.equal(wrongAuth.statusCode, 401);

    const wrongSig = await fn.handler({
      httpMethod: 'POST',
      headers: { 'x-lhi-webhook-signature': 'sha256=' + '0'.repeat(64) },
      body: JSON.stringify({ event_name: 'qualify_lead', event_id: 'lead_abc123' })
    });
    assert.equal(wrongSig.statusCode, 401);
  });
});

test('lead-outcome-webhook rejects PII/PHI fields and unsupported outcomes', async () => {
  await withEnv({ LEAD_OUTCOME_WEBHOOK_SECRET: 'super-secret-token', LHI_SITE_ENV: 'production', CONTEXT: 'production', GA4_MP_API_SECRET: 'mp-secret' }, async () => {
    const piiRes = await fn.handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer super-secret-token' },
      body: JSON.stringify({
        event_name: 'qualify_lead',
        event_id: 'lead_123456',
        email: 'jane@example.com'
      })
    });
    assert.equal(piiRes.statusCode, 400);
    assert.equal(JSON.parse(piiRes.body).error, 'pii_forbidden');

    const badOutcome = await fn.handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer super-secret-token' },
      body: JSON.stringify({
        event_name: 'Lead',
        event_id: 'lead_123456'
      })
    });
    assert.equal(badOutcome.statusCode, 400);
    assert.equal(JSON.parse(badOutcome.body).error, 'unsupported_outcome');

    const noId = await fn.handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer super-secret-token' },
      body: JSON.stringify({ event_name: 'qualify_lead' })
    });
    assert.equal(noId.statusCode, 400);
    assert.equal(JSON.parse(noId.body).error, 'missing_correlation_id');
  });
});

test('lead-outcome-webhook skips non-production contexts cleanly without hitting GA4 MP', async () => {
  fn._test.clearSeenKeys();
  let fetchCalled = 0;
  const origFetch = global.fetch;
  global.fetch = async () => {
    fetchCalled += 1;
    return { ok: true, status: 204 };
  };
  try {
    await withEnv({ LEAD_OUTCOME_WEBHOOK_SECRET: 'super-secret-token', CONTEXT: 'deploy-preview', LHI_SITE_ENV: 'production', GA4_MP_API_SECRET: 'mp-secret' }, async () => {
      const res = await fn.handler({
        httpMethod: 'POST',
        headers: { 'x-lhi-webhook-secret': 'super-secret-token' },
        body: JSON.stringify({ outcome: 'enrolled', lead_id: 'hop_987654' })
      });
      assert.equal(res.statusCode, 202);
      const parsed = JSON.parse(res.body);
      assert.equal(parsed.skipped, true);
      assert.equal(parsed.ga4_event, 'close_convert_lead');
      assert.equal(fetchCalled, 0);
    });
  } finally {
    global.fetch = origFetch;
  }
});

test('lead-outcome-webhook sends HMAC-verified qualify_lead & close_convert_lead to GA4 MP and dedupes replays', async () => {
  fn._test.clearSeenKeys();
  const fetchCalls = [];
  const origFetch = global.fetch;
  global.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return { ok: true, status: 204 };
  };
  try {
    await withEnv({
      LEAD_OUTCOME_WEBHOOK_SECRET: 'super-secret-token',
      LHI_SITE_ENV: 'production',
      CONTEXT: 'production',
      GA4_MP_API_SECRET: 'mp-secret-xyz',
      GA4_MEASUREMENT_ID: 'G-W45RMKHXV0'
    }, async () => {
      const rawBody = JSON.stringify({
        event_name: 'qualify_lead',
        event_id: '11111111-2222-4333-8444-555555555555',
        line_of_business: 'medicare',
        state_code: 'FL',
        lead_source: 'site_lead',
        ab_variant: 'variant_b',
        value: 350
      });
      const sig = 'sha256=' + crypto.createHmac('sha256', 'super-secret-token').update(rawBody, 'utf8').digest('hex');

      const res1 = await fn.handler({
        httpMethod: 'POST',
        headers: { 'x-lhi-webhook-signature': sig },
        body: rawBody
      });
      assert.equal(res1.statusCode, 200);
      assert.equal(JSON.parse(res1.body).ga4_event, 'qualify_lead');
      assert.equal(fetchCalls.length, 1);
      assert.match(fetchCalls[0].url, /^https:\/\/www\.google-analytics\.com\/mp\/collect\?measurement_id=G-W45RMKHXV0&api_secret=mp-secret-xyz$/);
      assert.ok(fetchCalls[0].init.signal, 'expected AbortSignal');

      const mpBody = JSON.parse(fetchCalls[0].init.body);
      assert.match(mpBody.client_id, /^\d+\.\d+$/);
      assert.equal(mpBody.events[0].name, 'qualify_lead');
      assert.equal(mpBody.events[0].params.lead_stage, 'qualified');
      assert.equal(mpBody.events[0].params.line_of_business, 'medicare');
      assert.equal(mpBody.events[0].params.state_code, 'FL');
      assert.equal(mpBody.events[0].params.currency, 'USD');
      assert.equal(mpBody.events[0].params.value, 350);

      // Replay with same event_name + event_id dedupes locally without hitting GA4 MP twice
      const resReplay = await fn.handler({
        httpMethod: 'POST',
        headers: { 'x-lhi-webhook-signature': sig },
        body: rawBody
      });
      assert.equal(resReplay.statusCode, 200);
      assert.equal(JSON.parse(resReplay.body).deduped, true);
      assert.equal(fetchCalls.length, 1);

      // Same event_id transitioning to close_convert_lead fires distinctly
      const convRes = await fn.handler({
        httpMethod: 'POST',
        headers: { authorization: 'Bearer super-secret-token' },
        body: JSON.stringify({
          outcome: 'enrolled',
          event_id: '11111111-2222-4333-8444-555555555555',
          client_id: '123456789.987654321',
          line_of_business: 'aca',
          state_code: 'GA'
        })
      });
      assert.equal(convRes.statusCode, 200);
      assert.equal(fetchCalls.length, 2);
      const mpConvBody = JSON.parse(fetchCalls[1].init.body);
      assert.equal(mpConvBody.client_id, '123456789.987654321');
      assert.equal(mpConvBody.events[0].name, 'close_convert_lead');
      assert.equal(mpConvBody.events[0].params.state_code, 'GA');
    });
  } finally {
    global.fetch = origFetch;
  }
});
