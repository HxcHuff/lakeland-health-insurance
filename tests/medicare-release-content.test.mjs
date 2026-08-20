import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CURRENT_SEASON_DISCLAIMER = 'We do not offer every plan available in your area. Currently we represent 10 organizations which offer 73 products in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local State Health Insurance Program to get information on all of your options.';
const INVENTORY_NOTE = 'Company inventory note: HealthMarkets/Connecture displayed 10 organizations and 73 products for the selected 2026 Lakeland/Polk County service area on August 17, 2026.';
const SUBJECT_TO_PLAN = 'Plan availability, benefits, networks, formularies, pharmacies, and costs are subject to the applicable plan documents and service area.';

const MEDICARE_MARKETING_SURFACES = [
  'about/index.html',
  'best-medicare-broker-lakeland-fl/index.html',
  'blog/aep-2026-polk-county-checklist.html',
  'blog/central-florida-health-insurance-competition.html',
  'blog/florida-insurance-guide.html',
  'blog/health-insurance-checkup-every-age.html',
  'blog/how-to-read-health-insurance-card-guide.html',
  'blog/index.html',
  'blog/keep-doctor-switch-medicare-plans-florida.html',
  'blog/medicare-advantage-lakeland-2026.html',
  'blog/medicare-advantage-vs-supplement.html',
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
  'privacy-policy.html'
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
    const disclaimerAt = html.indexOf(CURRENT_SEASON_DISCLAIMER);
    const mainEndsAt = html.lastIndexOf('</main>');

    assert.ok(disclaimerAt >= 0, `${relativePath} includes the exact current-season disclaimer`);
    assert.ok(mainEndsAt > disclaimerAt, `${relativePath} renders the disclaimer inside main content`);
    assert.ok(html.includes(INVENTORY_NOTE), `${relativePath} identifies the Connecture count's service-area evidence`);
    assert.ok(html.includes(SUBJECT_TO_PLAN), `${relativePath} makes availability and benefits subject to plan documents`);
    assert.equal(html.indexOf(CURRENT_SEASON_DISCLAIMER, disclaimerAt + 1), -1, `${relativePath} contains one standardized disclaimer`);
  }
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
  assert.match(html, /Compare official 2027 plan details beginning October 1/);
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
  assert.match(switching, /Special Enrollment Periods are event-specific/);
  assert.match(switching, /a generic 60-day deadline should not be used/);
  assert.match(switching, /Medigap is different — there's no single annual window/);
});

test('provider-check routing and rewritten Medicare sitemap dates are canonical', () => {
  const watson = source('local-health-insurance-answers/watson-clinic-insurance-network-help/index.html');
  const sitemap = source('sitemap.xml');

  assert.match(watson, /href="\/get-help\/\?intent=provider-check">Start a provider check<\/a>/);
  assert.doesNotMatch(watson, /intent=provider-prescription(?:["&])/);
  assert.match(sitemap, /<loc>https:\/\/lakelandhealthinsurance\.com\/blog\/when-can-i-switch-medicare-plans-florida\.html<\/loc>\s*<lastmod>2026-08-17<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/lakelandhealthinsurance\.com\/blog\/medicare-supplement-cost-lakeland\.html<\/loc>\s*<lastmod>2026-08-17<\/lastmod>/);
});

test('privacy policy carries the current-season SOA exceptions and retention rule', () => {
  const html = source('privacy-policy.html');

  assert.match(html, /Through September 30, 2026, the 48-hour waiting period has two CMS exceptions/);
  assert.match(html, /last four days of a valid election period/);
  assert.match(html, /An inbound telephone call is not one of these exceptions/);
  assert.match(html, /recorded calls that pertain to sales or enrollment are subject to a 10-year retention requirement/);
});
