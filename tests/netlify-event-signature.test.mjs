import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  signNetlifyEventBody,
  verifyNetlifyEventSignature,
  verifyNetlifyEventRequest
} = require('../netlify/functions/lib/netlify-event-signature.js');

const SECRET = 'synthetic-netlify-jws-secret-001';

test('verifyNetlifyEventSignature accepts a valid Netlify JWS', () => {
  const body = JSON.stringify({ payload: { form_name: 'site-aca-lead' } });
  const signature = signNetlifyEventBody(body, SECRET);
  assert.equal(verifyNetlifyEventSignature(signature, body, SECRET), true);
});

test('verifyNetlifyEventSignature rejects tampered bodies and wrong secrets', () => {
  const body = JSON.stringify({ payload: { form_name: 'site-aca-lead' } });
  const signature = signNetlifyEventBody(body, SECRET);
  assert.equal(verifyNetlifyEventSignature(signature, `${body}x`, SECRET), false);
  assert.equal(verifyNetlifyEventSignature(signature, body, 'wrong-secret'), false);
  assert.equal(verifyNetlifyEventSignature('', body, SECRET), false);
});

test('verifyNetlifyEventRequest maps missing configuration and invalid signatures', () => {
  const body = JSON.stringify({ ok: true });
  const signature = signNetlifyEventBody(body, SECRET);
  assert.deepEqual(verifyNetlifyEventRequest({ body, headers: {} }, {}), {
    ok: false,
    reason: 'event_signature_configuration_missing'
  });
  assert.deepEqual(
    verifyNetlifyEventRequest({ body, headers: { 'x-webhook-signature': signature } }, {}),
    { ok: false, reason: 'event_signature_configuration_missing' }
  );
  assert.deepEqual(
    verifyNetlifyEventRequest(
      { body, headers: { 'x-webhook-signature': signature } },
      { NETLIFY_JWS_SECRET: SECRET }
    ),
    { ok: true }
  );
});
