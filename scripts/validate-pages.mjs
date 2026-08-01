#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const CANONICAL_PHONE = '863-640-3102';
const FORBIDDEN_PHONES = ['617-1376'];
const FORBIDDEN_SERVICE_CLAIMS = [
  /coverage across the nation/i,
  /serving most of the united states/i,
  /serving (?:families|businesses)[^<]{0,80}nationwide/i,
  /nationwide (?:support|guidance) where available/i,
  /serving florida and nationwide/i,
  /licensed in 26 states/i
];
const FORBIDDEN_BRAND_COPY = [
  /plain(?:[\s-]|\u2011)+english/i
];
const SITE_ORIGIN = 'https://lakelandhealthinsurance.com';

const SKIP_DIRS = new Set([
  '.git', '.claude', 'node_modules', 'netlify', '.netlify', 'tests', 'scripts',
  'search-engine-from-zip',
]);

const SKIP_FILES = new Set([
  'google79927e3ae56b9c82.html',
  'health-protector-guard/nav-snippet.html',
  'newsletter/email-newsletter.html',
  'offline.html',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

const issues = [];
const seen = walk(ROOT);
const htmlByRel = new Map();

for (const file of seen) {
  const rel = relative(ROOT, file);
  htmlByRel.set(rel, file);
  if (SKIP_FILES.has(rel)) continue;
  const html = readFileSync(file, 'utf8');
  const isNoindex = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html);

  [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .forEach((match, index) => {
      try {
        JSON.parse(match[1]);
      } catch (error) {
        issues.push(`${rel}: JSON-LD block ${index + 1} is invalid (${error.message})`);
      }
    });

  for (const bad of FORBIDDEN_PHONES) {
    if (html.includes(bad)) issues.push(`${rel}: forbidden phone "${bad}"`);
  }
  for (const claim of FORBIDDEN_SERVICE_CLAIMS) {
    if (claim.test(html)) issues.push(`${rel}: unsupported service-area claim matches ${claim}`);
  }
  for (const copyPattern of FORBIDDEN_BRAND_COPY) {
    if (copyPattern.test(html)) issues.push(`${rel}: prohibited brand copy matches ${copyPattern}`);
  }
  if (/LHI\.identify\s*\(/.test(html)) {
    issues.push(`${rel}: deprecated identity-to-measurement helper is still referenced`);
  }

  if (isNoindex) continue;

  if (!html.includes('/js/analytics.js')) {
    issues.push(`${rel}: missing /js/analytics.js (page is indexable)`);
  }

  if (!/<link\s+rel=["']canonical["']\s+href=/i.test(html)) {
    issues.push(`${rel}: missing <link rel="canonical">`);
  }
}

function sitemapPathToLocalRel(pathname) {
  const cleanPath = decodeURI(pathname).replace(/^\/+/, '');
  if (!cleanPath) return { rel: 'index.html', isHtml: true };
  if (cleanPath.endsWith('/')) return { rel: join(cleanPath, 'index.html'), isHtml: true };

  const extension = extname(cleanPath).toLowerCase();
  if (!extension) return { rel: join(cleanPath, 'index.html'), isHtml: true };
  if (extension === '.html') return { rel: cleanPath, isHtml: true };
  return { rel: cleanPath, isHtml: false };
}

const sitemapPath = join(ROOT, 'sitemap.xml');
if (existsSync(sitemapPath)) {
  const sitemap = readFileSync(sitemapPath, 'utf8');
  const locs = [...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1]);

  for (const loc of locs) {
    let url;
    try {
      url = new URL(loc);
    } catch {
      issues.push(`sitemap.xml: invalid URL "${loc}"`);
      continue;
    }

    if (url.origin !== SITE_ORIGIN) {
      issues.push(`sitemap.xml: unexpected origin "${url.origin}" for "${loc}"`);
      continue;
    }

    let localPath;
    try {
      localPath = sitemapPathToLocalRel(url.pathname);
    } catch {
      issues.push(`sitemap.xml: invalid encoded path for "${loc}"`);
      continue;
    }

    const { rel, isHtml } = localPath;
    const file = isHtml ? htmlByRel.get(rel) : join(ROOT, rel);
    if (!file || !existsSync(file) || !statSync(file).isFile()) {
      issues.push(`sitemap.xml: ${loc} has no matching local file (${rel})`);
      continue;
    }

    if (!isHtml) continue;

    const html = readFileSync(file, 'utf8');
    if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) {
      issues.push(`sitemap.xml: ${loc} points to noindex page ${rel}`);
    }
  }
}

if (issues.length === 0) {
  console.log(`OK — validated ${seen.length} HTML files`);
  process.exit(0);
}

console.error(`FAIL — ${issues.length} issue(s) across ${seen.length} files:`);
for (const i of issues) console.error('  - ' + i);
process.exit(1);
