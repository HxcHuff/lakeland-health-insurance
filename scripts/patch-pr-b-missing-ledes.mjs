#!/usr/bin/env node
/** One-off: add hero ledes from existing copy for PR B gap fix (David review). */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/** Exact or lightly trimmed copy already on each page. */
const LEDES = {
  'aca-subsidy-tax-return-clawback.html': `<p class="lhi-hero-lede">Some ACA Marketplace applications are submitted with income that does not match the household's real tax situation. The consumer may not find out until tax time, when premium tax credit reconciliation creates a repayment problem.</p>`,
  'employer-coverage-family-marketplace-affordability-florida.html': `<p class="lhi-hero-lede"><strong>In short:</strong> Your own work plan can count as affordable for you even when covering your family does not. Under the family affordability test, a spouse or child may still qualify for Marketplace financial assistance if the cost of covering those offered family members is too high relative to household income.</p>`,
  'fixed-indemnity-analysis.html': `<p class="lhi-hero-lede"><strong>Direct answer:</strong> Fixed indemnity insurance pays scheduled cash benefits for covered events (such as hospital admission, surgery, or ER)—it is not ACA major medical. Health ProtectorGuard is one fixed-indemnity series reviewed on this page; it can sit beside, not replace, comprehensive coverage.</p>`,
  'health-insurance-checkup-every-age.html': `<p class="lhi-hero-lede"><strong>Quick answer:</strong> Review health insurance before a claim, prescription, or enrollment deadline creates a problem. Check doctors, hospitals, prescriptions, premiums, deductibles, out-of-pocket exposure, household changes, and enrollment timing.</p>`,
  'health-insurance-self-employed-lakeland-polk-county-2026.html': `<p class="lhi-hero-lede"><strong>Direct answer (2027 plan year):</strong> Most self-employed people in Lakeland and Polk County with no employees buy ACA coverage on HealthCare.gov. Premium tax credits use estimated <strong>2027</strong> household income (net self-employment profit plus other taxable income), reconcile at tax time, and require checking Polk County doctors on the exact plan ID before you enroll.</p>`,
  'health-insurance-self-employed-tax-deductions.html': `<p class="lhi-hero-lede"><strong>Direct answer:</strong> If your business shows a net profit and, for a given month, you were not eligible for an employer-subsidized health plan (including one offered through your spouse's job), you can generally deduct the premiums you paid that month for medical, dental, vision and qualified long-term care insurance.</p>`,
  'hmo-vs-ppo-vs-epo-explained.html': `<p class="lhi-hero-lede"><strong>Direct answer:</strong> The three plan types differ in two ways: whether they pay for out-of-network care, and whether you need a referral to see a specialist.</p>`,
  'medicare-vs-aca-central-florida-age-65.html': `<p class="lhi-hero-lede"><strong>Direct answer:</strong> Most people first qualify for Medicare at age 65. Your Medicare Initial Enrollment Period generally starts three months before your birthday month and ends three months after that month. If you are on an ACA Marketplace plan, confirm your Medicare effective date before ending ACA coverage, and update the Marketplace so premium tax credits do not continue after Medicare eligibility.</p>`,
  'orlando-health-watson-clinic-doctors-network-2026.html': `<p class="lhi-hero-lede"><strong>The new hospital is open, but network participation still requires verification.</strong> Facility contracts, doctor contracts, and referral rules are separate moving parts.</p>`,
  'short-term-medical-guide.html': `<p class="lhi-hero-lede"><strong>Direct answer:</strong> Florida short-term health insurance is temporary, underwritten coverage—not ACA-compliant major medical—and it can exclude pre-existing conditions.</p>`,
  'watson-clinic-urgent-care.html': `<p class="lhi-hero-lede"><strong>Direct answer:</strong> It depends on your plan. Look up Watson Clinic Urgent Care in your plan's provider directory using your plan ID, and call the clinic before you go. Your plan sets urgent care cost-sharing separately from emergency room cost-sharing.</p>`
};

for (const [file, ledeHtml] of Object.entries(LEDES)) {
  const path = join(ROOT, 'blog', file);
  let html = readFileSync(path, 'utf8');
  const blockRe = /<div class="lhi-hero-lede-block">([\s\S]*?)<\/div>\s*\n<section class="lhi-lead-hero/;
  const m = html.match(blockRe);
  if (!m) {
    console.error(`skip (no block): ${file}`);
    continue;
  }
  if (/class="lhi-hero-lede"/.test(m[1])) {
    console.log(`already has lede: ${file}`);
    continue;
  }
  const inner = m[1].replace(/(<h1>[\s\S]*?<\/h1>)/, `$1\n${ledeHtml}`);
  html = html.replace(blockRe, `<div class="lhi-hero-lede-block">${inner}</div>\n<section class="lhi-lead-hero`);
  writeFileSync(path, html);
  console.log(`patched ${file}`);
}
