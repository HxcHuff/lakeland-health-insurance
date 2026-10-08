#!/usr/bin/env node
/**
 * Move inline TPMO and compliance disclaimers to a single bottom block
 * (site-page-disclosures) just above the footer. Preserves exact wording.
 * Run: node scripts/consolidate-disclaimers-bottom.mjs --write
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');

const SKIP_DIRS = new Set([
  '.ai-worker-local',
  '.git',
  '.netlify',
  '.playwright-cli',
  '.playwright-mcp',
  'node_modules',
  'output',
  'search-engine-from-zip'
]);

const TPMO_OLD =
  'We do not offer every plan available in your area. Currently we represent 8 organizations which offer 65 products in your area. Please contact Medicare.gov or 1-800-MEDICARE to get information on all of your options.';
const TPMO_SHIP =
  'We do not offer every plan available in your area. Currently we represent 8 organizations which offer 65 products in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local State Health Insurance Program (SHIP) to get information on all of your options.';
const INVENTORY_NOTE =
  'Company inventory note: The counts above reflect the licensed company inventory for the 2027 plan year in the Lakeland/Polk County service area, confirmed for ZIP 33812, as of October 1, 2026. They are not CMS counts or statewide Florida totals. Counts and available products vary by ZIP code, service area, plan year, and current company authorization. Confirm the ZIP code and current approved platform inventory before relying on these figures. Plan availability, benefits, networks, formularies, pharmacies, and costs are subject to the applicable plan documents and service area.';

const TPMO_CTA_RE = /<p\b[^>]*\btpmo-cta-disclaimer\b[^>]*>[\s\S]*?<\/p>\s*/gi;
const INLINE_TPMO_STYLE_RE =
  /<p\b[^>]*style="[^"]*"[^>]*>\s*We do not offer every plan available in your area\. Currently we represent 8 organizations which offer 65 products[\s\S]*?<\/p>\s*/gi;
const DISCLOSURE_SECTION_RE =
  /<section\b[^>]*\baria-label="[^"]*(?:disclosure|Disclosure|Legal|compliance)[^"]*"[^>]*>[\s\S]*?<\/section>\s*/gi;
const DISCLOSURE_DIV_RE =
  /<div\b[^>]*\baria-label="[^"]*(?:disclosure|Disclosure|Legal|compliance)[^"]*"[^>]*>[\s\S]*?<\/div>\s*/gi;
const LP_CALL_NOTE_RE = /<p class="lp-call-note">[\s\S]*?<\/p>\s*/gi;
const DISCLOSURE_DIV_CLASS_RE = /<div class="disclosures">[\s\S]*?<\/div>\s*/gi;

function walkHtml(dir = ROOT, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (entry.endsWith('.html')) out.push(relative(ROOT, full).replace(/\\/g, '/'));
  }
  return out;
}

function stripHubTpmoDuplicates(html) {
  return html.replace(/<div class="hub-disclosures">([\s\S]*?)<\/div>/i, (_, inner) => {
    let next = inner;
    next = next.replace(/<p class="tpmo-standard-disclaimer">[\s\S]*?<\/p>\s*/gi, '');
    next = next.replace(/<p>\s*Company inventory note:[\s\S]*?<\/p>\s*/gi, '');
    return `<div class="hub-disclosures">${next}</div>`;
  });
}

function extractMatches(html, re) {
  const items = [];
  const copy = html;
  let m;
  const flags = re.flags.includes('g') ? re : new RegExp(re.source, re.flags + 'g');
  while ((m = flags.exec(copy)) !== null) items.push(m[0]);
  return items;
}

function insertBeforeFooter(html, block) {
  const footerIdx = html.search(/<footer[\s>]/i);
  if (footerIdx >= 0) return `${html.slice(0, footerIdx)}${block}${html.slice(footerIdx)}`;
  const mainClose = html.lastIndexOf('</main>');
  if (mainClose >= 0) return `${html.slice(0, mainClose)}${block}${html.slice(mainClose)}`;
  return `${html}${block}`;
}

function appendBeforeMainClose(html, block) {
  const idx = html.lastIndexOf('</main>');
  if (idx < 0) return insertBeforeFooter(html, block);
  return `${html.slice(0, idx)}${block}${html.slice(idx)}`;
}

function hasBottomDisclosureBlock(html) {
  return /class="site-page-disclosures"/.test(html) || /class="footer-tpmo"/.test(html);
}

function pageUsesShipTpmo(rel, html) {
  if (html.includes(TPMO_SHIP)) return true;
  return /^(medicare\/|medicare-|lp\/medicare\/|local-health-insurance-answers\/medicare)/.test(rel)
    || /\/blog\/[^/]*(medicare|medigap|aep-)/i.test(rel);
}

function moveFormTpmoToBottom(html) {
  const formTpmoRe =
    /(<p class="form-tpmo[^"]*" id="medicareTpmoDisclaimer">[\s\S]*?<\/p>\s*)(<p class="form-tpmo" id="floridaTpmoInventoryNote">[\s\S]*?<\/p>\s*)(<p class="form-tpmo" id="outOfStateMedicareNote"[^>]*>[\s\S]*?<\/p>\s*)?/i;
  const match = html.match(formTpmoRe);
  if (!match) return html;
  const chunk = match[0];
  const stripped = html.replace(formTpmoRe, '');
  const block = `
<section class="site-page-disclosures site-page-disclosures--get-help" aria-label="Legal and compliance disclaimers">
      ${chunk.trim()}
</section>
`;
  if (stripped.includes('site-page-disclosures--get-help')) return stripped;
  return insertBeforeFooter(stripped, block);
}

function processFile(rel) {
  let html = readFileSync(join(ROOT, rel), 'utf8');
  const before = html;

  if (rel === 'get-help/index.html') {
    html = moveFormTpmoToBottom(html);
  }

  const disclosureSections = [
    ...extractMatches(html, DISCLOSURE_SECTION_RE),
    ...extractMatches(html, DISCLOSURE_DIV_RE),
    ...extractMatches(html, DISCLOSURE_DIV_CLASS_RE)
  ];
  html = html.replace(DISCLOSURE_SECTION_RE, '');
  html = html.replace(DISCLOSURE_DIV_RE, '');
  html = html.replace(DISCLOSURE_DIV_CLASS_RE, '');
  html = html.replace(TPMO_CTA_RE, '');
  html = html.replace(INLINE_TPMO_STYLE_RE, '');
  html = stripHubTpmoDuplicates(html);

  const lpNotes = extractMatches(before, LP_CALL_NOTE_RE);
  html = html.replace(LP_CALL_NOTE_RE, '');

  const movedInner = disclosureSections
    .map((section) =>
      section
        .replace(/^[\s\S]*?<(?:section|div)[^>]*>/i, '')
        .replace(/<\/(?:section|div)>\s*$/i, '')
        .trim()
    )
    .filter(Boolean);

  for (const note of lpNotes) {
    movedInner.push(note.trim());
  }

  if (movedInner.length) {
    const existing = html.match(/<section class="site-page-disclosures[^"]*"[^>]*>([\s\S]*?)<\/section>/i);
    if (existing) {
      let combinedBody = `${existing[1].trim()}\n      ${movedInner.join('\n      ')}`;
      combinedBody = combinedBody.replace(
        /<p class="tpmo-standard-disclaimer">[\s\S]*?<\/p>\s*(?=.*<p class="tpmo-standard-disclaimer">)/gi,
        ''
      );
      combinedBody = combinedBody.replace(
        /<p class="tpmo-inventory-note">[\s\S]*?<\/p>\s*(?=.*Company inventory note:)/gi,
        ''
      );
      combinedBody = combinedBody.replace(/<p>\s*Company inventory note:[\s\S]*?<\/p>\s*(?=.*Company inventory note:)/gi, '');
      html = html.replace(
        /<section class="site-page-disclosures[^"]*"[^>]*>[\s\S]*?<\/section>/i,
        `<section class="site-page-disclosures" aria-label="Legal and compliance disclaimers">\n      ${combinedBody.trim()}\n</section>`
      );
    } else {
      const merged = `
<section class="site-page-disclosures" aria-label="Legal and compliance disclaimers">
      ${movedInner.join('\n      ')}
</section>
`;
      html = appendBeforeMainClose(html, merged);
    }
  }

  const needsTpmo =
    (before.includes(TPMO_OLD) || before.includes(TPMO_SHIP) || pageUsesShipTpmo(rel, before))
    && !/health-insurance-(alabama|arizona|georgia|iowa|indiana|louisiana|maryland|michigan|missouri|mississippi|north-carolina|nebraska|new-jersey|ohio|south-carolina|tennessee|texas|virginia|washington|west-virginia)\//.test(rel)
    && rel !== 'states/index.html';

  if (needsTpmo && !hasBottomDisclosureBlock(html)) {
    const tpmoText = before.includes(TPMO_SHIP) || pageUsesShipTpmo(rel, before) ? TPMO_SHIP : TPMO_OLD;
    const block = `
<section class="site-page-disclosures site-page-disclosures--tpmo" aria-label="Legal and compliance disclaimers">
      <p class="tpmo-standard-disclaimer">${tpmoText}</p>
      <p class="tpmo-inventory-note">${INVENTORY_NOTE}</p>
</section>
`;
    html = insertBeforeFooter(html, block);
  }

  if (html !== before) {
    if (WRITE) writeFileSync(join(ROOT, rel), html, 'utf8');
    return true;
  }
  return false;
}

const changed = [];
for (const rel of walkHtml()) {
  if (processFile(rel)) changed.push(rel);
}

console.log(JSON.stringify({ write: WRITE, pagesChanged: changed.length, files: changed }, null, 2));
