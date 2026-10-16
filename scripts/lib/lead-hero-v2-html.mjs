/**
 * Static HTML for unified lead form v2 (site mode). Matches qa mockup field names.
 */
import { OUT_OF_STATE_MEDICARE_NOTE } from './medicare-licensed-states.mjs';

const V2_CONSENT_VERSION = 'site-lead-v2-2026-11-v1';

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function hiddenAttributionFields(p, config) {
  return `<input type="hidden" name="form-name" value="${escapeAttr(config.formName)}">
        <input type="hidden" name="source_page" value="${escapeAttr(config.sourcePage)}">
        <input type="hidden" name="source_template" value="${escapeAttr(config.sourceTemplate)}">
        <input type="hidden" name="consent_text_version" value="${V2_CONSENT_VERSION}">
        <input type="hidden" name="line_of_business" value="">
        <input type="hidden" name="inquiry_type" value="">
        <input type="hidden" name="_subject" value="">
        <input type="hidden" name="source_page_key" value="${escapeAttr(config.sourcePageKey)}">
        <input type="hidden" name="source_cta_key" value="lead_form_v2_hero">
        <input type="hidden" name="utm_source" id="${p}_utm_source">
        <input type="hidden" name="utm_medium" id="${p}_utm_medium">
        <input type="hidden" name="utm_campaign" id="${p}_utm_campaign">
        <input type="hidden" name="utm_term" id="${p}_utm_term">
        <input type="hidden" name="utm_content" id="${p}_utm_content">
        <input type="hidden" name="gclid" id="${p}_gclid">
        <input type="hidden" name="gbraid" id="${p}_gbraid">
        <input type="hidden" name="wbraid" id="${p}_wbraid">
        <input type="hidden" name="gad_campaignid" id="${p}_gad_campaignid">
        <input type="hidden" name="first_gclid" id="${p}_first_gclid">
        <input type="hidden" name="first_gbraid" id="${p}_first_gbraid">
        <input type="hidden" name="first_wbraid" id="${p}_first_wbraid">
        <input type="hidden" name="first_gad_campaignid" id="${p}_first_gad_campaignid">
        <input type="hidden" name="lead_source" value="">
        <input type="hidden" name="lead_medium" value="">
        <input type="hidden" name="lead_campaign" value="">
        <input type="hidden" name="landing_page" value="">
        <input type="hidden" name="referrer" value="">
        <input type="hidden" name="click_id_type" value="">
        <input type="hidden" name="lead_channel" value="">
        <input type="hidden" name="click_timestamp" value="">
        <input type="hidden" name="started_at">
        <input type="hidden" name="human_check">`;
}

/**
 * @param {{
 *   formName: 'site-medicare-lead' | 'site-aca-lead',
 *   sourceTemplate: string,
 *   sourcePage: string,
 *   sourcePageKey: string,
 *   idPrefix: string,
 *   funnelName: string,
 *   preselect?: string,
 *   formTitle?: string,
 * }} config
 */
export function buildLeadFormV2Html(config) {
  const p = config.idPrefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'siteLead';
  const formTitle = config.formTitle || 'Get help choosing coverage';
  const preAttr = config.preselect ? ` data-lf2-preselect="${escapeAttr(config.preselect)}"` : '';
  const hidden = hiddenAttributionFields(p, config);

  return `<form class="lf2 lhi-lead-hero__form" id="${p}Form" name="${config.formName}" method="POST" action="/thanks.html" data-netlify="true" data-netlify-honeypot="bot-field" data-lhi-site-lead-form data-funnel-track data-funnel-event="Lead" data-funnel-name="${escapeAttr(config.funnelName)}" data-lf2-mode="site"${preAttr} aria-labelledby="${p}_lf2_title">
        ${hidden}
        <p class="lf2__hp" aria-hidden="true"><label>Do not fill this out: <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
        <div class="lf2__head"><h2 class="lf2__title" id="${p}_lf2_title">${escapeAttr(formTitle)}</h2><p class="lf2__sub">Three short steps with David Huff, licensed agent. A review is not enrollment.</p></div>
        <div class="lf2__progress" aria-live="polite"><p class="lf2__progress-label" data-lf2-progress-label><strong>Step 1 of 3</strong><span>What you need</span></p><div class="lf2__bar" aria-hidden="true"><span class="is-current"></span><span></span><span></span></div></div>
        <fieldset data-lf2-step="1" class="lf2__group is-active">
          <legend>What do you need help with?</legend>
          <div class="lf2__tiles lf2__tiles--grid">
            <label class="lf2__tile"><input type="radio" name="normalized_intent" value="medicare" required><span class="lf2__tile-ico" aria-hidden="true">65+</span><span class="lf2__tile-txt"><b>Medicare</b><small>Turning 65 or on Medicare</small></span></label>
            <label class="lf2__tile"><input type="radio" name="normalized_intent" value="under-65"><span class="lf2__tile-ico" aria-hidden="true">&lt;65</span><span class="lf2__tile-txt"><b>Under 65</b><small>Individual and family plans</small></span></label>
            <label class="lf2__tile"><input type="radio" name="normalized_intent" value="supplemental"><span class="lf2__tile-ico" aria-hidden="true">+</span><span class="lf2__tile-txt"><b>Supplemental</b><small>Accident, hospital, dental</small></span></label>
            <label class="lf2__tile"><input type="radio" name="normalized_intent" value="current-client-review"><span class="lf2__tile-ico" aria-hidden="true">&#10003;</span><span class="lf2__tile-txt"><b>Existing client</b><small>Review or service my plan</small></span></label>
          </div>
          <p class="lf2__err" role="alert"></p>
          <div class="lf2__actions"><button type="button" class="lf2__btn" data-lf2-next>Continue</button></div>
        </fieldset>
        <fieldset data-lf2-step="2">
          <div class="lf2__picked"><span>Helping with: <b data-lf2-picked></b></span><button type="button" data-lf2-change>Change</button></div>
          <legend>What is your ZIP code?</legend>
          <div class="lf2__field">
            <label for="${p}_zip">ZIP code where coverage will be used</label>
            <input class="lf2__zip" type="text" id="${p}_zip" name="zip_code" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{5}" maxlength="5" required aria-describedby="${p}_zip_err">
            <p class="lf2__err" id="${p}_zip_err" role="alert"></p>
          </div>
          <p class="lf2__note lf2__note--quiet" data-lf2-medicare-note data-lf2-show="medicare">${OUT_OF_STATE_MEDICARE_NOTE}</p>
          <div class="lf2__group" data-lf2-show="medicare"><p class="lf2__label">Which fits best? <span class="lf2__opt">(optional)</span></p><div class="lf2__chips"><label class="lf2__chip"><input type="radio" name="coverage_status" value="medicare_advantage"><span>Medicare Advantage</span></label><label class="lf2__chip"><input type="radio" name="coverage_status" value="medicare_supplement"><span>Medicare Supplement</span></label><label class="lf2__chip"><input type="radio" name="coverage_status" value="part_d"><span>Part D drug plan</span></label><label class="lf2__chip"><input type="radio" name="coverage_status" value="current_plan_review"><span>Review my plan</span></label><label class="lf2__chip"><input type="radio" name="coverage_status" value="not_sure"><span>Not sure</span></label></div></div>
          <div class="lf2__group" data-lf2-show="under-65"><p class="lf2__label">Who needs coverage? <span class="lf2__opt">(optional)</span></p><div class="lf2__chips"><label class="lf2__chip"><input type="radio" name="coverage_status" value="individual_marketplace"><span>Just me</span></label><label class="lf2__chip"><input type="radio" name="coverage_status" value="family_marketplace"><span>My family</span></label><label class="lf2__chip"><input type="radio" name="coverage_status" value="not_sure"><span>Not sure</span></label></div></div>
          <div class="lf2__group" data-lf2-show="supplemental"><p class="lf2__label">What are you interested in? <span class="lf2__opt">(optional)</span></p><div class="lf2__chips"><label class="lf2__chip"><input type="radio" name="coverage_status" value="supplemental_accident"><span>Accident</span></label><label class="lf2__chip"><input type="radio" name="coverage_status" value="supplemental_hospital"><span>Hospital stay</span></label><label class="lf2__chip"><input type="radio" name="coverage_status" value="supplemental_critical_illness"><span>Critical illness</span></label><label class="lf2__chip"><input type="radio" name="coverage_status" value="supplemental_dental_vision"><span>Dental or vision</span></label><label class="lf2__chip"><input type="radio" name="coverage_status" value="not_sure"><span>Not sure</span></label></div></div>
          <div class="lf2__group" data-lf2-show="current-client-review"><p class="lf2__label">What do you need? <span class="lf2__opt">(optional)</span></p><div class="lf2__chips"><label class="lf2__chip"><input type="radio" name="review_reason" value="renewal"><span>Annual renewal</span></label><label class="lf2__chip"><input type="radio" name="review_reason" value="doctor_rx_change"><span>Doctor or Rx change</span></label><label class="lf2__chip"><input type="radio" name="review_reason" value="household_income_change"><span>Household or income change</span></label><label class="lf2__chip"><input type="radio" name="review_reason" value="billing_id_card"><span>Billing or ID card</span></label></div></div>
          <div class="lf2__actions"><button type="button" class="lf2__back" data-lf2-back>Back</button><button type="button" class="lf2__btn" data-lf2-next>Continue</button></div>
        </fieldset>
        <fieldset data-lf2-step="3">
          <legend>How can David reach you?</legend>
          <div class="lf2__field">
            <label for="${p}_name">Full name</label>
            <input type="text" id="${p}_name" name="full_name" autocomplete="name" required aria-describedby="${p}_name_err">
            <p class="lf2__err" id="${p}_name_err" role="alert"></p>
          </div>
          <div class="lf2__row">
            <div class="lf2__field">
              <label for="${p}_phone">Phone</label>
              <input type="tel" id="${p}_phone" name="phone" autocomplete="tel" inputmode="tel" required aria-describedby="${p}_phone_err">
              <p class="lf2__err" id="${p}_phone_err" role="alert"></p>
            </div>
            <div class="lf2__field">
              <label for="${p}_email">Email <span class="lf2__opt">(optional)</span></label>
              <input type="email" id="${p}_email" name="email" autocomplete="email" aria-describedby="${p}_email_err">
              <p class="lf2__err" id="${p}_email_err" role="alert"></p>
            </div>
          </div>
          <div class="lf2__consent lf2__group" role="group" aria-labelledby="${p}_ch_lbl">
            <p class="lf2__label" id="${p}_ch_lbl">How may David contact you?</p><p class="lf2__hint">Choose at least one.</p>
            <div class="lf2__checks">
              <label class="lf2__check"><input type="checkbox" name="consent_call" value="yes" data-lf2-channel><span>I authorize a telephone call about this request.</span></label>
              <label class="lf2__check"><input type="checkbox" name="consent_sms" value="yes" data-lf2-channel><span>I authorize text messages about this request. Message frequency varies; message and data rates may apply. Reply STOP to cancel or HELP for help. See <a href="/sms-policy.html" target="_blank" rel="noopener noreferrer">SMS Terms</a>.</span></label>
              <label class="lf2__check"><input type="checkbox" name="consent_email" value="yes" data-lf2-channel><span>I authorize email about this request.</span></label>
            </div>
            <p class="lf2__err" role="alert"></p>
          </div>
          <div class="lf2__actions"><button type="button" class="lf2__back" data-lf2-back>Back</button><button type="submit" class="lf2__btn" name="consent_request" value="yes" data-lf2-submit>Send my request</button></div>
          <p class="lf2__fine">By sending, I am asking Lakeland Health Insurance to review and respond to this insurance request. I understand this is not an enrollment, eligibility determination, or proof of coverage. Consent is not a condition of purchase. See the <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
          <p class="lf2__status lhi-lead-hero__status" data-lhi-lead-status role="status" aria-live="polite"></p>
        </fieldset>
      </form>`;
}

const SUPPLEMENTAL_PREFIXES = [
  '/supplemental-insurance/',
  '/health-protector-guard',
  '/hospital-wise/',
  '/hospital-safeguard-gi/',
  '/critical-guard/',
  '/accident-wise/',
  '/advantage-guard/',
  '/dental-vision/'
];

const MEDICARE_HUB_PREFIXES = [
  '/medicare-broker-lakeland-fl/',
  '/medicare-part-d-lakeland-fl/',
  '/retiring-and-medicare-lakeland-fl/',
  '/working-past-65-medicare-lakeland-fl/',
  '/moving-florida-medicare/',
  '/health-insurance-broker-lakeland-fl/',
  '/provider-prescription-check/',
  '/quote/',
  '/coverage-center/',
  '/learning/',
  '/local-health-insurance-answers/'
];

export function inferPreselect(sourcePage, formName, relPath) {
  const path = sourcePage.endsWith('/') ? sourcePage : `${sourcePage}/`;
  if (path === '/current-client-review/') return 'current-client-review';
  if (SUPPLEMENTAL_PREFIXES.some((pre) => path.startsWith(pre))) return 'supplemental';
  if (formName === 'site-medicare-lead') return 'medicare';
  if (MEDICARE_HUB_PREFIXES.some((pre) => path.startsWith(pre))) return 'medicare';
  if (/\/blog\/[^/]*medicare/i.test(relPath)) return 'medicare';
  if (formName === 'site-aca-lead') {
    if (path.startsWith('/health-insurance-') && !path.includes('broker')) return 'under-65';
    return 'under-65';
  }
  return '';
}

export function sourcePageKeyFromPath(sourcePage) {
  if (sourcePage === '/') return 'homepage';
  return sourcePage.replace(/^\/|\/$/g, '').replace(/\//g, '_').replace(/-/g, '_') || 'site_page';
}

export function fixFunnelName(funnelName, formName) {
  if (formName === 'site-aca-lead' && funnelName.includes('medicare') && !funnelName.includes('aca')) {
    return funnelName.replace(/medicare/g, 'aca');
  }
  if (formName === 'site-medicare-lead' && funnelName.includes('_aca_')) {
    return funnelName.replace(/aca/g, 'medicare');
  }
  return funnelName;
}
