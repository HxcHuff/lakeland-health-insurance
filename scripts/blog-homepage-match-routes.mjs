#!/usr/bin/env node
/** Blog routes with sitewide lead heroes — used by PR B verify + screenshots. */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const BLOG = join(ROOT, 'blog');

/** ≥20 posts spanning pre-migration hero patterns (section.hero, article-header, blog-header, guides). */
export const SAMPLE_SCREENSHOT_ROUTES = [
  { url: '/blog/', name: 'blog-index' },
  { url: '/blog/aca-subsidy-cliff.html', name: 'aca-subsidy-cliff' },
  { url: '/blog/5-critical-health-insurance-mistakes.html', name: 'five-mistakes-article-header' },
  { url: '/blog/trump-state-of-the-union-healthcare-hsa-2026.html', name: 'trump-sotu-blog-header' },
  { url: '/blog/what-is-supplemental-coverage.html', name: 'supplemental-guide-hero' },
  { url: '/blog/dental-insurance-guide.html', name: 'dental-guide-hero' },
  { url: '/blog/short-term-medical-guide.html', name: 'stm-guide-hero' },
  { url: '/blog/florida-insurance-guide.html', name: 'florida-insurance-guide' },
  { url: '/blog/preexisting-condition-guide.html', name: 'preexisting-guide' },
  { url: '/blog/winter-haven-hospital-insurance.html', name: 'winter-haven-hospital' },
  { url: '/blog/lakeland-regional-health-insurance-accepted.html', name: 'lrh-section-hero' },
  { url: '/blog/medicare-for-dummies.html', name: 'medicare-for-dummies' },
  { url: '/blog/medicare-advantage-vs-medicare-supplement.html', name: 'ma-vs-medigap' },
  { url: '/blog/hmo-vs-ppo-vs-epo-explained.html', name: 'hmo-ppo-epo' },
  { url: '/blog/er-visit-cost-lakeland-without-insurance-2026.html', name: 'er-cost-article-header' },
  { url: '/blog/health-insurance-tampa-2026.html', name: 'city-hero-tampa' },
  { url: '/blog/zero-premium-health-insurance-florida-2026.html', name: 'zero-premium-one-off' },
  { url: '/blog/cobra-vs-marketplace-florida.html', name: 'cobra-marketplace' },
  { url: '/blog/orlando-health-watson-clinic-insurance-2026.html', name: 'watson-clinic-2026' },
  { url: '/blog/orlando-health-watson-clinic-doctors-network-2026.html', name: 'watson-doctors-network' },
  { url: '/blog/orlando-health-polk-county-expansion-2026.html', name: 'watson-polk-expansion' },
  { url: '/blog/orlando-health-lakeland-quality-approval-2026.html', name: 'watson-lakeland-quality' },
  { url: '/blog/watson-clinic-urgent-care.html', name: 'watson-urgent-care' },
  { url: '/blog/change-florida-blue-myblue-pcp-watson-clinic.html', name: 'watson-myblue-pcp' },
  {
    url: '/local-health-insurance-answers/watson-clinic-insurance-network-help/',
    name: 'watson-network-help'
  }
];

export function allBlogLeadHeroRoutes() {
  const routes = [{ url: '/blog/', name: 'blog-index' }];
  for (const name of readdirSync(BLOG)) {
    if (!name.endsWith('.html') || name === 'index.html') continue;
    routes.push({
      url: `/blog/${name}`,
      name: name.replace(/\.html$/, '')
    });
  }
  return routes;
}
