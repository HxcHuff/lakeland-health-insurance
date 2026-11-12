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
const PERMANENT_STATUSES = new Set([400, 401, 403, 404, 422]);
const TIMEOUT_MILLISECONDS = 8000;

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

function deriveHopperSource(lead) {
  const clickType = cleanText(lead.click_id_type, 16).toLowerCase();
  const channel = cleanText(lead.lead_channel, 32).toLowerCase();
  const utmSource = cleanText(lead.utm_source || lead.first_utm_source, 64).toLowerCase();
  const utmMedium = cleanText(lead.utm_medium || lead.first_utm_medium, 64).toLowerCase();

  if (
    clickType === 'fbclid'
    || channel === 'facebook'
    || /^(?:facebook|fb|fb_ig|instagram|ig|meta)$/.test(utmSource)
  ) {
    return 'facebook_ads';
  }
  if (
    Boolean(lead.gclid || lead.gbraid || lead.wbraid)
    || clickType === 'gclid'
    || clickType === 'gbraid'
    || clickType === 'wbraid'
    || channel === 'google_ads'
    || (utmSource === 'google' && /^(?:cpc|ppc|paid)$/.test(utmMedium))
  ) {
    return 'google_ads';
  }
  return 'lhi_site_lead_form';
}

function normalizeState(value) {
  const state = cleanText(value, 8).toUpperCase();
  return /^[A-Z]{2}$/.test(state) ? state : '';
}

function buildHopperBody(websiteLead) {
  const lead = websiteLead || {};
  const fullName = cleanText(lead.name || [lead.first_name, lead.last_name].filter(Boolean).join(' '), 120);
  const { first, last } = splitName(fullName);
  const firstName = lead.first_name || first;
  const lastName = lead.last_name || last;
  const phone = normalizePhone(lead.phone);
  const email = cleanText(lead.email, 160).toLowerCase();
  const zip = cleanText(lead.zip, 10);
  const state = normalizeState(lead.state);
  const coverageStatus = cleanText(lead.coverage_status, 80);
  const bestTimeToReach = cleanText(lead.best_time_to_reach, 80);
  const medicareStage = cleanText(lead.medicare_stage, 80);
  const ageTimeline = cleanText(lead.age_timeline, 80);
  const utmSource = cleanText(lead.utm_source || lead.first_utm_source, 80);
  const utmCampaign = cleanText(lead.utm_campaign || lead.first_utm_campaign, 120);
  const utmContent = cleanText(lead.utm_content || lead.first_utm_content, 120);
  const notes = [
    `Site lead form: ${lead.form_name}`,
    state ? `state=${state}` : null,
    lead.page_url ? `page_url=${lead.page_url}` : null,
    lead.intent ? `intent=${lead.intent}` : null,
    lead.insurance_type ? `insurance_type=${lead.insurance_type}` : null,
    coverageStatus ? `coverage_status=${coverageStatus}` : null,
    bestTimeToReach ? `best_time_to_reach=${bestTimeToReach}` : null,
    medicareStage ? `medicare_stage=${medicareStage}` : null,
    ageTimeline ? `age_timeline=${ageTimeline}` : null,
    utmSource ? `utm_source=${utmSource}` : null,
    utmCampaign ? `utm_campaign=${utmCampaign}` : null,
    lead.click_id_type ? `click_id_type=${lead.click_id_type}` : null
  ].filter(Boolean).join(' | ');

  return {
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    phone: phone || undefined,
    email: email || undefined,
    zipCode: zip || undefined,
    state: state || undefined,
    source: deriveHopperSource(lead),
    campaign: utmCampaign || undefined,
    utmSource: utmSource || undefined,
    utmCampaign: utmCampaign || undefined,
    utmContent: utmContent || undefined,
    status: 'NEW_LEAD',
    insuranceType: mapInsuranceType(websiteLead.form_name),
    notes
  };
}

async function deliverSiteLeadToHopper(websiteLead, {
  fetchImpl = globalThis.fetch,
  environment = process.env,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  timeoutMilliseconds = TIMEOUT_MILLISECONDS
} = {}) {
  if (!SITE_LEAD_FORMS.has(String(websiteLead && websiteLead.form_name || ''))) {
    return { ok: false, skipped: true, permanent: true, reason: 'not_site_lead_form' };
  }
  if (!hopperConfigured(environment)) {
    console.error(JSON.stringify({ type: 'site_lead_hopper_missing_config_v1', form: websiteLead.form_name }));
    return { ok: false, permanent: false, error: 'hopper_not_configured' };
  }

  const url = env('HOPPER_INTAKE_URL', environment) || DEFAULT_HOPPER_URL;
  const body = buildHopperBody(websiteLead);
  if (!body.phone) return { ok: false, permanent: true, error: 'phone_required' };

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimer(() => controller.abort(), timeoutMilliseconds) : null;

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env('HOPPER_INTAKE_KEY', environment)}`
      },
      body: JSON.stringify(body),
      ...(controller ? { signal: controller.signal } : {})
    });
    if (!res.ok) {
      console.error(JSON.stringify({
        type: 'site_lead_hopper_failed_v1',
        form: websiteLead.form_name,
        status: res.status
      }));
      return {
        ok: false,
        status: res.status,
        permanent: PERMANENT_STATUSES.has(res.status),
        error: `hopper_${res.status}`
      };
    }
    console.info(JSON.stringify({
      type: 'site_lead_hopper_ok_v1',
      form: websiteLead.form_name,
      status: res.status
    }));
    return { ok: true, status: res.status };
  } catch (e) {
    const timedOut = Boolean(
      (e && e.name === 'AbortError') || (controller && controller.signal && controller.signal.aborted)
    );
    console.error(JSON.stringify({
      type: 'site_lead_hopper_exception_v1',
      form: websiteLead.form_name,
      name: timedOut ? 'AbortError' : (e && e.name ? e.name : 'Error')
    }));
    return {
      ok: false,
      permanent: false,
      error: timedOut ? 'hopper_timeout' : 'hopper_exception'
    };
  } finally {
    if (timer) clearTimer(timer);
  }
}

module.exports = {
  DEFAULT_HOPPER_URL,
  SITE_LEAD_FORMS,
  TIMEOUT_MILLISECONDS,
  buildHopperBody,
  deliverSiteLeadToHopper,
  hopperConfigured
};
