'use strict';

const { sha256Prefix, normalizeEmail, cleanName } = require('./newsletter-resend');

const DEFAULT_HOPPER_URL = 'https://huff-health-app.vercel.app/api/leads/quick-add';

function env(name) {
  return String(process.env[name] || '').trim();
}

function hopperConfigured() {
  return Boolean(env('HOPPER_INTAKE_URL') || DEFAULT_HOPPER_URL) && Boolean(env('HOPPER_INTAKE_KEY'));
}

function mapInterestToInsuranceType(interest) {
  const value = String(interest || '').trim().toLowerCase();
  if (value === 'medicare') return 'MEDICARE_ADVANTAGE';
  if (value === 'aca') return 'ACA';
  return 'OTHER';
}

/**
 * Quiet Hopper quick-add on confirmed newsletter opt-in only.
 * Failure must not break confirmation.
 */
async function notifyHopperOfConfirmedSubscriber(input) {
  if (!hopperConfigured()) {
    console.info(JSON.stringify({ type: 'newsletter_hopper_skipped_v1', reason: 'not_configured' }));
    return { ok: false, skipped: true };
  }

  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, skipped: true, error: 'invalid_email' };

  const url = env('HOPPER_INTAKE_URL') || DEFAULT_HOPPER_URL;
  const body = {
    firstName: cleanName(input.firstName) || undefined,
    lastName: cleanName(input.lastName) || undefined,
    email,
    phone: cleanName(input.phone) || undefined,
    source: 'lhi_newsletter_confirmed',
    status: 'NEW_LEAD',
    insuranceType: mapInterestToInsuranceType(input.interest),
    notes: [
      'Newsletter double opt-in confirmed on lakelandhealthinsurance.com.',
      'Email-only newsletter consent; do not treat as phone/SMS marketing consent.',
      input.signupPage ? `Signup page: ${input.signupPage}` : null,
      input.confirmedAt ? `Confirmed at: ${input.confirmedAt}` : null
    ].filter(Boolean).join(' ')
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env('HOPPER_INTAKE_KEY')}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.error(JSON.stringify({
        type: 'newsletter_hopper_failed_v1',
        email_hash: sha256Prefix(email),
        status: res.status
      }));
      return { ok: false, error: `hopper_${res.status}` };
    }
    console.info(JSON.stringify({
      type: 'newsletter_hopper_ok_v1',
      email_hash: sha256Prefix(email),
      status: res.status
    }));
    return { ok: true };
  } catch (e) {
    console.error(JSON.stringify({
      type: 'newsletter_hopper_exception_v1',
      email_hash: sha256Prefix(email),
      name: e && e.name ? e.name : 'Error'
    }));
    return { ok: false, error: 'hopper_exception' };
  }
}

module.exports = {
  DEFAULT_HOPPER_URL,
  hopperConfigured,
  notifyHopperOfConfirmedSubscriber
};
