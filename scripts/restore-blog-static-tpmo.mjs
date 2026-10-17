#!/usr/bin/env node
/**
 * Restore static bottom TPMO (10 orgs / 74 products + SHIP) on blog HTML pages.
 * Matches /medicare/ site-page-disclosures wording for no-JS crawlers.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const TPMO_SHIP =
  'We do not offer every plan available in your area. Currently we represent 10 organizations which offer 74 products in your area. Please contact www.medicare.gov or 1-800-MEDICARE, or your local State Health Insurance Program (SHIP) to get information on all of your options.';
const INVENTORY_NOTE =
  'Company inventory note: The counts above reflect the licensed company inventory for the 2027 plan year in the Lakeland/Polk County service area, confirmed for ZIP 33812, as of October 1, 2026. They are not CMS counts or statewide Florida totals. Counts and available products vary by ZIP code, service area, plan year, and current company authorization. Confirm the ZIP code and current approved platform inventory before relying on these figures. Plan availability, benefits, networks, formularies, pharmacies, and costs are subject to the applicable plan documents and service area.';

const BLOCK = `<section class="site-page-disclosures" aria-label="Legal and compliance disclaimers">
      <p class="tpmo-standard-disclaimer">${TPMO_SHIP}</p>
      <p class="tpmo-inventory-note">${INVENTORY_NOTE}</p>
</section>
`;

function insertBeforeFooter(html) {
  const footerIdx = html.search(/<footer[\s>]/i);
  if (footerIdx >= 0) return `${html.slice(0, footerIdx)}${BLOCK}${html.slice(footerIdx)}`;
  const mainClose = html.lastIndexOf('</main>');
  if (mainClose >= 0) return `${html.slice(0, mainClose)}${BLOCK}${html.slice(mainClose)}`;
  return `${html}${BLOCK}`;
}

let restored = 0;
let skipped = 0;

for (const name of readdirSync(join(ROOT, 'blog'))) {
  if (!name.endsWith('.html')) continue;
  const file = join(ROOT, 'blog', name);
  let html = readFileSync(file, 'utf8');
  if (/class="site-page-disclosures"/.test(html)) {
    skipped += 1;
    continue;
  }
  html = insertBeforeFooter(html);
  writeFileSync(file, html);
  restored += 1;
}

console.log(JSON.stringify({ restored, skipped, total: restored + skipped }, null, 2));
