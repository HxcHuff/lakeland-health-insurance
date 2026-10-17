import assert from 'node:assert/strict';

export const TPMO_INVENTORY = '10 organizations which offer 74 products';
export const TPMO_MEDICARE_LINK = 'href="https://www.medicare.gov"';
export const TPMO_SHIP_PHRASE = 'State Health Insurance Program (SHIP)';

/** Matches static HTML TPMO with linked www.medicare.gov (Oct 2026 10/74 update). */
export const TPMO_HTML_REGEX =
  /We do not offer every plan available in your area\. Currently we represent 10 organizations which offer 74 products in your area\. Please contact <a href="https:\/\/www\.medicare\.gov"[^>]*>www\.medicare\.gov<\/a> or 1-800-MEDICARE, or your local State Health Insurance Program \(SHIP\) to get information on all of your options\./;

export function assertApprovedStaticTpmo(html, label) {
  assert.ok(html.includes(TPMO_INVENTORY), `${label} keeps 10/74 inventory wording`);
  assert.ok(html.includes(TPMO_MEDICARE_LINK), `${label} links www.medicare.gov`);
  assert.ok(html.includes(TPMO_SHIP_PHRASE), `${label} includes SHIP wording`);
  assert.match(html, TPMO_HTML_REGEX, `${label} uses the approved linked TPMO sentence`);
}
