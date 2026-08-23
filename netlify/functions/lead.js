// Netlify Function: /api/lead
// 1. Mints server-side receipt metadata before any downstream action
// 2. Forwards the submission to Netlify Forms as the acceptance boundary
// 3. Fires conversion/audience integrations only after Forms accepts the request
// 4. Returns acceptance metadata and canonical, non-identifying attribution

const crypto = require('crypto');
const { sendAdsLead } = require('./lib/ads-capi');

const META_DATASET_ID = '1480756087079484';
const META_GRAPH_VERSION = 'v25.0';
const CONFIGURED_META_DATASET_ID = String(process.env.META_PIXEL_ID || '').trim();
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE; // optional
// Netlify injects CONTEXT=production|deploy-preview|branch-deploy|dev.
// Only fire CAPI on the production context — previews/branches must stay quiet.
const NETLIFY_CONTEXT = process.env.CONTEXT || 'unknown';
const SITE_ENV = process.env.LHI_SITE_ENV || 'unknown';
const IS_PROD_CONTEXT = NETLIFY_CONTEXT === 'production' && SITE_ENV === 'production';

// Mailchimp — single audience, tag-segmented. All three vars must be set
// or the sync no-ops gracefully (matches the CAPI guard pattern above).
const MC_API_KEY = process.env.MAILCHIMP_API_KEY;
const MC_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;
const MC_SERVER = process.env.MAILCHIMP_SERVER_PREFIX; // e.g. "us12"

const PRIMARY_SITE_ORIGIN = 'https://lakelandhealthinsurance.com';
const MAX_JSON_BODY_BYTES = 64 * 1024;
const MAX_FORM_FIELD_CHARS = 8 * 1024;
const DEFAULT_LEAD_ALLOWED_ORIGINS = [
  PRIMARY_SITE_ORIGIN,
  'https://www.lakelandhealthinsurance.com',
  process.env.URL,
  process.env.DEPLOY_URL,
  process.env.DEPLOY_PRIME_URL,
  process.env.LEAD_FORMS_ORIGIN
];
const LEAD_ALLOWED_ORIGINS = new Set(
  DEFAULT_LEAD_ALLOWED_ORIGINS
    .concat(String(process.env.LEAD_ALLOWED_ORIGINS || '').split(','))
    .map(normalizeOrigin)
    .filter(Boolean)
);
const FORMS_FORWARD_ORIGIN = normalizeOrigin(
  process.env.LEAD_FORMS_ORIGIN || process.env.DEPLOY_URL || process.env.DEPLOY_PRIME_URL || process.env.URL
) || PRIMARY_SITE_ORIGIN;

const MEDICARE_CONTENT_CLUSTER = 'lakeland_medicare_broker';
const MEDICARE_SOURCE_REGISTRY = Object.freeze({
  medicare: Object.freeze({
    page_role: 'hub',
    cta_keys: new Set([
      'start_review_hero',
      'request_review_process',
      'start_review_final',
      'menu_get_help',
      'header_talk_to_david',
      'footer_start_plan_review'
    ])
  }),
  aep_2026_polk_county_checklist: Object.freeze({
    page_role: 'education',
    cta_keys: new Set([
      'request_review_final',
      'menu_get_help',
      'header_talk_to_david',
      'footer_start_plan_review'
    ])
  }),
  medicare_supplement_cost_lakeland: Object.freeze({
    page_role: 'education',
    cta_keys: new Set([
      'request_review_final',
      'menu_get_help',
      'header_talk_to_david',
      'footer_start_plan_review'
    ])
  }),
  medicare_vs_aca_central_florida_age_65: Object.freeze({
    page_role: 'education',
    cta_keys: new Set([
      'request_review_nav',
      'request_review_hero',
      'request_review_final',
      'menu_get_help',
      'header_talk_to_david',
      'footer_start_plan_review'
    ])
  }),
  turning_65_medicare_checklist_florida: Object.freeze({
    page_role: 'education',
    cta_keys: new Set([
      'request_review_nav',
      'request_review_final',
      'menu_get_help',
      'header_talk_to_david',
      'footer_start_plan_review'
    ])
  }),
  when_can_i_switch_medicare_plans_florida: Object.freeze({
    page_role: 'education',
    cta_keys: new Set([
      'request_review_final',
      'menu_get_help',
      'header_talk_to_david',
      'footer_start_plan_review'
    ])
  }),
  medicare_east_polk: Object.freeze({
    page_role: 'education',
    cta_keys: new Set([
      'request_review_nav',
      'request_review_hero',
      'request_review_final',
      'menu_get_help',
      'header_talk_to_david',
      'footer_start_plan_review'
    ])
  }),
  moving_florida_medicare: Object.freeze({
    page_role: 'education',
    cta_keys: new Set([
      'request_move_review',
      'request_related_review',
      'menu_get_help',
      'header_talk_to_david',
      'footer_start_plan_review'
    ])
  }),
  best_medicare_broker_lakeland_fl: Object.freeze({
    page_role: 'selection',
    cta_keys: new Set([
      'request_review_hero',
      'start_review_criteria',
      'request_help_final',
      'broker_help_nav',
      'see_review_process',
      'menu_get_help',
      'header_talk_to_david',
      'footer_start_plan_review'
    ])
  }),
  medicare_broker_lakeland_fl: Object.freeze({
    page_role: 'transaction',
    cta_keys: new Set([
      'request_review_hero',
      'request_review_verification',
      'request_review_final',
      'selection_guide_nav',
      'menu_get_help',
      'header_talk_to_david',
      'footer_start_plan_review'
    ])
  })
});
const MEDICARE_ATTRIBUTION_FIELDS = [
  'source_page_key',
  'source_page_role',
  'source_cta_key',
  'content_cluster'
];
const MEDICARE_GENERAL_INTAKE_EXCLUDED_FIELDS = new Set([
  'current_plan',
  'providers',
  'prescriptions',
  'provider_name',
  'provider_location',
  'prescription_name',
  'upcoming_procedures'
]);

// Mailchimp always uses confirmed opt-in. Sales-form contact permission is
// not marketing permission; lead sync requires consent_marketing_email=yes.
const FORM_MC_CONFIG = {
  'homepage-newsletter':           { status: 'pending',    tags: ['homepage', 'newsletter'] },
  'newsletter-signup':             { status: 'pending',    tags: ['newsletter', 'newsletter-page'] },
  'get-help':                      { status: 'pending', tags: ['lead', 'get-help'] },
  'lp-aca-lead':                   { status: 'pending', tags: ['aca', 'paid-ad'] },
  'lp-medicare-lead':              { status: 'pending', tags: ['medicare', 'paid-ad'] },
  'lp-gap-lead':                   { status: 'pending', tags: ['gap', 'paid-ad'] },
  'aca-lakeland-lead':             { status: 'pending', tags: ['aca', 'local-seo', 'lakeland'] },
  'tampa-health-insurance':        { status: 'pending', tags: ['aca', 'local-seo', 'tampa'] },
  'winter-haven-health-insurance': { status: 'pending', tags: ['aca', 'local-seo', 'winter-haven'] },
  'haines-city-health-insurance':  { status: 'pending', tags: ['aca', 'local-seo', 'haines-city'] },
  'lake-alfred-health-insurance':  { status: 'pending', tags: ['aca', 'local-seo', 'lake-alfred'] },
  'davenport-health-insurance':    { status: 'pending', tags: ['aca', 'local-seo', 'davenport'] },
  'brandon-health-insurance':      { status: 'pending', tags: ['aca', 'local-seo', 'brandon'] },
  'clearwater-health-insurance':   { status: 'pending', tags: ['aca', 'local-seo', 'clearwater'] },
  'largo-health-insurance':        { status: 'pending', tags: ['aca', 'local-seo', 'largo'] },
  'new-port-richey-health-insurance': { status: 'pending', tags: ['aca', 'local-seo', 'new-port-richey'] },
  'riverview-health-insurance':    { status: 'pending', tags: ['aca', 'local-seo', 'riverview'] },
  'st-petersburg-health-insurance': { status: 'pending', tags: ['aca', 'local-seo', 'st-petersburg'] },
  'wesley-chapel-health-insurance': { status: 'pending', tags: ['aca', 'local-seo', 'wesley-chapel'] },
  'subsidy-estimator-lead':        { status: 'pending', tags: ['aca', 'subsidy-estimator'] }
};

const INTENT_MC_TAGS = {
  'aca': ['intent-aca'],
  'medicare': ['intent-medicare'],
  'lost-coverage': ['intent-lost-coverage', 'sep-review'],
  'turning-26': ['intent-turning-26', 'sep-review'],
  'self-employed': ['intent-self-employed'],
  'current-client-review': ['intent-current-client-review', 'existing-client-service'],
  'provider-check': ['intent-provider-check', 'network-review'],
  'prescription-check': ['intent-prescription-check', 'rx-review'],
  'coverage-gap': ['intent-coverage-gap'],
  'employer-referral': ['intent-employer-referral', 'professional-referral'],
  'post-enrollment-review': ['intent-post-enrollment-review', 'existing-client-service']
};

const NEWSLETTER_FORMS = new Set(['homepage-newsletter', 'newsletter-signup']);

const BOT_FIELDS = ['bot-field', 'website', 'company'];
const CAMPAIGN_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const GET_HELP_OPTIONAL_FIELDS = [
  'who',
  'coverage_end',
  'cobra_status',
  'cobra_premium',
  'providers',
  'prescriptions',
  'primary_concern',
  'household_size',
  'income',
  'medicare_timing',
  'referral',
  'current_plan',
  'employer_coverage',
  'student_status',
  'tax_dependency',
  'business_type',
  'coverage_type',
  'review_reason',
  'household_changes',
  'income_changes',
  'upcoming_procedures',
  'billing_issue',
  'keep_current',
  'provider_name',
  'provider_location',
  'prescription_name',
  'plan_year',
  'organization',
  'contact_person',
  'affected_count',
  'coordination_method',
  'handoff_instructions',
  'service_reason',
  'effective_date',
  'notes'
];

function formFields(...groups) {
  return new Set(groups.flat());
}

const LOCAL_FORM_FIELDS = [
  'full_name',
  'phone_number',
  'zip_code',
  'coverage_type',
  'lead_source',
  'primary_provider',
  'source_page'
];
const LP_COMMON_FIELDS = [
  'full_name',
  'phone',
  'email',
  'zip_code',
  'best_time_to_reach',
  'coverage_status',
  'consent',
  'source_page'
];
const FORM_FIELD_ALLOWLIST = Object.freeze({
  'homepage-newsletter': formFields(BOT_FIELDS, ['email', 'consent', 'source_page', '_subject']),
  'newsletter-signup': formFields(BOT_FIELDS, ['first_name', 'last_name', 'email', 'phone', 'interest', 'consent', 'source_page', '_subject']),
  'get-help': formFields(BOT_FIELDS, CAMPAIGN_FIELDS, GET_HELP_OPTIONAL_FIELDS, [
    'full_name',
    'phone',
    'email',
    'zip_code',
    'inquiry_type',
    'normalized_intent',
    'line_of_business',
    'need_timing',
    'preferred_contact_method',
    'best_time_to_reach',
    'coverage_status',
    'product_interest',
    'plan_interest',
    'referral_page',
    'source_page',
    'source_page_key',
    'source_cta_key',
    'started_at',
    'human_check',
    '_subject',
    'consent_request',
    'consent_call',
    'consent_sms',
    'consent_email',
    'consent_marketing_email'
  ]),
  'lp-aca-lead': formFields(BOT_FIELDS, CAMPAIGN_FIELDS, LP_COMMON_FIELDS, ['household_size']),
  'lp-medicare-lead': formFields(BOT_FIELDS, CAMPAIGN_FIELDS, LP_COMMON_FIELDS, ['medicare_stage', 'age_timeline']),
  'lp-gap-lead': formFields(BOT_FIELDS, CAMPAIGN_FIELDS, LP_COMMON_FIELDS, ['coverage_situation']),
  'aca-lakeland-lead': formFields(BOT_FIELDS, LOCAL_FORM_FIELDS, ['income_range', 'employment_status']),
  'subsidy-estimator-lead': formFields(BOT_FIELDS, [
    'first_name',
    'email',
    'phone',
    'zip_code',
    'age',
    'annual_income',
    'household_size',
    'tobacco_use',
    'benchmark_premium',
    'expected_contribution',
    'estimated_monthly_subsidy',
    'estimated_annual_savings',
    'source_page',
    '_subject'
  ]),
  'tampa-health-insurance': formFields(BOT_FIELDS, LOCAL_FORM_FIELDS),
  'winter-haven-health-insurance': formFields(BOT_FIELDS, LOCAL_FORM_FIELDS),
  'haines-city-health-insurance': formFields(BOT_FIELDS, LOCAL_FORM_FIELDS),
  'lake-alfred-health-insurance': formFields(BOT_FIELDS, LOCAL_FORM_FIELDS),
  'davenport-health-insurance': formFields(BOT_FIELDS, LOCAL_FORM_FIELDS),
  'brandon-health-insurance': formFields(BOT_FIELDS, LOCAL_FORM_FIELDS),
  'clearwater-health-insurance': formFields(BOT_FIELDS, LOCAL_FORM_FIELDS),
  'largo-health-insurance': formFields(BOT_FIELDS, LOCAL_FORM_FIELDS),
  'new-port-richey-health-insurance': formFields(BOT_FIELDS, LOCAL_FORM_FIELDS),
  'riverview-health-insurance': formFields(BOT_FIELDS, LOCAL_FORM_FIELDS),
  'st-petersburg-health-insurance': formFields(BOT_FIELDS, LOCAL_FORM_FIELDS),
  'wesley-chapel-health-insurance': formFields(BOT_FIELDS, LOCAL_FORM_FIELDS)
});

function readCookieState(cookieHeader, name, maxValueLength = 128) {
  if (!cookieHeader) return { state: 'absent' };
  if (typeof cookieHeader !== 'string' || cookieHeader.length > 8192) return { state: 'invalid' };

  const prefix = `${name}=`;
  const matches = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix))
    .map((part) => part.slice(prefix.length));

  if (!matches.length) return { state: 'absent' };
  if (matches.length !== 1 || !matches[0] || matches[0].length > maxValueLength) return { state: 'invalid' };
  try {
    const value = decodeURIComponent(matches[0]);
    if (!value || /[\u0000-\u001f\u007f]/.test(value)) return { state: 'invalid' };
    return { state: 'value', value };
  } catch (_) {
    return { state: 'invalid' };
  }
}

function metaBrowserIdentifier(cookieHeader, name) {
  const maxLength = name === '_fbc' ? 320 : 96;
  const state = readCookieState(cookieHeader, name, maxLength);
  if (state.state !== 'value') return null;

  if (name === '_fbp') {
    return /^fb\.[12]\.\d{10,16}\.\d{5,32}$/.test(state.value) ? state.value : null;
  }
  if (name === '_fbc') {
    return /^fb\.[12]\.\d{10,16}\.[A-Za-z0-9_-]{20,256}$/.test(state.value) ? state.value : null;
  }
  return null;
}

function metaMeasurementAllowed(headers, cookieHeader) {
  const gpc = String(headerValue(headers, 'sec-gpc') || '').trim();
  const dnt = String(headerValue(headers, 'dnt') || '').trim().toLowerCase();
  if (gpc && gpc !== '0') return false;
  if (dnt && dnt !== '0' && dnt !== 'unspecified') return false;

  const legacyOptOut = readCookieState(cookieHeader, 'lhi_meta_audience_opt_out');
  if (legacyOptOut.state === 'invalid' || legacyOptOut.state === 'value') return false;

  const consent = readCookieState(cookieHeader, 'lhi_meta_audience_consent');
  return consent.state === 'value' && consent.value === 'granted';
}

function headerValue(headers, name) {
  if (!headers) return '';
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '';
}

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin.replace(/\/+$/, '');
  } catch (_) {
    return null;
  }
}

function corsPolicy(headers) {
  const responseHeaders = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
  const rawOrigin = String(headerValue(headers, 'origin') || '').trim();
  if (!rawOrigin) return { allowed: true, headers: responseHeaders };

  const origin = normalizeOrigin(rawOrigin);
  if (!origin || !LEAD_ALLOWED_ORIGINS.has(origin)) {
    return { allowed: false, headers: responseHeaders };
  }
  responseHeaders['Access-Control-Allow-Origin'] = origin;
  return { allowed: true, headers: responseHeaders };
}

function sanitizeSourcePath(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ''), FORMS_FORWARD_ORIGIN);
    const origin = normalizeOrigin(url.origin);
    if (origin && LEAD_ALLOWED_ORIGINS.has(origin)) {
      const pathname = url.pathname || '/';
      return pathname.startsWith('/') ? pathname : `/${pathname}`;
    }
  } catch (_) {}
  return '/';
}

function eventSourceUrl(sourcePath) {
  return `${FORMS_FORWARD_ORIGIN}${sanitizeSourcePath(sourcePath)}`;
}

function decodeRequestBody(event) {
  const encoded = String(event.body || '');
  const body = event.isBase64Encoded ? Buffer.from(encoded, 'base64').toString('utf8') : encoded;
  if (Buffer.byteLength(body, 'utf8') > MAX_JSON_BODY_BYTES) {
    return { ok: false, statusCode: 413, error: 'Request body too large' };
  }
  return { ok: true, body };
}

function resolveFormName(rawPayload) {
  const dashName = rawPayload['form-name'];
  const underscoreName = rawPayload.form_name;
  if (dashName != null && typeof dashName !== 'string') return null;
  if (underscoreName != null && typeof underscoreName !== 'string') return null;

  const first = String(dashName || '').trim();
  const second = String(underscoreName || '').trim();
  if (first && second && first !== second) return null;
  const formName = first || second;
  return Object.prototype.hasOwnProperty.call(FORM_FIELD_ALLOWLIST, formName) ? formName : null;
}

function filterPayloadForForm(rawPayload, formName) {
  const allowedFields = FORM_FIELD_ALLOWLIST[formName];
  if (!allowedFields) return { ok: false, error: 'Unsupported form' };

  const filtered = { 'form-name': formName };
  for (const field of allowedFields) {
    if (!Object.prototype.hasOwnProperty.call(rawPayload, field)) continue;
    const value = rawPayload[field];
    if (value == null) continue;
    if (!['string', 'number', 'boolean'].includes(typeof value)) {
      return { ok: false, error: 'Invalid form field type' };
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return { ok: false, error: 'Invalid form field value' };
    }
    if (String(value).length > MAX_FORM_FIELD_CHARS) {
      return { ok: false, error: 'Form field too large' };
    }
    filtered[field] = value;
  }
  return { ok: true, payload: filtered };
}

function sanitizeCampaignToken(value, allowSpaces = false) {
  const text = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text || text.length > 80) return '';
  // Google Ads suffixes prefix {campaignid} so platform IDs remain
  // distinguishable from untrusted phone-like numeric values.
  if (!allowSpaces && /^cid_\d{8,20}$/.test(text)) return text;
  if (/@|(?:\d[\s().-]*){7,}/.test(text)) return '';
  const pattern = allowSpaces
    ? /^[a-z0-9][a-z0-9 ._~+\-]*$/
    : /^[a-z0-9][a-z0-9._~-]*$/;
  return pattern.test(text) ? text : '';
}

function sanitizeCampaignAttribution(payload) {
  CAMPAIGN_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) return;
    const sanitized = sanitizeCampaignToken(payload[field], field === 'utm_term');
    if (sanitized) payload[field] = sanitized;
    else delete payload[field];
  });
  return payload;
}

function canonicalizeMedicareAttribution(payload) {
  const sourcePageKey = String(payload.source_page_key || '').trim();
  const sourceCtaKey = String(payload.source_cta_key || '').trim();
  MEDICARE_ATTRIBUTION_FIELDS.forEach((field) => delete payload[field]);

  if (payload['form-name'] !== 'get-help' || payload.normalized_intent !== 'medicare') return null;
  if (!Object.prototype.hasOwnProperty.call(MEDICARE_SOURCE_REGISTRY, sourcePageKey)) return null;
  const registered = MEDICARE_SOURCE_REGISTRY[sourcePageKey];
  if (!registered.cta_keys.has(sourceCtaKey)) return null;

  const canonical = {
    source_page_key: sourcePageKey,
    source_page_role: registered.page_role,
    source_cta_key: sourceCtaKey,
    content_cluster: MEDICARE_CONTENT_CLUSTER
  };
  Object.assign(payload, canonical);
  return canonical;
}

function minimizeGetHelpPayload(payload) {
  if (payload['form-name'] !== 'get-help' || payload.normalized_intent !== 'medicare') return payload;
  MEDICARE_GENERAL_INTAKE_EXCLUDED_FIELDS.forEach((field) => delete payload[field]);
  return payload;
}

function authorizeGetHelpConsent(payload, serverReceivedAt, consentPage) {
  if (payload['form-name'] !== 'get-help') return { ok: true };
  if (payload.consent_request !== 'yes') {
    return { ok: false, error: 'request consent is required' };
  }

  const hasPhone = Boolean(String(payload.phone || '').trim());
  const hasEmail = Boolean(String(payload.email || '').trim());
  const channelConsent = {
    call: payload.consent_call === 'yes' && hasPhone,
    sms: payload.consent_sms === 'yes' && hasPhone,
    email: payload.consent_email === 'yes' && hasEmail,
    marketing_email: payload.consent_marketing_email === 'yes' && hasEmail
  };

  ['call', 'sms', 'email', 'marketing_email'].forEach((channel) => {
    const field = `consent_${channel}`;
    if (channelConsent[channel]) payload[field] = 'yes';
    else delete payload[field];
  });
  Object.assign(payload, {
    consent_text_version: 'get-help-2026-07-30-v1',
    consent_recorded_at: serverReceivedAt,
    consent_page: sanitizeSourcePath(consentPage || '/get-help/'),
    consent_request_state: 'granted',
    consent_call_state: channelConsent.call ? 'granted' : 'not_granted',
    consent_sms_state: channelConsent.sms ? 'granted' : 'not_granted',
    consent_email_state: channelConsent.email ? 'granted' : 'not_granted',
    consent_marketing_email_state: channelConsent.marketing_email ? 'granted' : 'not_granted',
    consent_withdrawal_state: 'not_withdrawn_at_submission'
  });
  return { ok: true };
}

exports.handler = async (event) => {
  const headers = event.headers || {};
  const cors = corsPolicy(headers);
  if (!cors.allowed) {
    return { statusCode: 403, headers: cors.headers, body: 'Origin Not Allowed' };
  }
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors.headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors.headers, body: 'Method Not Allowed' };
  }

  const decodedBody = decodeRequestBody(event);
  if (!decodedBody.ok) {
    return {
      statusCode: decodedBody.statusCode,
      headers: { ...cors.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: decodedBody.error })
    };
  }

  let rawPayload;
  try {
    rawPayload = JSON.parse(decodedBody.body || '{}');
  } catch (_) {
    return { statusCode: 400, headers: cors.headers, body: 'Invalid JSON' };
  }

  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return {
      statusCode: 400,
      headers: { ...cors.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'JSON body must be an object' })
    };
  }

  const formName = resolveFormName(rawPayload);
  if (!formName) {
    return {
      statusCode: 400,
      headers: { ...cors.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Unsupported or ambiguous form' })
    };
  }

  const filteredPayload = filterPayloadForForm(rawPayload, formName);
  if (!filteredPayload.ok) {
    return {
      statusCode: 400,
      headers: { ...cors.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: filteredPayload.error })
    };
  }
  const payload = sanitizeCampaignAttribution(minimizeGetHelpPayload(filteredPayload.payload));

  const botCheck = checkBotSubmission(payload);
  if (!botCheck.ok) {
    return {
      statusCode: 422,
      headers: { ...cors.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: botCheck.error })
    };
  }

  const eventId = crypto.randomUUID();
  const serverReceivedAt = new Date().toISOString();
  const eventTime = Math.floor(Date.parse(serverReceivedAt) / 1000);
  const sourcePath = sanitizeSourcePath(
    rawPayload.source_url || headerValue(headers, 'referer') || headerValue(headers, 'referrer') || ''
  );

  const consentCheck = authorizeGetHelpConsent(payload, serverReceivedAt, sourcePath);
  if (!consentCheck.ok) {
    return {
      statusCode: 422,
      headers: { ...cors.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: consentCheck.error })
    };
  }

  const sourceUrl = eventSourceUrl(sourcePath);
  payload.source_url = sourcePath;
  if (payload.source_page != null) payload.source_page = sanitizeSourcePath(payload.source_page);
  if (payload.consent_page != null) payload.consent_page = sanitizeSourcePath(payload.consent_page);
  if (!['direct', 'internal', 'external'].includes(String(payload.referral_page || ''))) {
    delete payload.referral_page;
  }
  payload.event_id = eventId;
  payload.server_received_at = serverReceivedAt;
  const medicareAttribution = canonicalizeMedicareAttribution(payload);
  const isNewsletter = NEWSLETTER_FORMS.has(formName);
  const leadPriority = classifyLead(payload, formName);
  payload.lead_priority = leadPriority.level;
  payload.lead_priority_reason = leadPriority.reason;
  const cookieHeader = headers.cookie || '';
  const fbp = metaBrowserIdentifier(cookieHeader, '_fbp');
  const fbc = metaBrowserIdentifier(cookieHeader, '_fbc');

  // Netlify Forms is the acceptance boundary. No conversion or audience
  // integration runs until this forward succeeds.
  let formsOk = false;
  let formsError = null;
  let acceptedAt = null;
  try {
    if (formName) {
      const params = new URLSearchParams();
      params.set('form-name', formName);
      Object.keys(payload).forEach((k) => {
        if (k === 'form-name' || k === 'form_name' || k === 'content_name') return;
        const v = payload[k];
        if (v == null || v === '') return;
        params.set(k, String(v));
      });
      const siteUrl = `${FORMS_FORWARD_ORIGIN}/`;
      const res = await fetch(siteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      formsOk = res.ok;
      if (formsOk) acceptedAt = new Date().toISOString();
      if (!res.ok) {
        formsError = `Forms ${res.status}`;
        console.error(formsError);
      }
    } else {
      formsError = 'no form-name in payload';
    }
  } catch (e) {
    formsError = `Forms forward exception${e && e.name ? ` (${e.name})` : ''}`;
    console.error(formsError);
  }

  // Fire Meta Conversions API only after Netlify Forms accepted the request.
  let capiOk = false;
  let capiError = null;
  if (!formsOk) {
    capiError = 'CAPI skipped: Forms forward failed';
  } else if (isNewsletter) {
    capiError = 'CAPI skipped: newsletter subscriber is not a sales lead';
  } else if (!IS_PROD_CONTEXT) {
    capiError = `CAPI skipped: production context not confirmed (${NETLIFY_CONTEXT}/${SITE_ENV})`;
  } else if (!metaMeasurementAllowed(headers, cookieHeader)) {
    capiError = 'CAPI skipped: explicit Meta measurement consent unavailable';
  } else if (CONFIGURED_META_DATASET_ID === META_DATASET_ID && ACCESS_TOKEN) {
    try {
      const userData = {};
      if (fbp) userData.fbp = fbp;
      if (fbc) userData.fbc = fbc;

      const body = {
        data: [{
          event_name: 'Lead',
          event_time: eventTime,
          event_id: eventId,
          action_source: 'website',
          event_source_url: sourceUrl,
          user_data: userData,
          custom_data: {
            content_name: 'first_party_lead',
            currency: 'USD',
            value: 0
          }
        }]
      };
      if (TEST_EVENT_CODE) body.test_event_code = TEST_EVENT_CODE;

      const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_DATASET_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      capiOk = res.ok;
      if (!res.ok) {
        capiError = `CAPI ${res.status}`;
        console.error(capiError);
      }
    } catch (e) {
      capiError = `CAPI exception${e && e.name ? ` (${e.name})` : ''}`;
      console.error(capiError);
    }
  } else {
    capiError = 'Meta dataset configuration unavailable or mismatched';
    console.warn(capiError);
  }

  // Sync to Mailchimp only after Forms acceptance. It remains non-blocking so
  // a Mailchimp outage cannot turn an accepted request into a failed response.
  let mcOk = false;
  let mcError = null;
  if (formsOk) {
    try {
      const result = await syncToMailchimp(payload);
      mcOk = result.ok;
      if (result.error && !result.skipped) {
        mcError = result.error;
        console.error(mcError);
      }
    } catch (e) {
      mcError = `Mailchimp sync exception${e && e.name ? ` (${e.name})` : ''}`;
      console.error(mcError);
    }
  }

  let adsCapiOk = false;
  let adsCapiError = null;
  if (!formsOk) {
    adsCapiError = 'Ads CAPI skipped: Forms forward failed';
  } else if (isNewsletter) {
    adsCapiError = 'Ads CAPI skipped: newsletter subscriber is not a sales lead';
  } else {
    try {
      const result = await sendAdsLead({
        eventId,
        headers,
        cookieHeader,
        sourceUrl
      });
      adsCapiOk = result.ok;
      if (result.error) {
        adsCapiError = safeAdsError(result.error, result.skipped);
        if (!result.skipped) console.error(adsCapiError);
      }
    } catch (e) {
      adsCapiError = `Ads CAPI exception${e && e.name ? ` (${e.name})` : ''}`;
      console.error(adsCapiError);
    }
  }

  const responseBody = {
    event_id: eventId,
    server_received_at: serverReceivedAt,
    lead_priority: leadPriority.level,
    lead_priority_reason: leadPriority.reason,
    capi: capiOk,
    ads_capi: adsCapiOk,
    forms: formsOk,
    mailchimp: mcOk,
    ...(capiError ? { capi_error: capiError } : {}),
    ...(adsCapiError ? { ads_capi_error: adsCapiError } : {}),
    ...(formsError ? { forms_error: formsError } : {}),
    ...(mcError ? { mc_error: mcError } : {})
  };
  if (formsOk) {
    responseBody.accepted_at = acceptedAt;
    if (medicareAttribution) Object.assign(responseBody, medicareAttribution);
  }

  // PHI-free Forms-forward evidence. Netlify supplies the precise log time;
  // this record intentionally contains no payload, identity, IP, user agent,
  // location, contact, health, policy, provider, prescription, or free text.
  console.info(JSON.stringify({
    type: 'forms_forward_outcome_v1',
    event_id: eventId,
    day: new Date().toISOString().slice(0, 10),
    context: NETLIFY_CONTEXT,
    form: cleanLeadToken(formName) || 'unknown',
    outcome: formsOk ? 'accepted' : 'failed',
    components: {
      forms: formsOk,
      meta_capi: capiOk,
      ads_capi: adsCapiOk,
      mailchimp: mcOk
    }
  }));

  if (!formsOk) {
    return {
      statusCode: 502,
      headers: { ...cors.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'forms forward failed', ...responseBody })
    };
  }

  return {
    statusCode: 200,
    headers: { ...cors.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, ...responseBody })
  };
};

function checkBotSubmission(payload) {
  const formName = payload['form-name'] || payload.form_name || '';
  const trapFilled = ['bot-field', 'website', 'company'].some((key) => String(payload[key] || '').trim());
  if (trapFilled) return { ok: false, error: 'bot trap field filled' };

  if (formName !== 'get-help') return { ok: true };

  const startedAt = Number(payload.started_at);
  const humanCheck = String(payload.human_check || '');
  const expectedCheck = Buffer.from(`${payload.started_at}:lakeland-human`).toString('base64');
  const elapsedMs = Date.now() - startedAt;

  if (!Number.isFinite(startedAt) || humanCheck !== expectedCheck) {
    return { ok: false, error: 'human check failed' };
  }
  if (elapsedMs < 1200) {
    return { ok: false, error: 'submitted too quickly' };
  }
  if (elapsedMs > 2 * 60 * 60 * 1000) {
    return { ok: false, error: 'stale submission' };
  }

  return { ok: true };
}

function cleanLeadToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function hasContactPath(payload) {
  return Boolean(String(payload.phone || payload.phone_number || '').trim() && String(payload.zip || payload.zip_code || payload.postal_code || '').trim());
}

function classifyLead(payload, formName) {
  if (NEWSLETTER_FORMS.has(formName)) {
    return { level: 'subscriber', reason: 'newsletter_or_subscriber_form' };
  }

  const intent = cleanLeadToken(payload.normalized_intent || payload.inquiry_type || formName);
  const timing = cleanLeadToken(payload.need_timing || payload.coverage_situation || payload.medicare_timing || payload.age_timeline);
  const coverage = cleanLeadToken(payload.coverage_status || payload.current_plan || payload.coverage_type);
  const hasContact = hasContactPath(payload);

  if (intent === 'current_client_review' || intent === 'post_enrollment_review') {
    return { level: 'service', reason: intent };
  }

  const urgentSignals = new Set([
    'as_soon_as_possible',
    'within_30_days',
    'losing_coverage_soon',
    'currently_uninsured',
    'between_jobs',
    'already_65',
    'already_65_',
    'within_3_months'
  ]);

  const coverageSignals = new Set(['uninsured', 'cobra']);
  const intentSignals = new Set(['lost_coverage', 'coverage_gap', 'medicare']);

  if (hasContact && (urgentSignals.has(timing) || coverageSignals.has(coverage) || intentSignals.has(intent))) {
    return { level: 'high', reason: 'urgent_or_high_intent_with_contact_path' };
  }

  if (timing === 'just_researching' || timing === 'just_exploring') {
    return { level: 'research', reason: 'research_or_exploring_timing' };
  }

  if (hasContact && (intent || coverage)) {
    return { level: 'qualified', reason: 'complete_contact_with_routing_context' };
  }

  return { level: 'standard', reason: 'basic_lead_submission' };
}

async function syncToMailchimp(payload) {
  const formName = payload['form-name'] || payload.form_name || '';
  const isNewsletter = NEWSLETTER_FORMS.has(formName);
  if (!isNewsletter && payload.consent_marketing_email !== 'yes') {
    return { ok: false, skipped: true };
  }
  if (!MC_API_KEY || !MC_AUDIENCE_ID || !MC_SERVER) {
    return { ok: false, error: 'Mailchimp env vars not set (MAILCHIMP_API_KEY / MAILCHIMP_AUDIENCE_ID / MAILCHIMP_SERVER_PREFIX)' };
  }
  const email = payload.email && String(payload.email).trim();
  if (!email) return { ok: false, error: 'no email in payload' };

  const config = mailchimpConfigFor(payload, formName);

  // subscriber_hash is MD5 of lowercased email — used for upsert by email.
  const hash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
  const baseUrl = `https://${MC_SERVER}.api.mailchimp.com/3.0/lists/${MC_AUDIENCE_ID}/members/${hash}`;
  const auth = 'Basic ' + Buffer.from('any:' + MC_API_KEY).toString('base64');

  const mergeFields = {};
  if (payload.first_name) mergeFields.FNAME = payload.first_name;
  if (payload.last_name) mergeFields.LNAME = payload.last_name;
  if (payload.full_name && !payload.first_name) {
    const parts = String(payload.full_name).trim().split(/\s+/);
    if (parts[0]) mergeFields.FNAME = parts[0];
    if (parts.length > 1) mergeFields.LNAME = parts.slice(1).join(' ');
  }
  // New contacts remain pending until they confirm the marketing email opt-in.
  const upsertBody = { email_address: email, merge_fields: mergeFields };
  upsertBody.status_if_new = 'pending';

  try {
    const res = await fetch(baseUrl, {
      method: 'PUT',
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(upsertBody)
    });
    if (!res.ok) {
      return { ok: false, error: `MC upsert ${res.status}` };
    }
  } catch (e) {
    return { ok: false, error: `MC upsert exception${e && e.name ? ` (${e.name})` : ''}` };
  }

  // Tags via separate endpoint — this ADDS without clobbering existing tags.
  // (Tags inside the PUT body would replace the full tag list.)
  if (config.tags.length) {
    try {
      const tagBody = { tags: config.tags.map(name => ({ name, status: 'active' })) };
      const tagRes = await fetch(`${baseUrl}/tags`, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(tagBody)
      });
      if (!tagRes.ok) {
        return { ok: true, error: `MC tags ${tagRes.status}` };
      }
    } catch (e) {
      return { ok: true, error: `MC tags exception${e && e.name ? ` (${e.name})` : ''}` };
    }
  }

  return { ok: true };
}

function mailchimpConfigFor(payload, formName) {
  const base = FORM_MC_CONFIG[formName] || { status: 'pending', tags: ['unmapped', formName || 'unknown-form'] };
  const normalizedIntent = String(payload.normalized_intent || '').trim();
  const tags = new Set(base.tags);
  if (normalizedIntent && INTENT_MC_TAGS[normalizedIntent]) {
    INTENT_MC_TAGS[normalizedIntent].forEach(tag => tags.add(tag));
  }
  if (payload.line_of_business) tags.add(String(payload.line_of_business).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  if (payload.lead_priority) tags.add(`lead-priority-${String(payload.lead_priority).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`);
  if (normalizedIntent === 'current-client-review' || normalizedIntent === 'post-enrollment-review') {
    tags.delete('hot-lead');
    tags.add('service-request');
  }
  return { status: base.status, tags: Array.from(tags).filter(Boolean) };
}

function safeAdsError(error, skipped) {
  const text = String(error || '');
  if (skipped) {
    if (text.includes('non-production Netlify context')) return text;
    if (text.includes('OPENAI_ADS_PIXEL_ID or OPENAI_ADS_CAPI_KEY not set')) return text;
    return 'Ads CAPI skipped';
  }
  const status = text.match(/OpenAI Ads CAPI\s+(\d{3})/);
  return status ? `Ads CAPI ${status[1]}` : 'Ads CAPI delivery exception';
}

exports._test = {
  authorizeGetHelpConsent,
  canonicalizeMedicareAttribution,
  corsPolicy,
  decodeRequestBody,
  filterPayloadForForm,
  metaBrowserIdentifier,
  metaMeasurementAllowed,
  readCookieState,
  minimizeGetHelpPayload,
  resolveFormName,
  sanitizeCampaignAttribution,
  sanitizeCampaignToken,
  sanitizeSourcePath
};
