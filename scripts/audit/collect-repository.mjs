#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  ROOT,
  extractHtmlSignals,
  loadConfig,
  makeEnvelope,
  parseArgs,
  parseRedirects,
  parseSitemap,
  persistEnvelope,
  relativeToRoot,
  sha256,
  walkFiles
} from './core.mjs';

function git(args, options = {}) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, ...options });
  return { status: result.status, stdout: result.stdout?.trim() || '', stderr: result.stderr?.trim() || '' };
}

function command(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, LHI_VALIDATION_DATE: new Date().toISOString().slice(0, 10) },
    maxBuffer: 10 * 1024 * 1024
  });
  return {
    command: [command, ...args].join(' '),
    status: result.status,
    stdout: (result.stdout || '').slice(0, 40_000),
    stderr: (result.stderr || '').slice(0, 40_000)
  };
}

function publicUrlFor(rel, origin) {
  if (rel === 'index.html') return `${origin}/`;
  if (rel.endsWith('/index.html')) return `${origin}/${rel.slice(0, -'index.html'.length)}`;
  return `${origin}/${rel}`;
}

function latestCommit(rel) {
  const result = git(['log', '-1', '--format=%H%x09%cI%x09%s', '--', rel]);
  if (result.status !== 0 || !result.stdout) return null;
  const [commit, committedAt, subject] = result.stdout.split('\t');
  return { commit, committedAt, subject };
}

function claimCandidates(html) {
  const candidates = [];
  const patterns = [
    /\$\s?\d[\d,]*(?:\.\d+)?/g,
    /\b\d+(?:\.\d+)?\s*(?:%|percent)\b/gi,
    /\b\d+\s+(?:plans?|products?|organizations?|carriers?)\b/gi,
    /\b(?:benefit|allowance|deductible|premium|copay|coinsurance)\b[^\n.!?]{0,80}(?:\$\s?\d|\d+(?:\.\d+)?\s*(?:%|percent))/gi,
    /\b(?:guaranteed|unlimited|covers? every|all benefits?|maximum benefit)\b/gi
  ];
  const contentOnly = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '');
  const lines = contentOnly.split(/\r?\n/);
  lines.forEach((line, index) => {
    const stripped = line.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!stripped || stripped.length > 1500) return;
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(stripped)) {
        candidates.push({ line: index + 1, fingerprint: sha256(stripped), pattern: pattern.source.slice(0, 80) });
        break;
      }
    }
  });
  return [...new Map(candidates.map((item) => [`${item.fingerprint}:${item.pattern}`, item])).values()].slice(0, 200);
}

function structuredIdentityDrift(html, authority) {
  const schemaEmails = new Set();
  const schemaPhones = new Set();
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== 'object') return;
    if (typeof value.email === 'string') schemaEmails.add(value.email.toLowerCase());
    if (typeof value.telephone === 'string') schemaPhones.add(value.telephone.replace(/\D/g, ''));
    Object.values(value).forEach(walk);
  };
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(match[1])); } catch { /* Invalid JSON-LD is handled by the page validator. */ }
  }
  const visibleEmails = new Set([...html.matchAll(/href=["']mailto:([^"'?]+)/gi)].map((match) => match[1].toLowerCase()));
  const visiblePhones = new Set([...html.matchAll(/href=["']tel:([^"']+)/gi)].map((match) => match[1].replace(/\D/g, '')));
  const expectedEmails = new Set([authority.agency.email, authority.person.email].filter(Boolean).map((value) => value.toLowerCase()));
  const expectedPhones = new Set([authority.agency.telephone, authority.person.telephone].filter(Boolean).map((value) => value.replace(/\D/g, '')));
  const issues = [];
  for (const value of schemaEmails) if (!expectedEmails.has(value)) issues.push({ field: 'schema.email', valueHash: sha256(value) });
  for (const value of schemaPhones) if (!expectedPhones.has(value)) issues.push({ field: 'schema.telephone', valueHash: sha256(value) });
  for (const value of visibleEmails) if (!expectedEmails.has(value)) issues.push({ field: 'visible.mailto', valueHash: sha256(value) });
  for (const value of visiblePhones) if (!expectedPhones.has(value)) issues.push({ field: 'visible.tel', valueHash: sha256(value) });
  return issues;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  const files = walkFiles(ROOT).map((full) => {
    const rel = relativeToRoot(full);
    const stat = statSync(full);
    return { rel, size: stat.size, sha256: sha256(readFileSync(full)), extension: extname(rel).toLowerCase() };
  });
  const tracked = new Set(git(['ls-files']).stdout.split('\n').filter(Boolean));
  files.forEach((file) => { file.tracked = tracked.has(file.rel); });

  const sitemapXml = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
  const sitemap = parseSitemap(sitemapXml);
  const sitemapByUrl = new Map(sitemap.map((row) => [row.url, row]));
  const redirects = parseRedirects(readFileSync(join(ROOT, '_redirects'), 'utf8'), config);
  const regulatedClaims = JSON.parse(readFileSync(join(ROOT, 'data/regulated-claims.json'), 'utf8'));
  const authority = JSON.parse(readFileSync(join(ROOT, 'data/authority-entities.json'), 'utf8'));
  const claimsByPage = new Map();
  for (const claim of regulatedClaims.claims || []) {
    for (const page of claim.usedBy || []) {
      if (!claimsByPage.has(page)) claimsByPage.set(page, []);
      claimsByPage.get(page).push(claim.id);
    }
  }

  const pages = [];
  const inbound = new Map();
  for (const file of files.filter((item) => item.extension === '.html')) {
    const html = readFileSync(join(ROOT, file.rel), 'utf8');
    const url = publicUrlFor(file.rel, config.site.origin);
    const signals = extractHtmlSignals(html, url, config);
    const internalRefs = signals.references.filter((ref) => ref.url?.startsWith(config.site.origin));
    for (const ref of internalRefs) {
      const key = new URL(ref.url).pathname;
      inbound.set(key, (inbound.get(key) || 0) + 1);
    }
    pages.push({
      file: file.rel,
      url,
      tracked: file.tracked,
      size: file.size,
      sha256: file.sha256,
      lastCommit: latestCommit(file.rel),
      inSitemap: sitemapByUrl.has(url),
      sitemapLastmod: sitemapByUrl.get(url)?.lastmod || null,
      registeredClaimIds: claimsByPage.get(file.rel) || [],
      claimCandidates: claimCandidates(html),
      structuredIdentityDrift: structuredIdentityDrift(html, authority),
      ...signals
    });
  }
  for (const page of pages) page.inboundInternalLinks = inbound.get(new URL(page.url).pathname) || 0;

  const head = git(['rev-parse', 'HEAD']);
  const branch = git(['branch', '--show-current']);
  const status = git(['status', '--porcelain=v1']);
  const payload = {
    repository: {
      rootFingerprint: sha256(ROOT),
      head: head.stdout,
      branch: branch.stdout,
      dirty: Boolean(status.stdout),
      status: status.stdout.split('\n').filter(Boolean)
    },
    inventory: files,
    pages,
    sitemap,
    robots: readFileSync(join(ROOT, 'robots.txt'), 'utf8').split(/\r?\n/).filter((line) => line.trim()),
    redirects,
    regulatedClaims: {
      reviewedAt: regulatedClaims.reviewedAt,
      count: regulatedClaims.claims?.length || 0,
      ids: (regulatedClaims.claims || []).map((claim) => claim.id)
    },
    validators: [
      command(process.execPath, ['scripts/validate-pages.mjs']),
      command(process.execPath, ['scripts/validate-authority.mjs']),
      command(process.execPath, ['scripts/check-regulated-claims.mjs', '--json'])
    ]
  };
  const envelope = makeEnvelope({
    source: 'repository',
    dataset: 'repository-inventory',
    request: {
      property: config.site.origin,
      reportingWindow: null,
      dimensions: ['file', 'url'],
      filters: { ignoredRuntimeDirectories: ['.git', '.claude', '.netlify', '.audit-data', 'node_modules', '.playwright-cli', 'output'] },
      dataState: 'working-tree',
      requestedRows: null,
      retrievedRows: files.length,
      complete: true,
      limitations: ['Git metadata reflects the current checkout and preserves uncommitted worktree state.']
    },
    payload
  });
  const output = persistEnvelope(envelope, config);
  console.log(JSON.stringify({ ok: true, output, files: files.length, pages: pages.length, sitemapUrls: sitemap.length }, null, 2));
}

main().catch((error) => {
  console.error(`Repository collection failed: ${error.message}`);
  process.exit(1);
});
