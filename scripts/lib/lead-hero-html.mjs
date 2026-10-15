/**
 * Static HTML for the lhi-lead-hero Netlify lead block (site-medicare-lead / site-aca-lead).
 */
import { OUT_OF_STATE_MEDICARE_NOTE } from './medicare-licensed-states.mjs';

const MEDICARE_COVERAGE_OPTIONS = `
                  <option value="" selected disabled>Select one</option>
                  <option value="medicare_advantage">Medicare Advantage</option>
                  <option value="medicare_supplement">Medicare Supplement</option>
                  <option value="part_d">Part D prescription drug coverage</option>
                  <option value="current_plan_review">Current Medicare plan review</option>
                  <option value="not_sure">Not sure yet</option>`;

const ACA_COVERAGE_OPTIONS = `
                  <option value="" selected disabled>Select one</option>
                  <option value="individual_marketplace">Individual Marketplace coverage</option>
                  <option value="family_marketplace">Family Marketplace coverage</option>
                  <option value="not_sure">Not sure yet</option>`;

const MEDICARE_CONSENT =
  'By checking this box, I give my prior express written consent for Lakeland Health Insurance (David Huff, licensed insurance agent) to contact me about my Medicare request, including marketing calls and text messages, at the phone number I provided, which may be sent using an automated system for the selection or dialing of telephone numbers. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. See <a href="/sms-policy.html" target="_blank" rel="noopener noreferrer">SMS Terms</a> and <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.';

const ACA_CONSENT =
  'By checking this box, I give my prior express written consent for Lakeland Health Insurance (David Huff, licensed insurance agent) to contact me about my insurance request, including marketing calls and text messages, at the phone number I provided, which may be sent using an automated system for the selection or dialing of telephone numbers. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. See <a href="/sms-policy.html" target="_blank" rel="noopener noreferrer">SMS Terms</a> and <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.';

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * @param {{
 *   variant: 'medicare' | 'aca',
 *   formName: 'site-medicare-lead' | 'site-aca-lead',
 *   sourceTemplate: string,
 *   sourcePage: string,
 *   idPrefix: string,
 *   headline?: string,
 *   buttonText?: string,
 *   funnelName: string,
 * }} config
 */
export function buildLeadHeroHtml(config) {
  const isMedicare = config.variant === 'medicare';
  const consentVersion = isMedicare ? 'site-medicare-2026-10-v1' : 'site-aca-2026-10-v1';
  const defaultHeadline = isMedicare
    ? 'Request a Medicare plan review'
    : 'Get a Marketplace plan comparison';
  const defaultButton = isMedicare ? 'Request my Medicare review' : 'Get my quote';
  const headline = config.headline || defaultHeadline;
  const buttonText = config.buttonText || defaultButton;
  const p = config.idPrefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'siteLead';
  const coverageOptions = isMedicare ? MEDICARE_COVERAGE_OPTIONS : ACA_COVERAGE_OPTIONS;
  const consentCopy = isMedicare ? MEDICARE_CONSENT : ACA_CONSENT;

  return `
<section class="lhi-lead-hero" id="lhi-lead-hero" data-variant="${config.variant}" data-form-name="${config.formName}" data-source-template="${escapeAttr(config.sourceTemplate)}" aria-labelledby="${p}-lead-title">
  <div class="lhi-lead-hero__grid">
    <div class="lhi-lead-hero__intro">
      <h2 class="lhi-lead-hero__title" id="${p}-lead-title">${escapeAttr(headline)}</h2>
      <p class="lhi-lead-hero__note">Share a few details and David Huff, licensed Florida health agent, will follow up. This is not enrollment.</p>
    </div>
    <div class="lhi-lead-hero__card" id="lhi-site-lead-form">
      <form class="lhi-lead-hero__form" name="${config.formName}" method="POST" action="/thanks.html" data-netlify="true" data-netlify-honeypot="bot-field" id="${p}Form" data-lhi-site-lead-form data-funnel-track data-funnel-event="Lead" data-funnel-name="${escapeAttr(config.funnelName)}" aria-label="${escapeAttr(headline)}">
        <input type="hidden" name="form-name" value="${config.formName}">
        <input type="hidden" name="source_page" value="${escapeAttr(config.sourcePage)}">
        <input type="hidden" name="source_template" value="${escapeAttr(config.sourceTemplate)}">
        <input type="hidden" name="consent_text_version" value="${consentVersion}">
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
        <input type="hidden" name="human_check">
        <p class="lhi-lead-hero__honeypot" hidden><label>Do not fill this out: <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
        <div class="lhi-lead-hero__fields">
          <div class="lhi-lead-hero__field lhi-lead-hero__field--full">
            <label for="${p}_full_name">Name</label>
            <input type="text" id="${p}_full_name" name="full_name" required autocomplete="name">
          </div>
          <div class="lhi-lead-hero__field">
            <label for="${p}_phone">Phone</label>
            <input type="tel" id="${p}_phone" name="phone" required autocomplete="tel">
          </div>
          <div class="lhi-lead-hero__field">
            <label for="${p}_zip_code">ZIP code</label>
            <input type="text" id="${p}_zip_code" name="zip_code" required pattern="[0-9]{5}" maxlength="5" inputmode="numeric" autocomplete="postal-code">
          </div>
          <div class="lhi-lead-hero__field lhi-lead-hero__field--full">
            <label for="${p}_coverage_status">Coverage type</label>
            <select id="${p}_coverage_status" name="coverage_status" required>${coverageOptions}
            </select>
          </div>
          <div class="lhi-lead-hero__field lhi-lead-hero__field--full">
            <label class="lhi-lead-hero__consent" for="${p}_consent">
              <input type="checkbox" id="${p}_consent" name="consent" value="yes">
              <span>${consentCopy}</span>
            </label>
          </div>
          <div class="lhi-lead-hero__field lhi-lead-hero__field--full">
            <button class="lhi-lead-hero__submit" type="submit">${escapeAttr(buttonText)}</button>
          </div>
        </div>${
          isMedicare
            ? `
        <p class="form-tpmo lhi-lead-hero__medicare-scope" id="outOfStateMedicareNote" hidden>${OUT_OF_STATE_MEDICARE_NOTE}</p>`
            : ''
        }
        <p class="lhi-lead-hero__status" data-lhi-lead-status role="status" aria-live="polite"></p>
      </form>
    </div>
  </div>
</section>`;
}
