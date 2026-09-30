'use strict';

const crypto = require('crypto');

const MAILCHIMP_TIMEOUT_MS = 3000;
const NEWSLETTER_FORM_NAMES = Object.freeze(['homepage-newsletter', 'newsletter-signup']);
const NEWSLETTER_FORMS = new Set(NEWSLETTER_FORM_NAMES);

const ALLOWED_SOURCE_TAGS = Object.freeze(['newsletter', 'newsletter-page', 'homepage', 'get-help', 'lead']);
const ALLOWED_COVERAGE_TAGS = Object.freeze(['Medicare', 'Under 65', 'individual-and-family-coverage', 'Life']);

const FORM_SOURCE_TAGS = Object.freeze({
  'homepage-newsletter': Object.freeze(['homepage', 'newsletter']),
  'newsletter-signup': Object.freeze(['newsletter', 'newsletter-page']),
  'get-help': Object.freeze(['get-help', 'lead'])
});

const COVERAGE_FIELDS = Object.freeze([
  'interest',
  'coverage_type',
  'line_of_business',
  'product_interest',
  'inquiry_type',
  'coverage_status'
]);

const COVERAGE_TAG_BY_NORMALIZED = Object.freeze({
  medicare: 'Medicare',
  'under 65': 'Under 65',
  'individual and family coverage': 'individual-and-family-coverage',
  life: 'Life',
  aca: 'individual-and-family-coverage',
  'aca marketplace': 'individual-and-family-coverage',
  'marketplace aca': 'individual-and-family-coverage',
  'individual marketplace': 'individual-and-family-coverage',
  'family marketplace': 'individual-and-family-coverage'
});

const SKIP_MEMBER_STATUSES = new Set(['unsubscribed', 'cleaned', 'archived']);
const KEEP_MEMBER_STATUSES = new Set(['subscribed', 'pending', 'transactional']);

function formNameOf(payload) {
  return String((payload && (payload['form-name'] || payload.form_name)) || '').trim();
}

function emailOf(payload) {
  return String((payload && payload.email) || '').trim();
}

function memberHash(email) {
  return crypto.createHash('md5').update(String(email || '').trim().toLowerCase()).digest('hex');
}

function normalizeCoverageValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[&]+/g, ' ')
    .replace(/[_/\-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function coverageTagFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return '';
  for (const field of COVERAGE_FIELDS) {
    const mapped = COVERAGE_TAG_BY_NORMALIZED[normalizeCoverageValue(payload[field])];
    if (mapped) return mapped;
  }
  return '';
}

function sourceTagsForForm(formName) {
  const mapped = FORM_SOURCE_TAGS[formName];
  if (mapped) return mapped.slice();
  if (formName) return ['lead'];
  return [];
}

function tagsForPayload(payload, formName) {
  const tags = [];
  const seen = new Set();
  for (const tag of sourceTagsForForm(formName || formNameOf(payload))) {
    if (ALLOWED_SOURCE_TAGS.includes(tag) && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  const coverage = coverageTagFromPayload(payload);
  if (coverage && ALLOWED_COVERAGE_TAGS.includes(coverage) && !seen.has(coverage)) {
    seen.add(coverage);
    tags.push(coverage);
  }
  return tags;
}

function mergeFieldsFromPayload(payload) {
  const mergeFields = {};
  if (!payload || typeof payload !== 'object') return mergeFields;
  const first = String(payload.first_name || '').trim();
  const last = String(payload.last_name || '').trim();
  if (first) mergeFields.FNAME = first;
  if (last) mergeFields.LNAME = last;
  if (!first && payload.full_name) {
    const parts = String(payload.full_name).trim().split(/\s+/).filter(Boolean);
    if (parts[0]) mergeFields.FNAME = parts[0];
    if (parts.length > 1) mergeFields.LNAME = parts.slice(1).join(' ');
  }
  return mergeFields;
}

function isNewsletterForm(formName) {
  return NEWSLETTER_FORMS.has(formName);
}

function hasMarketingEmailConsent(payload, formName) {
  if (isNewsletterForm(formName)) return true;
  return String((payload && payload.consent_marketing_email) || '').trim().toLowerCase() === 'yes';
}

function shouldAttemptMailchimpSync(payload, formName) {
  const resolvedForm = formName || formNameOf(payload);
  return Boolean(emailOf(payload) && hasMarketingEmailConsent(payload, resolvedForm));
}

function readMailchimpConfig(env = process.env) {
  const apiKey = String((env && env.MAILCHIMP_API_KEY) || '').trim();
  const audienceId = String((env && env.MAILCHIMP_AUDIENCE_ID) || '').trim();
  const dc = String((env && (env.MAILCHIMP_DC || env.MAILCHIMP_SERVER_PREFIX)) || '').trim();
  return { apiKey, audienceId, dc };
}

function redactSecret(text, secret) {
  const raw = String(text == null ? '' : text);
  if (!secret) return raw;
  return raw.split(secret).join('[redacted]');
}

function safeMailchimpError(error, apiKey) {
  const name = error && error.name ? String(error.name) : '';
  if (name === 'AbortError') return 'Mailchimp timeout';
  const message = redactSecret(error && error.message ? error.message : error, apiKey);
  if (/timeout/i.test(message)) return 'Mailchimp timeout';
  return `Mailchimp exception${name ? ` (${name})` : ''}`;
}

function remainingMs(deadline) {
  return Math.max(1, deadline - Date.now());
}

async function fetchWithTimeout(fetchImpl, url, init, deadline) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), remainingMs(deadline)) : null;
  try {
    return await fetchImpl(url, controller ? { ...init, signal: controller.signal } : init);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readMemberStatus(res) {
  if (res.status === 404) return { exists: false, status: '' };
  if (!res.ok) return { error: `MC lookup ${res.status}` };
  let body = null;
  try {
    body = typeof res.json === 'function' ? await res.json() : null;
  } catch (_) {
    return { error: 'MC lookup invalid body' };
  }
  const status = String((body && body.status) || '').trim().toLowerCase();
  return { exists: true, status };
}

async function syncToMailchimp(payload, options = {}) {
  const formName = formNameOf(payload);
  if (!shouldAttemptMailchimpSync(payload, formName)) {
    return { ok: false, skipped: true };
  }

  const env = options.env || process.env;
  const { apiKey, audienceId, dc } = readMailchimpConfig(env);
  const logger = options.logger || console;
  if (!apiKey) {
    logger.warn('Mailchimp skipped: MAILCHIMP_API_KEY is unset');
    return { ok: false, skipped: true };
  }
  if (!audienceId || !dc) {
    logger.warn('Mailchimp skipped: MAILCHIMP_AUDIENCE_ID or MAILCHIMP_DC is unset');
    return { ok: false, skipped: true };
  }

  const email = emailOf(payload);
  const hash = memberHash(email);
  const baseUrl = `https://${dc}.api.mailchimp.com/3.0/lists/${audienceId}/members/${hash}`;
  const auth = `Basic ${Buffer.from(`any:${apiKey}`).toString('base64')}`;
  const headers = {
    Authorization: auth,
    'Content-Type': 'application/json'
  };
  const fetchImpl = options.fetch || fetch;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : MAILCHIMP_TIMEOUT_MS;
  const deadline = Date.now() + Math.max(1, timeoutMs);
  const mergeFields = mergeFieldsFromPayload(payload);
  const tags = tagsForPayload(payload, formName);

  let existing;
  try {
    const lookup = await fetchWithTimeout(fetchImpl, baseUrl, { method: 'GET', headers }, deadline);
    existing = await readMemberStatus(lookup);
  } catch (error) {
    return { ok: false, error: safeMailchimpError(error, apiKey) };
  }
  if (existing.error) return { ok: false, error: existing.error };
  if (existing.exists && SKIP_MEMBER_STATUSES.has(existing.status)) {
    return { ok: false, skipped: true };
  }
  if (existing.exists && existing.status && !KEEP_MEMBER_STATUSES.has(existing.status)) {
    return { ok: false, skipped: true };
  }

  const upsertBody = { email_address: email };
  if (Object.keys(mergeFields).length) upsertBody.merge_fields = mergeFields;
  if (!existing.exists) upsertBody.status_if_new = 'pending';

  try {
    const upsert = await fetchWithTimeout(fetchImpl, baseUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(upsertBody)
    }, deadline);
    if (!upsert.ok) return { ok: false, error: `MC upsert ${upsert.status}` };
  } catch (error) {
    return { ok: false, error: safeMailchimpError(error, apiKey) };
  }

  if (!tags.length) return { ok: true };
  try {
    const tagRes = await fetchWithTimeout(fetchImpl, `${baseUrl}/tags`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tags: tags.map((name) => ({ name, status: 'active' }))
      })
    }, deadline);
    if (!tagRes.ok) return { ok: true, error: `MC tags ${tagRes.status}` };
  } catch (error) {
    return { ok: true, error: safeMailchimpError(error, apiKey) };
  }
  return { ok: true };
}

module.exports = {
  ALLOWED_COVERAGE_TAGS,
  ALLOWED_SOURCE_TAGS,
  MAILCHIMP_TIMEOUT_MS,
  NEWSLETTER_FORM_NAMES,
  coverageTagFromPayload,
  memberHash,
  mergeFieldsFromPayload,
  readMailchimpConfig,
  shouldAttemptMailchimpSync,
  sourceTagsForForm,
  syncToMailchimp,
  tagsForPayload
};
