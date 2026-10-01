'use strict';

/**
 * Shared Google Ads click-ID and campaign sanitizers for website leads.
 * Valid IDs stay in their own fields. Nothing is guessed or fabricated.
 * Single-slot consumers should use selectPreferredClickId (gclid > gbraid > wbraid).
 */

const CLICK_ID_PRECEDENCE = Object.freeze(['gclid', 'gbraid', 'wbraid']);
const CLICK_ID_FIELDS = Object.freeze(['gclid', 'gbraid', 'wbraid', 'gad_campaignid']);
const CAMPAIGN_FIELDS = Object.freeze(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']);
const CURRENT_ATTRIBUTION_FIELDS = Object.freeze(CLICK_ID_FIELDS.concat(CAMPAIGN_FIELDS));
const FIRST_ATTRIBUTION_FIELDS = Object.freeze(
  CURRENT_ATTRIBUTION_FIELDS.map((field) => `first_${field}`)
);
const LEAD_ATTRIBUTION_FIELDS = Object.freeze(
  CURRENT_ATTRIBUTION_FIELDS.concat(FIRST_ATTRIBUTION_FIELDS)
);

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

function sanitizeClickID(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 512) return '';
  return /^[a-z0-9._~-]+$/i.test(text) ? text : '';
}

function sanitizeGoogleCampaignID(value) {
  const text = String(value || '').trim();
  return /^\d{1,20}$/.test(text) ? text : '';
}

function sanitizeAttributionValue(field, value) {
  const baseField = String(field || '').replace(/^first_/, '');
  if (baseField === 'gclid' || baseField === 'gbraid' || baseField === 'wbraid') {
    return sanitizeClickID(value);
  }
  if (baseField === 'gad_campaignid') return sanitizeGoogleCampaignID(value);
  return sanitizeCampaignToken(value, baseField === 'utm_term');
}

function sanitizeCampaignAttribution(payload) {
  LEAD_ATTRIBUTION_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) return;
    const sanitized = sanitizeAttributionValue(field, payload[field]);
    if (sanitized) payload[field] = sanitized;
    else delete payload[field];
  });
  return payload;
}

function selectPreferredClickId(payload, prefix = '') {
  if (!payload || typeof payload !== 'object') return null;
  for (const field of CLICK_ID_PRECEDENCE) {
    const value = payload[`${prefix}${field}`];
    if (value) return { field, value };
  }
  return null;
}

function hasValidatedClickId(payload) {
  return Boolean(selectPreferredClickId(payload, '') || selectPreferredClickId(payload, 'first_'));
}

function collectSanitizedClickIds(source) {
  const collected = {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return collected;
  for (const field of CLICK_ID_FIELDS) {
    for (const prefix of ['', 'first_']) {
      const name = `${prefix}${field}`;
      if (!Object.prototype.hasOwnProperty.call(source, name)) continue;
      const sanitized = sanitizeAttributionValue(name, source[name]);
      if (sanitized) collected[name] = sanitized;
    }
  }
  return collected;
}

function hubSpotClickAttribution(source, capturedAt) {
  const clicks = collectSanitizedClickIds(source);
  const preferred = selectPreferredClickId(clicks, '') || selectPreferredClickId(clicks, 'first_');
  const attribution = {
    lhi_attribution_status: preferred ? 'click_id_matched' : 'manual_review'
  };

  const gclid = clicks.gclid || clicks.first_gclid;
  const gbraid = clicks.gbraid || clicks.first_gbraid;
  const wbraid = clicks.wbraid || clicks.first_wbraid;
  const campaignId = clicks.gad_campaignid || clicks.first_gad_campaignid;
  if (gclid) attribution.lhi_gclid = gclid;
  if (gbraid) attribution.lhi_gbraid = gbraid;
  if (wbraid) attribution.lhi_wbraid = wbraid;
  if (campaignId) attribution.lhi_gad_campaign_id = campaignId;

  if (preferred) {
    attribution.lhi_lead_source = 'google_ads_site';
    const when = capturedAt && Number.isFinite(Date.parse(capturedAt))
      ? new Date(capturedAt).toISOString()
      : '';
    if (when) attribution.lhi_click_captured_at = when;
  }

  return Object.freeze({ clicks, preferred, attribution });
}

module.exports = {
  CAMPAIGN_FIELDS,
  CLICK_ID_FIELDS,
  CLICK_ID_PRECEDENCE,
  CURRENT_ATTRIBUTION_FIELDS,
  FIRST_ATTRIBUTION_FIELDS,
  LEAD_ATTRIBUTION_FIELDS,
  collectSanitizedClickIds,
  hasValidatedClickId,
  hubSpotClickAttribution,
  sanitizeAttributionValue,
  sanitizeCampaignAttribution,
  sanitizeCampaignToken,
  sanitizeClickID,
  sanitizeGoogleCampaignID,
  selectPreferredClickId
};
