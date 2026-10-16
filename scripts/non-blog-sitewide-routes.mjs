#!/usr/bin/env node
/** Route lists for non-blog sitewide B + C (David approved 2026-10-16). */

/** Pins aligned with scripts/validate-pages.mjs for this batch. */
export const VERSION = '20261016-nonblog-gates2';
export const SITE_TEMPLATE_CSS_PIN = '20261016-pr-b-site-tpl';

export const CATEGORY_B = [
  'clearwater-health-insurance/index.html',
  'largo-health-insurance/index.html',
  'new-port-richey-health-insurance/index.html',
  'riverview-health-insurance/index.html',
  'st-petersburg-health-insurance/index.html',
  'wesley-chapel-health-insurance/index.html',
  'learning/index.html',
  'local-health-insurance-answers/index.html',
  'losing-medicaid-florida/index.html',
  'marketplace-agent-fraud-cms-crackdown-florida/index.html',
  'medicare-part-d-lakeland-fl/index.html',
  'private-medical-insurance/index.html',
  'self-employed-health-insurance/index.html',
  'turning-26/index.html',
  'working-past-65-medicare-lakeland-fl/index.html',
  'plans/index.html',
  'retiring-and-medicare-lakeland-fl/index.html'
];

export const CATEGORY_C = [
  'accident-wise/index.html',
  'critical-guard/index.html',
  'hospital-safeguard-gi/index.html',
  'hospital-wise/index.html',
  'dental-vision/index.html',
  'supplemental-insurance/index.html',
  'health-protector-guard/guard-4000/index.html',
  'health-protector-guard/guard-5000/index.html',
  'health-protector-guard/guard-6000/index.html',
  'health-protector-guard/preferred-4000/index.html',
  'health-protector-guard/premier-5000/index.html',
  'health-protector-guard/select-2000/index.html',
  'medicare/index.html',
  'medicare/east-polk/index.html',
  'medicare-broker-lakeland-fl/index.html',
  'aca-health-insurance-agent-polk-county-fl/index.html',
  'about/index.html',
  'contact/index.html',
  'our-approach.html',
  'current-client-review/index.html',
  'post-enrollment-review/index.html',
  'employer-referral/index.html',
  'lp/aca/index.html',
  'lp/gap/index.html',
  'lp/medicare/index.html'
];

export const CLEANUP_PAGES = [
  'contact/index.html',
  'aca-subsidy-estimator/index.html',
  'newsletter/confirmed/index.html',
  'lp/aca/index.html',
  'lp/medicare/index.html',
  'download-free-guide-here.html'
];

export const NO_LEAD_FORM_PAGES = new Set([
  '/thank-you/',
  '/thanks.html',
  '/newsletter/confirmed/',
  '/book/',
  '/chat.html',
  '/newsletter/',
  '/get-help/',
  '/life-insurance-dime-method/',
  '/aca-subsidy-estimator/',
  '/download-free-guide-here.html'
]);

export function relToRoute(rel) {
  if (rel === 'index.html') return '/';
  if (rel === 'our-approach.html') return '/our-approach.html';
  if (rel === 'download-free-guide-here.html') return '/download-free-guide-here.html';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

export function allNonBlogGateRoutes() {
  const seen = new Set();
  const out = [];
  for (const rel of [...CATEGORY_B, ...CATEGORY_C, ...CLEANUP_PAGES]) {
    const url = relToRoute(rel);
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ rel, url, name: rel.replace(/\/index\.html$/, '').replace(/\//g, '-') || 'home' });
  }
  return out.sort((a, b) => a.url.localeCompare(b.url));
}

/** PR B gate scope: Category B + cleanup owned on B branch. */
export function prBGateRoutes() {
  const rels = [
    ...CATEGORY_B,
    'aca-subsidy-estimator/index.html',
    'download-free-guide-here.html'
  ];
  const seen = new Set();
  return rels
    .map((rel) => {
      const url = relToRoute(rel);
      return { rel, url, name: rel.replace(/\/index\.html$/, '').replace(/\//g, '-') || 'home' };
    })
    .filter(({ url }) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .sort((a, b) => a.url.localeCompare(b.url));
}

/** PR C gate scope: Category C + cleanup not gated on B alone. */
export function prCGateRoutes() {
  const rels = [
    ...CATEGORY_C,
    'contact/index.html',
    'newsletter/confirmed/index.html',
    'aca-subsidy-estimator/index.html',
    'download-free-guide-here.html',
    'lp/aca/index.html',
    'lp/medicare/index.html'
  ];
  const seen = new Set();
  return rels
    .map((rel) => {
      const url = relToRoute(rel);
      return { rel, url, name: rel.replace(/\/index\.html$/, '').replace(/\//g, '-') || 'home' };
    })
    .filter(({ url }) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .sort((a, b) => a.url.localeCompare(b.url));
}

export function gateRoutesForScope(scope) {
  if (scope === 'b') return prBGateRoutes();
  if (scope === 'c') return prCGateRoutes();
  return allNonBlogGateRoutes();
}
