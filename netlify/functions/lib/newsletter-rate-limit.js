'use strict';

const crypto = require('node:crypto');

const STORE_NAME = 'newsletter-signup-rate-v1';
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 12;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

let blobsImport = () => import('@netlify/blobs');

async function getStore(event) {
  try {
    const blobs = await blobsImport();
    if (!blobs || typeof blobs.getStore !== 'function') return null;
    if (event && typeof blobs.connectLambda === 'function') {
      blobs.connectLambda(event);
    }
    return blobs.getStore({ name: STORE_NAME, consistency: 'strong' });
  } catch (_) {
    return null;
  }
}

function clientKey(headers) {
  const forwarded = String(headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '').split(',')[0].trim();
  const realIp = String(headers['x-nf-client-connection-ip'] || headers['client-ip'] || '').trim();
  return forwarded || realIp || 'unknown';
}

async function checkNewsletterRateLimit(event, email) {
  const store = await getStore(event);
  if (!store) return { ok: true, skipped: true };

  const bucket = Math.floor(Date.now() / WINDOW_MS);
  const key = `v1/${sha256(`${clientKey(event.headers || {})}:${normalizeBucketEmail(email)}:${bucket}`)}`;
  let count = 0;
  try {
    const existing = await store.get(key, { type: 'json' });
    count = existing && typeof existing.count === 'number' ? existing.count : 0;
    if (count >= MAX_ATTEMPTS) return { ok: false, error: 'rate_limited' };
    await store.setJSON(key, { count: count + 1 }, { metadata: { bucket } });
    return { ok: true };
  } catch (_) {
    return { ok: true, skipped: true };
  }
}

function normalizeBucketEmail(email) {
  return String(email || '').trim().toLowerCase().slice(0, 254);
}

module.exports = {
  MAX_ATTEMPTS,
  WINDOW_MS,
  checkNewsletterRateLimit,
  blobsImport: (fn) => {
    blobsImport = fn;
  }
};
