#!/usr/bin/env node
/** Pull 1–2 short paragraphs from hero deferred into lede-block when lede is thin. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const routes = `5-critical-health-insurance-mistakes.html
aca-open-enrollment-deadline.html
aca-subsidy-tax-return-clawback.html
aca-subsidy-wrong-income-florida.html
change-florida-blue-myblue-pcp-watson-clinic.html
check-prescriptions-covered-before-you-enroll.html
cobra-vs-marketplace-florida.html
dental-insurance-guide.html
do-i-have-to-pay-back-premium-tax-credit.html
do-i-need-part-b-with-employer-insurance.html
does-medicare-cover-dental-vision-hearing.html
dont-overlook-rx-costs-2027.html
fixed-indemnity-analysis.html
florida-aca-enrollment-and-benefits-2026.html
health-insurance-brandon-2026.html
health-insurance-largo-2026.html
health-insurance-new-port-richey-2026.html
health-insurance-outside-open-enrollment.html
health-insurance-riverview-2026.html
health-insurance-self-employed-lakeland-polk-county-2026.html
health-insurance-self-employed-tax-deductions.html
health-insurance-st-petersburg-2026.html
health-insurance-wesley-chapel-2026.html
hmo-vs-ppo-vs-epo-explained.html
how-does-medicare-work-with-an-hsa.html
how-to-keep-doctor-when-changing-health-plans.html
how-to-negotiate-hospital-bills.html
how-to-use-health-insurance-without-going-broke.html
keep-doctor-switch-medicare-plans-florida.html
life-change-health-insurance-60-day-window-florida.html
lost-job-coverage-aca-insurance-florida.html
medicare-advantage-lakeland-2026.html
medigap-plan-g-vs-plan-n.html
mental-health-awareness-month-therapy-benefit-lakeland-2026.html
no-your-agent-doesnt-hate-you.html
orlando-health-lakeland-quality-approval-2026.html
penalty-for-signing-up-for-medicare-late.html
planning-healthcare-budget-2026.html
real-cost-going-without-health-insurance.html
short-term-medical-guide.html
switch-medicare-advantage-back-to-original-medicare.html
watson-clinic-urgent-care.html
what-counts-as-income-marketplace-health-insurance.html
what-happens-health-insurance-if-i-quit-job.html
what-is-supplemental-coverage.html
what-short-term-health-insurance-does-not-cover.html
what-to-do-if-health-plan-denies-a-claim.html
when-to-sign-up-for-medicare-if-still-working.html`
  .trim()
  .split('\n');

const ROOT = join(import.meta.dirname, '..', 'blog');

function stripTags(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

for (const file of routes) {
  const path = join(ROOT, file);
  let html = readFileSync(path, 'utf8');
  const deferredM = html.match(
    /<div class="lhi-hero-deferred-block">([\s\S]*?)<\/div>\s*\n(?:<\/section>\s*\n)?<\/div>/
  );
  if (!deferredM) {
    console.error('no deferred', file);
    continue;
  }
  const deferredHtml = deferredM[1];
  const sources = [];
  for (const p of deferredHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = stripTags(p[1]);
    if (t.length > 40 && !/^Last reviewed:/i.test(t) && !/^Published /i.test(t)) sources.push(t);
  }
  for (const sn of deferredHtml.matchAll(/<div class="answer-snippet"[^>]*>([\s\S]*?)<\/div>/gi)) {
    const t = stripTags(sn[1]);
    if (t.length > 40) sources.push(t);
  }
  if (!sources.length) {
    console.error('no source text', file);
    continue;
  }
  const extra = sources.slice(0, 2).map((t) => `<p class="lhi-hero-lede">${t}</p>`).join('\n');
  const blockRe = /<div class="lhi-hero-lede-block">([\s\S]*?)<\/div>\s*\n<section class="lhi-lead-hero/;
  const m = html.match(blockRe);
  if (!m) continue;
  if ((m[1].match(/class="lhi-hero-lede"/g) || []).length >= 3) {
    console.log('skip rich lede', file);
    continue;
  }
  const inner = `${m[1].trim()}\n${extra}`;
  html = html.replace(blockRe, `<div class="lhi-hero-lede-block">${inner}</div>\n<section class="lhi-lead-hero`);
  writeFileSync(path, html);
  console.log('deferred-lede', file);
}
