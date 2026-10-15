import { LICENSED_MEDICARE_STATES, OUT_OF_STATE_MEDICARE_NOTE } from './medicare-licensed-states.mjs';

/** Coverage values that trigger the nine-state Medicare scope note on mixed ACA lead forms. */
export const MEDICARE_LEAD_COVERAGE_VALUES = new Set([
  'medicare_advantage',
  'medicare_supplement',
  'part_d',
  'current_plan_review'
]);

export const MEDICARE_SCOPE_NOTE_MARKUP =
  `<p class="form-tpmo lhi-lead-hero__medicare-scope" id="outOfStateMedicareNote" hidden>${OUT_OF_STATE_MEDICARE_NOTE}</p>`;

export function isMedicareLeadCoverageValue(value) {
  return MEDICARE_LEAD_COVERAGE_VALUES.has(String(value || '').trim().toLowerCase());
}

export function isOutOfStateMedicareCoverageState(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (normalized.length !== 2) return false;
  return !Object.prototype.hasOwnProperty.call(LICENSED_MEDICARE_STATES, normalized);
}

/**
 * @param {string[]} optionValues - values from a coverage_status select (excluding empty/disabled placeholders)
 */
export function coverageSelectHasMixedMedicareAndMarketplace(optionValues) {
  let hasMedicare = false;
  let hasMarketplace = false;
  for (const raw of optionValues) {
    const value = String(raw || '').trim().toLowerCase();
    if (!value || value === 'not_sure') continue;
    if (isMedicareLeadCoverageValue(value)) hasMedicare = true;
    else hasMarketplace = true;
  }
  return hasMedicare && hasMarketplace;
}

/**
 * @param {{
 *   coverageValue: string,
 *   stateCode: string,
 *   hasMixedMedicareMarketplaceOptions: boolean,
 * }} input
 */
export function shouldShowOutOfStateMedicareNote(input) {
  if (!isOutOfStateMedicareCoverageState(input.stateCode)) return false;
  if (input.hasMixedMedicareMarketplaceOptions) {
    return isMedicareLeadCoverageValue(input.coverageValue);
  }
  return true;
}

const MEDICARE_OPTION_PATTERN =
  /value="(?:medicare_advantage|medicare_supplement|part_d|current_plan_review)"/;

/**
 * True when a site-aca-lead form block includes Medicare coverage choices in its select.
 * @param {string} formHtml
 */
export function acaLeadFormIncludesMedicareCoverageOptions(formHtml) {
  return MEDICARE_OPTION_PATTERN.test(String(formHtml || ''));
}

/**
 * Extract the site-aca-lead form HTML from a page, if present.
 * @param {string} pageHtml
 */
export function extractSiteAcaLeadFormHtml(pageHtml) {
  const html = String(pageHtml || '');
  const start = html.search(/<form\b[^>]*name="site-aca-lead"/i);
  if (start < 0) return '';
  const end = html.indexOf('</form>', start);
  if (end < 0) return '';
  return html.slice(start, end + '</form>'.length);
}
