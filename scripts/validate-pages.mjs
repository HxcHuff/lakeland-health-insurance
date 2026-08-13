#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { extractClientCopy, extractHtmlCopy, findContentPolicyIssues } from './content-policy.mjs';
import { faqParityIssues } from './faq-schema-parity.mjs';

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
const CLIENT_COPY_FILES = ['js/site-search.js', 'js/blog-cta.js', 'js/site-template.js'];
const SITE_ORIGIN = 'https://lakelandhealthinsurance.com';
const RELEASE_ASSET_VERSION = '20260812-compliance-r2';
const RELEASE_ASSET_PATHS = [
  '/css/site-template.css',
  '/css/blog-unified.css',
  '/js/site-template.js',
  '/js/bbb-seal.js',
  '/js/site-search.js',
  '/js/blog-cta.js',
];

const FORBIDDEN_PUBLIC_FILES = [
  'blog/ads-manager-setup-checklist.html',
  'blog/campaign-funnel-ab-test.html',
  'blog/facebook-ad-copy-ab-test.html',
  'health-protector-guard/internal-link-anchor-suggestions.txt',
  'health-protector-guard/nav-snippet.html',
  'newsletter/email-newsletter.html',
];

const FORBIDDEN_PUBLIC_DIRS = new Set(['search-engine-from-zip']);

const SKIP_DIRS = new Set([
  '.git', '.claude', '.audit-data', 'audit', 'node_modules', 'netlify', '.netlify', 'output', 'tests', 'scripts',
]);

const SKIP_FILES = new Set([
  'google79927e3ae56b9c82.html',
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

function findDeployableFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) findDeployableFiles(full, out);
    else out.push(full);
  }
  return out;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function localRedirectCandidates(target) {
  const pathname = target.split(/[?#]/, 1)[0];
  if (!pathname.startsWith('/') || /[:*]/.test(pathname)) return [];

  let cleanPath;
  try {
    cleanPath = decodeURI(pathname).replace(/^\/+/, '');
  } catch {
    return [];
  }

  if (!cleanPath) return ['index.html'];
  if (pathname.endsWith('/')) return [join(cleanPath, 'index.html')];
  if (extname(cleanPath)) return [cleanPath];
  return [cleanPath, `${cleanPath}.html`, join(cleanPath, 'index.html')];
}

const issues = [];

for (const rel of FORBIDDEN_PUBLIC_FILES) {
  if (existsSync(join(ROOT, rel))) issues.push(`${rel}: retired file must not exist in the public tree`);
}

for (const rel of FORBIDDEN_PUBLIC_DIRS) {
  const deployableFiles = findDeployableFiles(join(ROOT, rel));
  for (const file of deployableFiles) {
    issues.push(`${relative(ROOT, file)}: retired directory must not contain deployable files`);
  }
}

const seen = walk(ROOT);
const htmlByRel = new Map();

for (const file of seen) {
  const rel = relative(ROOT, file);
  htmlByRel.set(rel, file);
  const html = readFileSync(file, 'utf8');
  for (const assetPath of RELEASE_ASSET_PATHS) {
    const expected = `${assetPath}?v=${RELEASE_ASSET_VERSION}`;
    const pattern = new RegExp(`${escapeRegExp(assetPath)}(?:\\?[^\"'\\s<>]*)?`, 'g');
    for (const match of html.matchAll(pattern)) {
      if (match[0] !== expected) {
        issues.push(`${rel}: stale shared asset reference "${match[0]}" (expected "${expected}")`);
      }
    }
  }
  for (const policyIssue of findContentPolicyIssues(extractHtmlCopy(html))) {
    issues.push(`${rel}: content policy violation (${policyIssue})`);
  }
  if (SKIP_FILES.has(rel)) continue;
  const isNoindex = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html);

  [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .forEach((match, index) => {
      try {
        JSON.parse(match[1]);
      } catch (error) {
        issues.push(`${rel}: JSON-LD block ${index + 1} is invalid (${error.message})`);
      }
    });

  for (const parityIssue of faqParityIssues(html)) {
    issues.push(`${rel}: ${parityIssue}`);
  }

  for (const bad of FORBIDDEN_PHONES) {
    if (html.includes(bad)) issues.push(`${rel}: forbidden phone "${bad}"`);
  }
  for (const claim of FORBIDDEN_SERVICE_CLAIMS) {
    if (claim.test(html)) issues.push(`${rel}: unsupported service-area claim matches ${claim}`);
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

for (const rel of CLIENT_COPY_FILES) {
  const source = readFileSync(resolve(ROOT, rel), 'utf8');
  for (const policyIssue of findContentPolicyIssues(extractClientCopy(source))) {
    issues.push(`${rel}: content policy violation (${policyIssue})`);
  }
}

const serviceWorker = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const expectedCacheName = `const CACHE_NAME = 'lhi-${RELEASE_ASSET_VERSION}';`;
if (!serviceWorker.includes(expectedCacheName)) {
  issues.push(`sw.js: cache namespace must match shared asset release (${expectedCacheName})`);
}

const redirectsPath = join(ROOT, '_redirects');
const redirects = readFileSync(redirectsPath, 'utf8');
for (const [index, line] of redirects.split(/\r?\n/).entries()) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [source, target, status] = trimmed.split(/\s+/);
  if (!/^30[1278]!?$/.test(status || '') || !target?.startsWith('/')) continue;

  const candidates = localRedirectCandidates(target);
  if (candidates.length > 0 && !candidates.some((candidate) => existsSync(join(ROOT, candidate)))) {
    issues.push(`_redirects:${index + 1}: ${source} points to missing local target ${target}`);
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
