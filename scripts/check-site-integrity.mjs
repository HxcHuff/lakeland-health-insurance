#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import { dirname, extname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_ORIGIN = 'https://lakelandhealthinsurance.com';

const EXCLUDED_DIRS = new Set([
  '.git', '.netlify', '.claude', '.codex', '.playwright-cli',
  '.ai-worker-local', '.audit-data', 'audit', 'output', 'node_modules',
  'netlify', 'scripts', 'tests', 'search-engine-from-zip',
]);
const SUPPORTED_NON_HTTP = new Set(['mailto:', 'tel:', 'sms:', 'geo:', 'data:']);
const DOWNLOAD_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.zip', '.png', '.jpg',
  '.jpeg', '.gif', '.webp', '.svg', '.ico', '.xml', '.txt', '.json',
]);

function safeRelative(root, fullPath) {
  const rel = relative(root, fullPath);
  if (!rel || rel === '.') return '.';
  if (rel === '..' || rel.startsWith(`..${sep}`) || rel.startsWith('/')) {
    throw new Error('path escapes approved repository root');
  }
  return rel.split(sep).join('/');
}

function walkFiles(root, dir = root, output = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      output.push(full);
      continue;
    }
    if (entry.isDirectory()) walkFiles(root, full, output);
    else if (entry.isFile()) output.push(full);
  }
  return output;
}

function trackedFiles(root) {
  try {
    return new Set(execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).split('\0').filter(Boolean));
  } catch {
    return null;
  }
}

function attributes(tag) {
  const result = new Map();
  const body = tag.replace(/^<\/?\s*[^\s>]+|\/?>$/g, '');
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of body.matchAll(pattern)) {
    result.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

function decodePathname(pathname) {
  const decoded = pathname.split('/').map((segment) => decodeURIComponent(segment)).join('/');
  const segments = decoded.split('/');
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    throw new Error('path traversal segment');
  }
  if (decoded.includes('\0') || decoded.includes('\\')) throw new Error('unsafe decoded path');
  return decoded;
}

function routeForHtml(rel) {
  if (rel === 'index.html') return '/';
  const route = rel.endsWith('/index.html')
    ? `/${rel.slice(0, -'index.html'.length)}`
    : `/${rel}`;
  return route.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function hasTraversalSegment(rawReference) {
  const pathOnly = rawReference.split('#', 1)[0].split('?', 1)[0].replaceAll('\\', '/');
  try {
    return decodeURIComponent(pathOnly).split('/').includes('..');
  } catch {
    return /(?:^|\/)(?:\.\.|%2e%2e)(?:\/|$)/i.test(pathOnly);
  }
}

function traversalEscapesDocument(rawReference, documentPath) {
  const pathOnly = rawReference.split('#', 1)[0].split('?', 1)[0].replaceAll('\\', '/');
  let decoded;
  try { decoded = decodeURIComponent(pathOnly); } catch { return true; }
  if (!decoded.split('/').includes('..')) return false;
  if (decoded.startsWith('/')) return true;
  const normalized = posix.normalize(posix.join(posix.dirname(documentPath), decoded));
  return normalized === '..' || normalized.startsWith('../');
}

function candidatesForPath(pathname) {
  const decoded = decodePathname(pathname).replace(/^\/+/, '');
  if (!decoded) return ['index.html'];
  if (pathname.endsWith('/')) return [`${decoded.replace(/\/+$/, '')}/index.html`];
  if (extname(decoded)) return [decoded];
  return [decoded, `${decoded}.html`, `${decoded}/index.html`];
}

function parseRedirects(root) {
  const redirects = new Set();
  const path = join(root, '_redirects');
  if (!existsSync(path)) return redirects;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) continue;
    const [source] = clean.split(/\s+/);
    if (source?.startsWith('/') && !source.includes('*') && !source.includes(':')) redirects.add(source);
  }
  return redirects;
}

function extractDocument(html) {
  const ids = new Map();
  const anchors = new Set();
  const refs = [];
  let canonical = null;
  let noindex = false;

  for (const match of html.matchAll(/<([a-z][a-z0-9:-]*)\b[^>]*>/gi)) {
    const name = match[1].toLowerCase();
    const attrs = attributes(match[0]);
    const id = attrs.get('id');
    if (id) ids.set(id, (ids.get(id) || 0) + 1);
    if ((name === 'a' || name === 'map') && attrs.get('name')) anchors.add(attrs.get('name'));
    if (name === 'meta' && attrs.get('name')?.toLowerCase() === 'robots') {
      noindex ||= /(?:^|,)\s*noindex(?:\s*,|$)/i.test(attrs.get('content') || '');
    }
    if (name === 'link' && (attrs.get('rel') || '').toLowerCase().split(/\s+/).includes('canonical')) {
      canonical = attrs.get('href') || canonical;
    }
    const referenceAttributes = [];
    if (name === 'a' || name === 'area' || name === 'link') referenceAttributes.push('href');
    if (['img', 'script', 'iframe', 'source', 'audio', 'video', 'embed', 'input'].includes(name)) referenceAttributes.push('src');
    if (name === 'video') referenceAttributes.push('poster');
    for (const attr of referenceAttributes) {
      const value = attrs.get(attr);
      if (value) refs.push({ tag: name, attr, value });
    }
  }
  return { ids, anchors, refs, canonical, noindex };
}

function resolveExisting(root, pathname, tracked, issues, sourceRel, rule) {
  let candidates;
  try {
    candidates = candidatesForPath(pathname);
  } catch (error) {
    issues.push(`${sourceRel}: ${rule}: ${error.message}`);
    return null;
  }
  for (const rel of candidates) {
    const full = resolve(root, rel);
    try {
      safeRelative(root, full);
    } catch {
      issues.push(`${sourceRel}: ${rule}: target escapes repository root`);
      return null;
    }
    if (!existsSync(full)) continue;
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) {
      let real;
      try { real = realpathSync(full); } catch { continue; }
      try { safeRelative(root, real); } catch {
        issues.push(`${sourceRel}: ${rule}: symlink escapes repository root`);
        return null;
      }
    }
    if (tracked && !tracked.has(rel)) {
      issues.push(`${sourceRel}: ${rule}: target is not tracked (${rel})`);
      return null;
    }
    return rel;
  }
  return null;
}

export function inspectSite({ root, origin = PUBLIC_ORIGIN, requireTracked = false } = {}) {
  const approvedRoot = realpathSync(resolve(root));
  const issues = [];
  const externalUrls = new Set();
  const files = walkFiles(approvedRoot);
  const tracked = requireTracked ? trackedFiles(approvedRoot) : null;
  if (requireTracked && !tracked) issues.push('repository: tracking-rule: unable to enumerate tracked files');
  const redirects = parseRedirects(approvedRoot);
  const htmlDocs = new Map();

  for (const full of files) {
    let rel;
    try { rel = safeRelative(approvedRoot, full); } catch { continue; }
    if (!rel.endsWith('.html')) continue;
    if (lstatSync(full).isSymbolicLink()) {
      let real;
      try { real = realpathSync(full); } catch {
        issues.push(`${rel}: symlink-rule: broken symlink`);
        continue;
      }
      try { safeRelative(approvedRoot, real); } catch {
        issues.push(`${rel}: symlink-rule: symlink escapes repository root`);
        continue;
      }
    }
    const html = readFileSync(full, 'utf8');
    const doc = extractDocument(html);
    doc.rel = rel;
    doc.route = routeForHtml(rel);
    htmlDocs.set(rel, doc);
    for (const [id, count] of doc.ids) if (count > 1) issues.push(`${rel}: duplicate-id: ${id}`);
    for (const [index, block] of [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].entries()) {
      try { JSON.parse(block[1]); } catch { issues.push(`${rel}: json-ld: block ${index + 1} is invalid`); }
    }
  }

  for (const doc of [...htmlDocs.values()].sort((a, b) => a.rel.localeCompare(b.rel))) {
    const baseUrl = new URL(doc.route, `${origin}/`);
    for (const ref of doc.refs) {
      const raw = ref.value.trim();
      if (!raw || raw.startsWith('//')) {
        if (raw.startsWith('//')) externalUrls.add(raw);
        continue;
      }
      if (hasTraversalSegment(raw) && traversalEscapesDocument(raw, doc.rel)) {
        issues.push(`${doc.rel}: path traversal segment: ${raw}`);
        continue;
      }
      let parsed;
      try { parsed = new URL(raw, baseUrl); } catch {
        issues.push(`${doc.rel}: url-syntax: invalid ${ref.attr} reference`);
        continue;
      }
      if (SUPPORTED_NON_HTTP.has(parsed.protocol)) continue;
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        issues.push(`${doc.rel}: scheme-rule: unsupported scheme ${parsed.protocol}`);
        continue;
      }
      if (parsed.origin !== origin) {
        externalUrls.add(parsed.href);
        continue;
      }
      const redirectKey = parsed.pathname + (parsed.pathname.endsWith('/') ? '' : '');
      let targetRel = resolveExisting(approvedRoot, parsed.pathname, tracked, issues, doc.rel, 'local-reference');
      if (!targetRel && redirects.has(redirectKey)) continue;
      if (!targetRel) {
        issues.push(`${doc.rel}: local-reference: missing target ${parsed.pathname}`);
        continue;
      }
      if (parsed.hash && targetRel.endsWith('.html')) {
        let fragment;
        try { fragment = decodeURIComponent(parsed.hash.slice(1)); } catch {
          issues.push(`${doc.rel}: fragment-rule: invalid encoded fragment`);
          continue;
        }
        const targetDoc = htmlDocs.get(targetRel);
        if (!targetDoc || (!targetDoc.ids.has(fragment) && !targetDoc.anchors.has(fragment))) {
          issues.push(`${doc.rel}: fragment-rule: missing target ${parsed.pathname}#${fragment}`);
        }
      }
    }
  }

  const sitemapPath = join(approvedRoot, 'sitemap.xml');
  const sitemapUrls = [];
  if (!existsSync(sitemapPath)) issues.push('sitemap.xml: sitemap-rule: file is missing');
  else {
    const xml = readFileSync(sitemapPath, 'utf8');
    for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) sitemapUrls.push(match[1]);
  }
  const counts = new Map();
  for (const value of sitemapUrls) counts.set(value, (counts.get(value) || 0) + 1);
  for (const [value, count] of counts) if (count > 1) issues.push(`sitemap.xml: duplicate-url: ${value}`);

  const sitemapSet = new Set(sitemapUrls);
  for (const value of [...sitemapSet].sort()) {
    let url;
    try { url = new URL(value); } catch {
      issues.push('sitemap.xml: sitemap-url: invalid absolute URL');
      continue;
    }
    if (url.origin !== origin || url.search || url.hash) {
      issues.push(`sitemap.xml: sitemap-url: inconsistent public URL ${url.pathname}`);
      continue;
    }
    const targetRel = resolveExisting(approvedRoot, url.pathname, tracked, issues, 'sitemap.xml', 'sitemap-target');
    if (!targetRel || !targetRel.endsWith('.html')) {
      if (!targetRel || !DOWNLOAD_EXTENSIONS.has(extname(targetRel).toLowerCase())) {
        issues.push(`sitemap.xml: sitemap-target: missing canonical page ${url.pathname}`);
      }
      continue;
    }
    const targetDoc = htmlDocs.get(targetRel);
    if (targetDoc?.noindex) issues.push(`sitemap.xml: noindex-rule: noindex page listed ${url.pathname}`);
    if (targetDoc?.canonical !== value) issues.push(`sitemap.xml: canonical-mismatch: ${url.pathname}`);
  }

  for (const doc of [...htmlDocs.values()].sort((a, b) => a.rel.localeCompare(b.rel))) {
    if (!doc.canonical) continue;
    let canonical;
    try { canonical = new URL(doc.canonical); } catch {
      issues.push(`${doc.rel}: canonical-rule: invalid canonical URL`);
      continue;
    }
    if (canonical.origin !== origin || canonical.search || canonical.hash) {
      issues.push(`${doc.rel}: canonical-rule: inconsistent public origin or suffix`);
      continue;
    }
    if (!resolveExisting(approvedRoot, canonical.pathname, tracked, issues, doc.rel, 'canonical-target')) {
      issues.push(`${doc.rel}: canonical-target: missing ${canonical.pathname}`);
    }
    if (!doc.noindex && !sitemapSet.has(canonical.href)) issues.push(`${doc.rel}: sitemap-coverage: canonical page is missing`);
  }

  return {
    ok: issues.length === 0,
    issues: [...new Set(issues)].sort((a, b) => a.localeCompare(b)),
    summary: {
      htmlFiles: htmlDocs.size,
      sitemapUrls: sitemapSet.size,
      externalUrls: externalUrls.size,
    },
  };
}

export function runCli(argv = process.argv.slice(2)) {
  const rootIndex = argv.indexOf('--root');
  const root = rootIndex >= 0 ? argv[rootIndex + 1] : resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (!root || (rootIndex >= 0 && !argv[rootIndex + 1])) {
    process.stderr.write('FAIL site-integrity: --root requires a path\n');
    return 2;
  }
  let result;
  try { result = inspectSite({ root, requireTracked: rootIndex < 0 }); }
  catch (error) {
    process.stderr.write(`FAIL site-integrity: ${error.message}\n`);
    return 1;
  }
  if (!result.ok) {
    for (const issue of result.issues) process.stderr.write(`FAIL ${issue}\n`);
    process.stderr.write(`FAIL site-integrity: ${result.issues.length} issue(s)\n`);
    return 1;
  }
  process.stdout.write(`PASS site-integrity: ${result.summary.htmlFiles} HTML, ${result.summary.sitemapUrls} sitemap URL(s), ${result.summary.externalUrls} external URL(s) classified offline\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = runCli();
