'use strict';

const CONTROL_TEXT = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu;

function cleanText(value, maximum) {
  const text = String(value == null ? '' : value).normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!text) return '';
  return text.replace(CONTROL_TEXT, '').slice(0, maximum);
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function normalizePhone(value) {
  const digits = cleanText(value, 32).replace(/\D/gu, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return '';
}

const DEFAULT_HOPPER_URL = 'https://huff-health-app.vercel.app/api/leads/quick-add';
const SITE_LEAD_FORMS = new Set(['site-medicare-lead', 'site-aca-lead']);

function env(name, environment = process.env) {
  return String(environment[name] || '').trim();
}

function hopperConfigured(environment = process.env) {
  return Boolean(env('HOPPER_INTAKE_URL', environment) || DEFAULT_HOPPER_URL)
    && Boolean(env('HOPPER_INTAKE_KEY', environment));
}

function mapInsuranceType(formName) {
  return formName === 'site-medicare-lead' ? 'MEDICARE' : 'ACA';
}

function buildHopperBody(websiteLead) {
  const lead = websiteLead || {};
  const fullName = cleanText(lead.name || [lead.first_name, lead.last_name].filter(Boolean).join(' '), 120);
  const { first, last } = splitName(fullName);
  const firstName = lead.first_name || first;
  const lastName = lead.last_name || last;
  const phone = normalizePhone(lead.phone);
  const zip = cleanText(lead.zip, 10);
  const notes = [
    `Site lead form: ${lead.form_name}`,
    lead.page_url ? `page_url=${lead.page_url}` : null,
    lead.intent ? `intent=${lead.intent}` : null,
    lead.insurance_type ? `insurance_type=${lead.insurance_type}` : null
  ].filter(Boolean).join(' | ');

  return {
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    phone: phone || undefined,
    zipCode: zip || undefined,
    source: 'lhi_site_lead_form',
    status: 'NEW_LEAD',
    insuranceType: mapInsuranceType(websiteLead.form_name),
    notes
  };
}

async function deliverSiteLeadToHopper(websiteLead, {
  fetchImpl = globalThis.fetch,
  environment = process.env
} = {}) {
  if (!SITE_LEAD_FORMS.has(String(websiteLead && websiteLead.form_name || ''))) {
    return { ok: false, skipped: true, reason: 'not_site_lead_form' };
  }
  if (!hopperConfigured(environment)) {
    console.error(JSON.stringify({ type: 'site_lead_hopper_missing_config_v1', form: websiteLead.form_name }));
    return { ok: false, error: 'hopper_not_configured' };
  }

  const url = env('HOPPER_INTAKE_URL', environment) || DEFAULT_HOPPER_URL;
  const body = buildHopperBody(websiteLead);
  if (!body.phone) return { ok: false, error: 'phone_required' };

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env('HOPPER_INTAKE_KEY', environment)}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.error(JSON.stringify({
        type: 'site_lead_hopper_failed_v1',
        form: websiteLead.form_name,
        status: res.status
      }));
      return { ok: false, error: `hopper_${res.status}` };
    }
    console.info(JSON.stringify({
      type: 'site_lead_hopper_ok_v1',
      form: websiteLead.form_name,
      status: res.status
    }));
    return { ok: true };
  } catch (e) {
    console.error(JSON.stringify({
      type: 'site_lead_hopper_exception_v1',
      form: websiteLead.form_name,
      name: e && e.name ? e.name : 'Error'
    }));
    return { ok: false, error: 'hopper_exception' };
  }
}

module.exports = {
  DEFAULT_HOPPER_URL,
  SITE_LEAD_FORMS,
  deliverSiteLeadToHopper,
  hopperConfigured
};
