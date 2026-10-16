#!/usr/bin/env node
/** Blog routes with sitewide lead heroes — used by PR B verify + screenshots. */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const BLOG = join(ROOT, 'blog');

export const SAMPLE_SCREENSHOT_ROUTES = [
  { url: '/blog/aca-subsidy-cliff.html', name: 'aca-subsidy-cliff' },
  { url: '/blog/5-critical-health-insurance-mistakes.html', name: 'five-mistakes' },
  { url: '/blog/winter-haven-hospital-insurance.html', name: 'winter-haven-hospital' },
  { url: '/blog/medicare-for-dummies.html', name: 'medicare-for-dummies' },
  { url: '/blog/orlando-health-watson-clinic-insurance-2026.html', name: 'watson-clinic-2026' },
  { url: '/blog/', name: 'blog-index' }
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
