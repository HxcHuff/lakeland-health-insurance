import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CURRENT_SEASON_DISCLAIMER = 'We do not offer every plan available in your area. Currently we represent 8 organizations which offer 65 products in your area. Please contact Medicare.gov or 1-800-MEDICARE to get information on all of your options.';
const MEDICARE_SHIP_DISCLAIMER = 'We do not offer every plan available in your area. Currently we represent 8 organizations which offer 65 products in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local State Health Insurance Program (SHIP) to get information on all of your options.';
const INVENTORY_NOTE = 'Company inventory note: The counts above reflect the licensed company inventory for the 2027 plan year in the Lakeland/Polk County service area, confirmed for ZIP 33812, as of October 1, 2026. They are not CMS counts or statewide Florida totals. Counts and available products vary by ZIP code, service area, plan year, and current company authorization. Confirm the ZIP code and current approved platform inventory before relying on these figures. Plan availability, benefits, networks, formularies, pharmacies, and costs are subject to the applicable plan documents and service area.';
const SUBJECT_TO_PLAN = 'Plan availability, benefits, networks, formularies, pharmacies, and costs are subject to the applicable plan documents and service area.';
const MEDICARE_SHIP_SURFACES = new Set([
  'blog/aep-2026-polk-county-checklist.html',
  'blog/florida-insurance-guide.html',
  'blog/how-to-read-health-insurance-card-guide.html',
  'blog/keep-doctor-switch-medicare-plans-florida.html',
  'blog/medicare-advantage-lakeland-2026.html',
  'blog/medicare-advantage-vs-medicare-supplement.html',
  'blog/medicare-for-dummies.html',
  'blog/medicare-supplement-cost-lakeland.html',
  'blog/medicare-vs-aca-central-florida-age-65.html',
  'blog/orlando-health-polk-county-expansion-2026.html',
  'blog/orlando-health-watson-clinic-insurance-2026.html',
  'blog/turning-65-medicare-checklist-florida.html',
  'blog/when-can-i-switch-medicare-plans-florida.html',
  'local-health-insurance-answers/medicare-plan-help-lakeland/index.html',
  'lp/medicare/index.html',
  'medicare-broker-lakeland-fl/index.html',
  'medicare/east-polk/index.html',
  'medicare/index.html',
  'moving-florida-medicare/index.html',
  'provider-prescription-check/index.html'
]);

const MEDICARE_MARKETING_SURFACES = [
  'about/index.html',
  'blog/aep-2026-polk-county-checklist.html',
  'blog/central-florida-health-insurance-competition.html',
  'blog/florida-insurance-guide.html',
  'blog/health-insurance-checkup-every-age.html',
  'blog/how-to-read-health-insurance-card-guide.html',
  'blog/index.html',
  'blog/keep-doctor-switch-medicare-plans-florida.html',
  'blog/medicare-advantage-lakeland-2026.html',
  'blog/medicare-advantage-vs-medicare-supplement.html',
  'blog/medicare-for-dummies.html',
  'blog/medicare-supplement-cost-lakeland.html',
  'blog/medicare-vs-aca-central-florida-age-65.html',
  'blog/orlando-health-lakeland-quality-approval-2026.html',
  'blog/orlando-health-polk-county-expansion-2026.html',
  'blog/orlando-health-watson-clinic-doctors-network-2026.html',
  'blog/orlando-health-watson-clinic-insurance-2026.html',
  'blog/turning-65-medicare-checklist-florida.html',
  'blog/when-can-i-switch-medicare-plans-florida.html',
  'blog/zip-code-health-insurance-pricing-florida.html',
  'carriers/index.html',
  'dental-vision/index.html',
  'index.html',
  'links/index.html',
  'local-health-insurance-answers/medicare-plan-help-lakeland/index.html',
  'local-health-insurance-answers/watson-clinic-insurance-network-help/index.html',
  'lp/medicare/index.html',
  'medicare-broker-lakeland-fl/index.html',
  'medicare/east-polk/index.html',
  'medicare/index.html',
  'moving-florida-medicare/index.html',
  'provider-prescription-check/index.html',
  'privacy-policy.html',
  'davenport-health-insurance/index.html',
  'haines-city-health-insurance/index.html',
  'lake-alfred-health-insurance/index.html',
  'winter-haven-health-insurance/index.html',
  'health-insurance-broker-lakeland-fl/index.html'
];

const SKIP_DIRS = new Set([
  '.ai-worker-local',
  '.git',
  '.netlify',
  'node_modules',
  'output',
  'search-engine-from-zip'
]);

function source(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function primaryHtmlFiles(directory = ROOT) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) files.push(...primaryHtmlFiles(join(directory, entry.name)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) files.push(join(directory, entry.name));
  }
  return files;
}

test('current-season TPMO wording is exact, contextualized, subject to plan, and rendered inside main', () => {
  for (const relativePath of MEDICARE_MARKETING_SURFACES) {
    const html = source(relativePath);
    const expectedDisclaimer = MEDICARE_SHIP_SURFACES.has(relativePath)
      ? MEDICARE_SHIP_DISCLAIMER
      : CURRENT_SEASON_DISCLAIMER;
    const disclaimerAt = html.indexOf(expectedDisclaimer);
    const mainEndsAt = html.lastIndexOf('</main>');

    assert.ok(disclaimerAt >= 0, `${relativePath} includes the exact current-season disclaimer`);
    assert.ok(mainEndsAt > disclaimerAt, `${relativePath} renders the disclaimer inside main content`);
    if (relativePath === 'privacy-policy.html') {
      assert.ok(html.includes('Company inventory note:'), `${relativePath} keeps the existing inventory note`);
    } else {
      assert.ok(html.includes(INVENTORY_NOTE), `${relativePath} keeps the inventory note without vendor attribution`);
    }
    assert.ok(html.includes(SUBJECT_TO_PLAN), `${relativePath} makes availability and benefits subject to plan documents`);
  }
});

test('TPMO is in the sitewide footer, beside Medicare CTAs, and on the Get Help Medicare form', () => {
  const footer = source('js/site-template.js');
  const getHelp = source('get-help/index.html');
  const medicare = source('medicare/index.html');
  const coverageCenter = source('coverage-center/index.html');

  assert.match(footer, /class="footer-tpmo"/);
  assert.ok(footer.includes(CURRENT_SEASON_DISCLAIMER), 'sitewide footer keeps the non-SHIP TPMO text for mixed pages');
  assert.ok(footer.includes(MEDICARE_SHIP_DISCLAIMER), 'Medicare footer path uses the approved SHIP TPMO text');
  assert.doesNotMatch(footer, /createElement\('a'\);\s*messenger/);
  assert.match(getHelp, /class="form-tpmo tpmo-cta-disclaimer"/);
  assert.ok(getHelp.includes(MEDICARE_SHIP_DISCLAIMER), 'Get Help shows the SHIP TPMO text beside the Medicare form');
  assert.ok(getHelp.includes(CURRENT_SEASON_DISCLAIMER), 'Get Help keeps the non-SHIP TPMO text in the mixed footer');
  assert.match(getHelp, /Start my request/);
  assert.match(getHelp, /Call \(863\) 640-3102/);
  assert.match(getHelp, /\(863\) 640-3102/);
  assert.doesNotMatch(getHelp, /href="\/coverage-center\/">Coverage Center<\/a>/);
  assert.ok(medicare.includes('class="tpmo-cta-disclaimer"'), 'Medicare hub keeps TPMO in view of CTAs');
  assert.ok(coverageCenter.includes('class="tpmo-cta-disclaimer"'), 'Coverage Center keeps TPMO in view of Medicare CTAs');
});

test('primary HTML excludes superseded disclaimer variants and known unsupported Medicare claims', () => {
  const forbidden = /Currently we represent organizations that offer products|Any information (?:we provide|provided) is limited|State Health Insurance Assistance Program \(SHIP\)|VERIFICATION REQUIRED BEFORE RELEASE|\$2,870|3–8%|four windows|usually 60|15-minute Medicare review/i;

  for (const file of primaryHtmlFiles()) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), forbidden, `${file.slice(ROOT.length + 1)} excludes stale wording`);
  }
});

test('Medicare hub is a current-season, privacy-minimized, keyboard-accessible lead router', () => {
  const html = source('medicare/index.html');
  const css = source('css/answer-pages.css');
  const forms = html.match(/<form\b[\s\S]*?<\/form>/gi) || [];

  assert.match(html, /<body[^>]*>\s*<a class="hub-skip-link" href="#medicare-content">/);
  assert.match(html, /<main class="medicare-hub" id="medicare-content">/);
  assert.match(html, /Official 2027 plan details are available to compare beginning October 1, 2026/);
  assert.match(html, /An Annual Enrollment request cannot be submitted before October 15/);
  assert.match(html, /2026-06600/);
  assert.doesNotMatch(html, /Prepare now\. Compare official 2027 plan details beginning October 1/);
  assert.doesNotMatch(html, /current official plan data beginning October 1/);
  assert.match(html, /class="hub-scenario-shortcut" href="#start"/);
  assert.match(html, /class="btn secondary hub-provider-link"/);
  assert.equal(forms.length, 1, 'Medicare hub exposes one controlled lead form');
  assert.match(forms[0], /class="sitelink-lead-form"/);
  assert.match(forms[0], /name="normalized_intent" value="medicare"/);
  assert.match(forms[0], /name="consent_request" value="yes" required/);
  assert.doesNotMatch(forms[0], /<textarea|name="(?:notes|providers|prescriptions|current_plan|policy_number|medicare_number)"/i);
  assert.match(forms[0], /Do not enter a Medicare number, Social Security number, medical details, policy numbers, or payment information/);
  assert.doesNotMatch(html, /Compare 2026 Medicare Plans/i);
  assert.match(css, /\.hub-skip-link:focus\s*{[^}]*transform:\s*translateY\(0\)/s);
  assert.match(css, /\.hub-scenario-shortcut\s*{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.hub-disclosures \.tpmo-standard-disclaimer\s*{[^}]*font-size:\s*1rem/s);
  assert.match(html, /answer-pages\.css\?v=20260930-medicare-hero-contrast/);
  assert.match(css, /\.answer-hero\.medicare-hero \.tpmo-cta-disclaimer\s*{[^}]*color:\s*var\(--navy/s);
  assert.match(css, /\.answer-hero\.medicare-hero a:not\(\.btn\):not\(\.hero-cta\):not\(\.lp-primary-call\)\s*{[^}]*color:\s*var\(--hub-blue/s);
  assert.match(css, /\.medicare-hero\s*{[^}]*padding:\s*160px 24px 72px/s);
});

test('get-help step navigation moves focus after user-triggered transitions only', () => {
  const html = source('get-help/index.html');
  const script = source('js/get-help-intake.js');
  const focusableStepHeadings = html.match(/<h2[^>]*tabindex="-1"[^>]*>/g) || [];

  assert.equal(focusableStepHeadings.length, 3);
  assert.match(html, /\.form-step h2:focus-visible\s*{/);
  assert.match(script, /showStep\(1, false\)/);
  assert.match(script, /showStep\(Math\.min\(3, step \+ 1\), true\)/);
  assert.match(script, /showStep\(Math\.max\(1, currentStep\(\) - 1\), true\)/);
});

test('Medigap and switching guides retain only verified current factual anchors', () => {
  const medigap = source('blog/medicare-supplement-cost-lakeland.html');
  const switching = source('blog/when-can-i-switch-medicare-plans-florida.html');

  assert.match(medigap, /2026 high deductible is <strong>\$2,950<\/strong>/);
  assert.doesNotMatch(medigap, /\$\d{2,3}\s*(?:-|–|to)\s*\$\d{2,3}/);
  assert.doesNotMatch(medigap, /A\.M\. Best|household discount|rate increase/i);
  assert.match(switching, /Special Enrollment Period/);
  assert.match(switching, /Medigap Open Enrollment Period/);
  assert.match(switching, /October 15 to December 7/);
  assert.match(switching, /This list is not exhaustive/);
  assert.match(switching, /Depend on the event/);
  assert.doesNotMatch(switching, /Special Enrollment Period[^.]{0,80}60 days/i);
});

test('Medicare basics uses the proper names for Medicare enrollment periods', () => {
  const html = source('blog/medicare-for-dummies.html');

  assert.doesNotMatch(html, /\btiming\b/i);
  assert.match(html, /<h2 id="enrollment-periods">Medicare enrollment periods<\/h2>/);
  assert.doesNotMatch(html, /when (?:to|you can) sign up (?:for Medicare )?or change coverage/i);
  assert.match(html, /<h3>Initial Enrollment Period<\/h3>/);
  assert.match(html, /<h3>Annual Enrollment Period<\/h3>/);
  assert.match(html, /<h3>Medicare Advantage Open Enrollment<\/h3>/);
  assert.match(html, /<h3>Special Enrollment Periods<\/h3>/);
  assert.match(html, /October 15–December 7/);
  assert.match(html, /January 1–March 31/);
});

test('provider-check routing and rewritten Medicare sitemap dates are canonical', () => {
  const watson = source('local-health-insurance-answers/watson-clinic-insurance-network-help/index.html');
  const sitemap = source('sitemap.xml');

  assert.match(watson, /href="\/get-help\/\?intent=provider-check">Start a provider check<\/a>/);
  assert.doesNotMatch(watson, /intent=provider-prescription(?:["&])/);
  assert.match(sitemap, /<loc>https:\/\/lakelandhealthinsurance\.com\/blog\/when-can-i-switch-medicare-plans-florida\.html<\/loc>\s*<lastmod>2026-10-07<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/lakelandhealthinsurance\.com\/blog\/medicare-supplement-cost-lakeland\.html<\/loc>\s*<lastmod>2026-10-07<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/lakelandhealthinsurance\.com\/provider-prescription-check\/<\/loc>\s*<lastmod>2026-10-07<\/lastmod>/);
});

test('privacy policy uses current-season SOA wording without treating expired 2026 exceptions as current', () => {
  const html = source('privacy-policy.html');

  assert.match(html, /must agree upon and record a Scope of Appointment with the beneficiary before the appointment/);
  assert.match(html, /eliminated the 48-hour waiting period/);
  assert.match(html, /eliminated the two exceptions to that waiting period/);
  assert.match(html, /last four days of a valid election period/);
  assert.match(html, /unscheduled in-person meeting initiated by the beneficiary/);
  assert.match(html, /must be in writing for an in-person personal marketing appointment/);
  assert.match(html, /minimum of 6 years/);
  assert.match(html, /complete and accurate transcript/);
  assert.match(html, /10-year retention requirement/);
  assert.match(html, /2026-06600/);
  assert.doesNotMatch(html, /48 hours before/);
  assert.doesNotMatch(html, /Through September 30, 2026, the 48-hour waiting period has two CMS exceptions/);
  assert.doesNotMatch(html, /Under the CMS requirements in effect through September 30, 2026/);
  assert.match(html, /retained for the period required by current CMS rules/);
  assert.doesNotMatch(html, /healthmarkets/i);
  assert.match(html, /mailto:david@lakelandhealthinsurance\.com\?subject=Privacy%20Request/);
  assert.doesNotMatch(html, /dhuff@/);
});

test('privacy policy describes homepage and newsletter-page sign-up without naming Mailchimp', () => {
  const html = source('privacy-policy.html');
  const sitemap = source('sitemap.xml');

  assert.match(html, /Every commercial newsletter issue includes an unsubscribe link/);
  assert.match(html, /transactional double-opt-in message/);
  assert.doesNotMatch(html, /Mailchimp/);
  assert.match(html, /"dateModified": "2026-10-06"/);
  assert.match(html, /Last updated <time datetime="2026-10-06">October 6, 2026<\/time>/);
  assert.match(
    sitemap,
    /<loc>https:\/\/lakelandhealthinsurance\.com\/privacy-policy\.html<\/loc>\s*<lastmod>2026-10-06<\/lastmod>/
  );
});
