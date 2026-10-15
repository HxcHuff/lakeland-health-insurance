#!/usr/bin/env node
/** Shared route list for homepage-match verification and screenshots. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIP_FILES = new Set(['index.html', 'medicare/index.html']);
const SKIP_PREFIX = 'blog/';

export function walkHtml(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'search-engine-from-zip' || name === '.ai-worker-local' || name === 'output') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (name.endsWith('.html')) out.push(relative(ROOT, full).replace(/\\/g, '/'));
  }
  return out;
}

/** All shell grid-lead pages (pass-2 inventory + priority hubs). */
export function pass2Routes() {
  const routes = [];
  for (const rel of walkHtml()) {
    if (rel.startsWith(SKIP_PREFIX) || SKIP_FILES.has(rel)) continue;
    const html = readFileSync(join(ROOT, rel), 'utf8');
    if (!html.includes('lhi-hero-shell') || !html.includes('lhi-hero-grid-lead')) continue;
    const url = rel === 'index.html' ? '/' : `/${rel.replace(/index\.html$/, '')}`;
    const name = rel.replace(/\/index\.html$/, '').replace(/\//g, '-') || 'home';
    routes.push({ rel, url, name });
  }
  routes.sort((a, b) => a.url.localeCompare(b.url));
  return routes;
}

export const REFERENCE_ROUTES = [
  { url: '/', name: 'home', rel: 'index.html' },
  { url: '/plans/', name: 'plans', rel: 'plans/index.html' },
  { url: '/provider-prescription-check/', name: 'provider-check', rel: 'provider-prescription-check/index.html' }
];

export function allCaptureRoutes() {
  const seen = new Set();
  const out = [];
  for (const r of [...REFERENCE_ROUTES, ...pass2Routes()]) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    out.push(r);
  }
  return out;
}
