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

function headerLookup(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const target = String(name || '').toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === target && v != null) return String(v);
  }
  return '';
}

function clientKey(headers) {
  const realIp = String(
    headerLookup(headers, 'x-nf-client-connection-ip') || headerLookup(headers, 'client-ip') || ''
  ).trim();
  const forwarded = String(headerLookup(headers, 'x-forwarded-for') || '').split(',')[0].trim();
  return realIp || forwarded || 'unknown';
}

async function checkNewsletterRateLimit(event, email) {
  const store = await getStore(event);
  if (!store) return { ok: true, skipped: true };

  const bucket = Math.floor(Date.now() / WINDOW_MS);
  const key = `v1/${sha256(`${clientKey(event.headers || {})}:${normalizeBucketEmail(email)}:${bucket}`)}`;
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const record = typeof store.getWithMetadata === 'function'
        ? await store.getWithMetadata(key, { type: 'json' })
        : { data: await store.get(key, { type: 'json' }), etag: undefined };
      const existing = record && record.data;
      const count = existing && typeof existing.count === 'number' ? existing.count : 0;
      if (count >= MAX_ATTEMPTS) return { ok: false, error: 'rate_limited' };
      const opts = { metadata: { bucket } };
      if (record && record.etag) opts.onlyIfMatch = record.etag;
      else if (!existing) opts.onlyIfNew = true;
      const writeResult = await store.setJSON(key, { count: count + 1 }, opts);
      if (!writeResult || writeResult.modified !== false) {
        return { ok: true };
      }
    }
    return { ok: false, error: 'rate_limited' };
  } catch (err) {
    console.warn(JSON.stringify({
      type: 'newsletter_rate_limit_store_error_v1',
      error: err && err.name ? err.name : 'unknown'
    }));
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
