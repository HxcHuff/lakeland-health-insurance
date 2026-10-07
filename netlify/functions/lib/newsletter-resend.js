'use strict';

const crypto = require('node:crypto');

const PRIMARY_SITE_ORIGIN = 'https://lakelandhealthinsurance.com';
const RESEND_API = 'https://api.resend.com';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const EMAIL_MAX = 254;
const NAME_MAX = 80;

const CAN_SPAM_POSTAL = Object.freeze({
  name: 'Lakeland Health Insurance',
  agent: 'David Huff',
  street: '2298 Lakeland Hills Blvd',
  city: 'Lakeland',
  state: 'FL',
  zip: '33805'
});

function env(name) {
  return String(process.env[name] || '').trim();
}

function sha256Prefix(value, hexLen = 12) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, hexLen);
}

function normalizeEmail(raw) {
  const email = String(raw || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase();
  if (!email || email.length > EMAIL_MAX) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}

function cleanName(raw, max = NAME_MAX) {
  return String(raw || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64url(text) {
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
  const b64 = String(text).replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function signTokenPayload(payload, secret) {
  return b64url(crypto.createHmac('sha256', secret).update(payload).digest());
}

function mintConfirmToken(email, secret, nowMs = Date.now()) {
  const exp = Math.floor(nowMs / 1000) + TOKEN_TTL_SECONDS;
  const body = `${exp}.${b64url(Buffer.from(email, 'utf8'))}`;
  const sig = signTokenPayload(body, secret);
  return `${body}.${sig}`;
}

function verifyConfirmToken(token, secret, nowMs = Date.now()) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [expRaw, emailB64, sig] = parts;
  const body = `${expRaw}.${emailB64}`;
  const expected = signTokenPayload(body, secret);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return { ok: false, reason: 'bad_signature' };
  }
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= Math.floor(nowMs / 1000)) {
    return { ok: false, reason: 'expired' };
  }
  let email;
  try {
    email = normalizeEmail(fromB64url(emailB64).toString('utf8'));
  } catch (_) {
    return { ok: false, reason: 'malformed' };
  }
  if (!email) return { ok: false, reason: 'invalid_email' };
  return { ok: true, email, exp };
}

function confirmUrl(token) {
  const origin = env('URL') && env('URL').startsWith('http') ? env('URL').replace(/\/$/, '') : PRIMARY_SITE_ORIGIN;
  return `${origin}/api/newsletter-confirm?token=${encodeURIComponent(token)}`;
}

function canSpamFooterText() {
  const p = CAN_SPAM_POSTAL;
  return `${p.agent} · ${p.name}\n${p.street}\n${p.city}, ${p.state} ${p.zip}`;
}

function canSpamFooterHtml() {
  const p = CAN_SPAM_POSTAL;
  return `${p.agent} · ${p.name}<br>${p.street}<br>${p.city}, ${p.state} ${p.zip}`;
}

async function resendFetch(path, options = {}) {
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey) return { ok: false, skipped: true, status: 0, error: 'resend_not_configured' };
  const res = await fetch(`${RESEND_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text, skipped: false };
}

async function upsertPendingContact({
  email,
  firstName,
  lastName,
  properties
}) {
  const body = {
    email,
    unsubscribed: false,
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(properties && Object.keys(properties).length ? { properties } : {})
  };
  let result = await resendFetch('/contacts', { method: 'POST', body: JSON.stringify(body) });
  if (result.ok) return { ok: true, action: 'created' };
  if (result.status === 409) {
    result = await resendFetch(`/contacts/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(properties && Object.keys(properties).length ? { properties } : {})
      })
    });
    return result.ok
      ? { ok: true, action: 'updated' }
      : { ok: false, error: `resend_update_${result.status}` };
  }
  return { ok: false, error: `resend_create_${result.status}` };
}

async function addContactToNewsletterSegment(email) {
  const segmentId = env('RESEND_NEWSLETTER_SEGMENT_ID');
  if (!segmentId) return { ok: false, skipped: true, error: 'segment_not_configured' };
  const result = await resendFetch(`/contacts/${encodeURIComponent(email)}/segments/${encodeURIComponent(segmentId)}`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  if (result.ok || result.status === 409) return { ok: true };
  return { ok: false, error: `resend_segment_${result.status}` };
}

async function sendConfirmationEmail({ email, firstName, confirmLink }) {
  const from = env('NEWSLETTER_FROM') || 'David Huff <newsletter@lakelandhealthinsurance.com>';
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const text = [
    greeting,
    '',
    'Please confirm your email to join The Coverage Insider newsletter from Lakeland Health Insurance.',
    'You will receive occasional educational emails about general health insurance and Medicare topics for Florida readers — not sales calls or plan marketing texts.',
    '',
    `Confirm your subscription: ${confirmLink}`,
    '',
    'If you did not request this, ignore this email. You will not be added until you confirm.',
    '',
    canSpamFooterText()
  ].join('\n');

  const html = [
    `<p>${greeting}</p>`,
    '<p>Please confirm your email to join <strong>The Coverage Insider</strong> newsletter from Lakeland Health Insurance.</p>',
    '<p>You will receive occasional educational emails about general health insurance and Medicare topics for Florida readers — not sales calls or plan marketing texts.</p>',
    `<p><a href="${confirmLink}">Confirm your subscription</a></p>`,
    '<p style="font-size:14px;color:#555;">If you did not request this, ignore this email. You will not be added until you confirm.</p>',
    `<p style="font-size:12px;color:#777;">${canSpamFooterHtml()}</p>`
  ].join('');

  const result = await resendFetch('/emails', {
    method: 'POST',
    body: JSON.stringify({
      from,
      to: email,
      subject: 'Confirm your Lakeland Health Insurance newsletter',
      text,
      html
    })
  });
  return result.ok
    ? { ok: true }
    : { ok: false, error: `resend_email_${result.status}` };
}

function buildContactProperties(meta) {
  return {
    lhi_consent_text: String(meta.consentText || '').slice(0, 500),
    lhi_consent_version: String(meta.consentVersion || '').slice(0, 80),
    lhi_source_form: String(meta.sourceForm || '').slice(0, 80),
    lhi_signup_page: String(meta.signupPage || '').slice(0, 200),
    lhi_signup_at: String(meta.signupAt || '').slice(0, 40),
    lhi_confirm_status: 'pending',
    lhi_interest: String(meta.interest || '').slice(0, 80)
  };
}

async function getContactByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, error: 'invalid_email' };
  const result = await resendFetch(`/contacts/${encodeURIComponent(normalized)}`, { method: 'GET' });
  if (!result.ok || !result.json) return { ok: false, error: `resend_get_${result.status}` };
  return { ok: true, contact: result.json };
}

async function markContactConfirmed(email, confirmedAt) {
  return resendFetch(`/contacts/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: {
        lhi_confirm_status: 'confirmed',
        lhi_confirmed_at: confirmedAt
      }
    })
  });
}

async function startDoubleOptIn(input) {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: 'invalid_email' };

  const secret = env('NEWSLETTER_CONFIRM_SECRET');
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey || !secret) {
    console.info(JSON.stringify({
      type: 'newsletter_doi_skipped_v1',
      reason: !apiKey ? 'resend_unconfigured' : 'confirm_secret_unconfigured',
      email_hash: sha256Prefix(email)
    }));
    return { ok: false, skipped: true, error: 'newsletter_not_configured' };
  }

  const firstName = cleanName(input.firstName);
  const lastName = cleanName(input.lastName);
  const signupAt = input.signupAt || new Date().toISOString();
  const properties = buildContactProperties({
    consentText: input.consentText,
    consentVersion: input.consentVersion,
    sourceForm: input.sourceForm,
    signupPage: input.signupPage,
    signupAt,
    interest: input.interest
  });

  const contact = await upsertPendingContact({ email, firstName, lastName, properties });
  if (!contact.ok) {
    console.error(JSON.stringify({
      type: 'newsletter_doi_contact_failed_v1',
      email_hash: sha256Prefix(email),
      error: contact.error
    }));
    return { ok: false, error: contact.error || 'contact_failed' };
  }

  const token = mintConfirmToken(email, secret);
  const link = confirmUrl(token);
  const mail = await sendConfirmationEmail({ email, firstName, confirmLink: link });
  if (!mail.ok) {
    console.error(JSON.stringify({
      type: 'newsletter_doi_email_failed_v1',
      email_hash: sha256Prefix(email),
      error: mail.error
    }));
    return { ok: false, error: mail.error || 'email_failed' };
  }

  console.info(JSON.stringify({
    type: 'newsletter_doi_sent_v1',
    email_hash: sha256Prefix(email),
    form: cleanName(input.sourceForm, 40),
    contact_action: contact.action
  }));
  return { ok: true, action: contact.action };
}

async function completeDoubleOptIn(email, confirmedAt = new Date().toISOString()) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, error: 'invalid_email' };

  const segment = await addContactToNewsletterSegment(normalized);
  if (!segment.ok && !segment.skipped) {
    console.error(JSON.stringify({
      type: 'newsletter_confirm_segment_failed_v1',
      email_hash: sha256Prefix(normalized),
      error: segment.error
    }));
    return { ok: false, error: segment.error || 'segment_failed' };
  }

  const patch = await markContactConfirmed(normalized, confirmedAt);
  if (!patch.ok) {
    console.error(JSON.stringify({
      type: 'newsletter_confirm_patch_failed_v1',
      email_hash: sha256Prefix(normalized),
      status: patch.status
    }));
  }

  console.info(JSON.stringify({
    type: 'newsletter_confirmed_v1',
    email_hash: sha256Prefix(normalized),
    segment: segment.skipped ? 'skipped' : 'added'
  }));
  return { ok: true, email: normalized, confirmedAt };
}

module.exports = {
  CAN_SPAM_POSTAL,
  TOKEN_TTL_SECONDS,
  addContactToNewsletterSegment,
  buildContactProperties,
  cleanName,
  completeDoubleOptIn,
  confirmUrl,
  getContactByEmail,
  mintConfirmToken,
  normalizeEmail,
  sha256Prefix,
  startDoubleOptIn,
  verifyConfirmToken
};
