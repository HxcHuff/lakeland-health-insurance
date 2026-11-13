import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const resend = require('../netlify/functions/lib/newsletter-resend.js');
const hopper = require('../netlify/functions/lib/newsletter-hopper.js');
const confirm = require('../netlify/functions/newsletter-confirm.js');
const rateLimit = require('../netlify/functions/lib/newsletter-rate-limit.js');

test('normalizeEmail rejects invalid addresses', () => {
  assert.equal(resend.normalizeEmail(''), '');
  assert.equal(resend.normalizeEmail('not-an-email'), '');
  assert.equal(resend.normalizeEmail(' Reader@Example.COM '), 'reader@example.com');
});

test('confirm token verifies, carries form name, and expires', () => {
  const secret = 'test-secret-for-newsletter';
  const email = 'reader@example.test';
  const token = resend.mintConfirmToken(email, secret, Date.now(), 'newsletter-signup');
  const ok = resend.verifyConfirmToken(token, secret, Date.now());
  assert.equal(ok.ok, true);
  assert.equal(ok.email, email);
  assert.equal(ok.sourceForm, 'newsletter-signup');

  const expired = resend.verifyConfirmToken(token, secret, Date.now() + 8 * 24 * 60 * 60 * 1000);
  assert.equal(expired.ok, false);
  assert.equal(expired.reason, 'expired');
});

test('websiteNewsletterSource maps form ids for Resend source property', () => {
  assert.equal(resend.websiteNewsletterSource('homepage-newsletter'), 'website-homepage-newsletter');
  assert.equal(resend.websiteNewsletterSource('newsletter-signup'), 'website-newsletter-signup');
});

test('buildConfirmedContactProperties sets source and optin_at', () => {
  const props = resend.buildConfirmedContactProperties('homepage-newsletter', '2026-10-07T20:00:00.000Z');
  assert.equal(props.source, 'website-homepage-newsletter');
  assert.equal(props.optin_at, '2026-10-07T20:00:00.000Z');
  assert.equal(props.lhi_confirm_status, 'confirmed');
});

test('buildContactProperties stores consent metadata', () => {
  const props = resend.buildContactProperties({
    consentText: 'Example consent',
    consentVersion: 'newsletter-signup-2026-10-07-v1',
    sourceForm: 'newsletter-signup',
    signupPage: '/newsletter/',
    signupAt: '2026-10-07T12:00:00.000Z',
    interest: 'medicare'
  });
  assert.equal(props.lhi_confirm_status, 'pending');
  assert.equal(props.lhi_consent_version, 'newsletter-signup-2026-10-07-v1');
  assert.equal(props.lhi_interest, 'medicare');
});

test('hopper quick-add defaults when env unset', () => {
  assert.equal(hopper.hopperConfigured(), false);
});

test('newsletter confirm redirects to status page', () => {
  assert.equal(confirm._test.redirectPath('confirmed'), '/newsletter/confirmed/?status=confirmed');
});

test('startDoubleOptIn HTML-escapes firstName, strips CRLF, and sets AbortSignal timeout', async () => {
  const prevKey = process.env.RESEND_API_KEY;
  const prevSecret = process.env.NEWSLETTER_CONFIRM_SECRET;
  const origFetch = globalThis.fetch;
  const fetchCalls = [];
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.NEWSLETTER_CONFIRM_SECRET = 'confirm-secret-xyz';
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    fetchCalls.push({ url: target, init });
    if (target.includes('/suppressions/') || (target.includes('/contacts/') && (!init.method || init.method === 'GET'))) {
      return new Response('{}', { status: 404 });
    }
    return new Response(JSON.stringify({ id: 'res_123' }), { status: 200 });
  };
  try {
    const out = await resend.startDoubleOptIn({
      email: 'reader@example.test',
      firstName: 'David\r\n<script>alert(1)</script>',
      sourceForm: 'newsletter-signup',
      signupPage: '/newsletter/'
    });
    assert.equal(out.ok, true);
    const emailCall = fetchCalls.find((c) => c.url.endsWith('/emails'));
    assert.ok(emailCall, 'expected Resend /emails call');
    assert.ok(emailCall.init.signal, 'expected AbortSignal timeout on Resend request');
    const sent = JSON.parse(emailCall.init.body);
    assert.equal(sent.text.includes('\r'), false);
    assert.equal(sent.text.includes('\n<script>'), false);
    assert.equal(sent.html.includes('<script>'), false);
    assert.ok(sent.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  } finally {
    globalThis.fetch = origFetch;
    if (prevKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevKey;
    if (prevSecret === undefined) delete process.env.NEWSLETTER_CONFIRM_SECRET;
    else process.env.NEWSLETTER_CONFIRM_SECRET = prevSecret;
  }
});

test('newsletter rate limit prefers x-nf-client-connection-ip over spoofed x-forwarded-for and retries CAS conflict', async () => {
  const storeMap = new Map();
  let forceConflictOnce = false;

  rateLimit.blobsImport(async () => ({
    getStore: () => ({
      async get(key) {
        return storeMap.has(key) ? storeMap.get(key).data : null;
      },
      async getWithMetadata(key) {
        return storeMap.has(key) ? { ...storeMap.get(key) } : null;
      },
      async setJSON(key, value, opts = {}) {
        if (forceConflictOnce) {
          forceConflictOnce = false;
          return { modified: false };
        }
        if (opts.onlyIfNew && storeMap.has(key)) return { modified: false };
        if (opts.onlyIfMatch && storeMap.get(key)?.etag !== opts.onlyIfMatch) return { modified: false };
        storeMap.set(key, { data: value, etag: `etag-${value.count}` });
        return { modified: true };
      }
    })
  }));

  try {
    forceConflictOnce = true;
    for (let i = 0; i < rateLimit.MAX_ATTEMPTS; i += 1) {
      const check = await rateLimit.checkNewsletterRateLimit(
        {
          headers: {
            'x-nf-client-connection-ip': '198.51.100.77',
            'x-forwarded-for': `203.0.113.${i + 1}`
          }
        },
        'reader@example.test'
      );
      assert.equal(check.ok, true, `attempt ${i + 1} should succeed`);
    }

    const blocked = await rateLimit.checkNewsletterRateLimit(
      {
        headers: {
          'x-nf-client-connection-ip': '198.51.100.77',
          'x-forwarded-for': '203.0.113.250'
        }
      },
      'reader@example.test'
    );
    assert.equal(blocked.ok, false);
    assert.equal(blocked.error, 'rate_limited');
  } finally {
    rateLimit.blobsImport(() => import('@netlify/blobs'));
  }
});
