'use strict';

const crypto = require('crypto');

const ISSUER = 'netlify';
const ALGORITHM = 'HS256';

function envSecret(environment = process.env) {
  return String(
    environment.NETLIFY_JWS_SECRET
    || environment.JWS_SECRET
    || ''
  ).trim();
}

function base64UrlEncode(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(String(value || ''), 'base64url');
}

function decodeJsonPart(part) {
  try {
    return JSON.parse(base64UrlDecode(part).toString('utf8'));
  } catch {
    return null;
  }
}

function verifyHs256Jwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || !secret) return null;

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJsonPart(headerPart);
  const payload = decodeJsonPart(payloadPart);
  if (!header || !payload || header.alg !== ALGORITHM) return null;

  const signingInput = `${headerPart}.${payloadPart}`;
  const expected = crypto.createHmac('sha256', secret).update(signingInput).digest();
  const actual = base64UrlDecode(signaturePart);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return null;
  }
  return payload;
}

function payloadSha256(rawBody) {
  return crypto.createHash('sha256').update(String(rawBody || ''), 'utf8').digest('hex');
}

function verifyNetlifyEventSignature(signature, rawBody, secret) {
  if (!signature || !secret) return false;
  const decoded = verifyHs256Jwt(signature, secret);
  if (!decoded || decoded.iss !== ISSUER) return false;
  return decoded.sha256 === payloadSha256(rawBody);
}

function signNetlifyEventBody(rawBody, secret) {
  const header = base64UrlEncode(JSON.stringify({ alg: ALGORITHM, typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: ISSUER,
    sha256: payloadSha256(rawBody)
  }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');
  return `${signingInput}.${signature}`;
}

function readNetlifyJwsSecret(environment = process.env) {
  const secret = envSecret(environment);
  return secret || null;
}

function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const target = String(name || '').toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === target) return String(value || '').trim();
  }
  return '';
}

function eventRawBody(event) {
  const encoded = typeof event.body === 'string' ? event.body : '';
  return event.isBase64Encoded ? Buffer.from(encoded, 'base64').toString('utf8') : encoded;
}

function verifyNetlifyEventRequest(event, environment = process.env) {
  const secret = readNetlifyJwsSecret(environment);
  if (!secret) return { ok: false, reason: 'event_signature_configuration_missing' };
  const rawBody = eventRawBody(event);
  const signature = headerValue(event.headers, 'x-webhook-signature');
  if (!verifyNetlifyEventSignature(signature, rawBody, secret)) {
    return { ok: false, reason: 'invalid_event_signature' };
  }
  return { ok: true };
}

module.exports = {
  verifyNetlifyEventSignature,
  verifyNetlifyEventRequest,
  signNetlifyEventBody,
  readNetlifyJwsSecret,
  headerValue,
  eventRawBody,
  _test: {
    payloadSha256,
    verifyHs256Jwt
  }
};
