import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const REDIRECTS = readFileSync(join(ROOT, '_redirects'), 'utf8');
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const FORCE_ONLY_CONFLICT_ALLOWLIST = new Set(['/blog/aca-subsidy-cliff']);

const AFFECTED_DIRECTORY_PATHS = [
  '/about',
  '/aca-health-insurance-lakeland-fl',
  '/aca-subsidy-estimator',
  '/blog',
  '/brandon-health-insurance',
  '/carriers',
  '/clearwater-health-insurance',
  '/contact',
  '/davenport-health-insurance',
  '/haines-city-health-insurance',
  '/health-protector-guard',
  '/lake-alfred-health-insurance',
  '/largo-health-insurance',
  '/learning',
  '/life-insurance-dime-method',
  '/local-health-insurance-answers',
  '/losing-medicaid-florida',
  '/medicare-broker-lakeland-fl',
  '/moving-florida-medicare',
  '/new-port-richey-health-insurance',
  '/newsletter',
  '/plans',
  '/private-medical-insurance',
  '/quote',
  '/retiring-before-65-florida',
  '/riverview-health-insurance',
  '/short-term-medical',
  '/st-petersburg-health-insurance',
  '/supplemental-insurance',
  '/tampa-health-insurance',
  '/wesley-chapel-health-insurance',
  '/winter-haven-health-insurance'
];

function normalizePath(value) {
  const path = String(value || '');
  if (!path.startsWith('/') || path === '/') return path;
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

function parseRedirects(source) {
  const rules = [];
  for (const [index, rawLine] of String(source).split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const fields = line.split(/\s+/);
    if (fields.length !== 3) throw new Error(`line ${index + 1}: expected source, target, and status`);
    const status = Number(fields[2].replace(/!$/, ''));
    if (!Number.isInteger(status)) throw new Error(`line ${index + 1}: invalid status ${fields[2]}`);
    rules.push({
      line: index + 1,
      source: fields[0],
      target: fields[1],
      status,
      forced: fields[2].endsWith('!')
    });
  }
  return rules;
}

function isConcreteLocal(value) {
  return String(value).startsWith('/') && !/[*:]/.test(String(value));
}

function inspectRedirects(source) {
  const rules = parseRedirects(source);
  const issues = [];
  const rawSources = new Map();
  const normalizedSources = new Map();

  for (const rule of rules) {
    const rawGroup = rawSources.get(rule.source) || [];
    rawGroup.push(rule);
    rawSources.set(rule.source, rawGroup);

    const normalized = normalizePath(rule.source);
    const normalizedGroup = normalizedSources.get(normalized) || [];
    normalizedGroup.push(rule);
    normalizedSources.set(normalized, normalizedGroup);
  }

  for (const [source, group] of rawSources) {
    if (group.length > 1) {
      issues.push(`exact-duplicate ${source} at lines ${group.map((rule) => rule.line).join(', ')}`);
    }
  }

  for (const [source, group] of normalizedSources) {
    if (group.length > 2) {
      issues.push(`normalized-duplicate ${source} has ${group.length} variants at lines ${group.map((rule) => rule.line).join(', ')}`);
    }
    const signatures = new Set(group.map((rule) => `${normalizePath(rule.target)} ${rule.status}${rule.forced ? '!' : ''}`));
    const targetStatusSignatures = new Set(group.map((rule) => `${normalizePath(rule.target)} ${rule.status}`));
    const allowlistedForceOnlyDifference = targetStatusSignatures.size === 1 && FORCE_ONLY_CONFLICT_ALLOWLIST.has(source);
    if (signatures.size > 1 && !allowlistedForceOnlyDifference) {
      issues.push(`normalized-conflict ${source} at lines ${group.map((rule) => rule.line).join(', ')}`);
    }
  }

  const edges = new Map();
  for (const [source, group] of normalizedSources) {
    const rule = group[0];
    if (!REDIRECT_CODES.has(rule.status) || !isConcreteLocal(rule.source) || !isConcreteLocal(rule.target)) continue;
    const target = normalizePath(rule.target);
    if (source === target) issues.push(`normalized-self-redirect ${source} at line ${rule.line}`);
    if (!edges.has(source)) edges.set(source, { target, line: rule.line });
  }

  const cycles = new Set();
  const aliasesIntoCycles = new Set();
  let maxHops = 0;
  for (const start of edges.keys()) {
    const path = [];
    const seen = new Map();
    let current = start;
    while (edges.has(current)) {
      if (seen.has(current)) {
        const cycleStart = seen.get(current);
        const cycle = path.slice(cycleStart);
        const canonical = [...cycle].sort().join(' -> ');
        cycles.add(canonical);
        if (cycleStart > 0) aliasesIntoCycles.add(path.slice(0, cycleStart).join(' -> '));
        break;
      }
      seen.set(current, path.length);
      path.push(current);
      current = edges.get(current).target;
    }
    maxHops = Math.max(maxHops, path.length);
  }

  for (const cycle of cycles) issues.push(`redirect-cycle ${cycle}`);
  for (const alias of aliasesIntoCycles) issues.push(`alias-enters-cycle ${alias}`);
  return { rules, issues, edges, maxHops };
}

function wildcardMatch(source, pathname) {
  if (!source.endsWith('*')) return null;
  const escapedPrefix = source.slice(0, -1).replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const match = pathname.match(new RegExp(`^${escapedPrefix}(.*)$`));
  return match ? match.slice(1) : null;
}

function matchingRule(rules, pathname) {
  const normalized = normalizePath(pathname);
  for (const rule of rules) {
    if (rule.source.includes('*')) {
      const captures = wildcardMatch(rule.source, pathname);
      if (captures) return rule;
      continue;
    }
    if (normalizePath(rule.source) === normalized) return rule;
  }
  return null;
}

function followRedirects(rules, pathname, limit = 10) {
  let current = pathname;
  let hops = 0;
  const visited = new Set();
  while (hops <= limit) {
    const normalized = normalizePath(current);
    if (visited.has(normalized)) throw new Error(`cycle while resolving ${pathname}`);
    visited.add(normalized);
    const rule = matchingRule(rules, current);
    if (!rule || !REDIRECT_CODES.has(rule.status)) return { final: current, hops };
    current = rule.target;
    hops += 1;
  }
  throw new Error(`redirect hop limit exceeded for ${pathname}`);
}

test('redirect inspector rejects each unsafe normalized graph shape', () => {
  const fixtures = [
    ['/a /a/ 301!\n', /normalized-self-redirect/],
    ['/a /b 301\n/b /c 301\n/c /a 301\n', /redirect-cycle/],
    ['/a /b 301\n/a /b 301\n', /exact-duplicate/],
    ['/a /b 301\n/a/ /c 301!\n', /normalized-conflict/],
    ['/a /b 301\n/a/ /b 302\n', /normalized-conflict/],
    ['/a /b 301\n/a/ /b 301!\n', /normalized-conflict/],
    ['/alias /a 301\n/a /b 301\n/b /a 301\n', /alias-enters-cycle/]
  ];
  for (const [source, expected] of fixtures) {
    assert.match(inspectRedirects(source).issues.join('\n'), expected, source);
  }
});

test('only terminal Netlify splats participate in wildcard matching', () => {
  const rules = parseRedirects([
    '/lp/campaign-*.html /wrong/ 301!',
    '/lp/campaign-* /get-help/ 301!'
  ].join('\n'));
  assert.deepEqual(followRedirects(rules, '/lp/campaign-regression.html'), {
    final: '/get-help/',
    hops: 1
  });
});

test('production redirects have no normalized conflicts, self-redirects, or cycles', () => {
  const result = inspectRedirects(REDIRECTS);
  assert.deepEqual(result.issues, []);
  assert.ok(result.maxHops <= 2, `maximum concrete redirect chain is ${result.maxHops} hops`);
});

test('defective directory redirects are absent and their static pages remain present', () => {
  const rules = parseRedirects(REDIRECTS);
  for (const pathname of AFFECTED_DIRECTORY_PATHS) {
    const redirect = rules.find((rule) => REDIRECT_CODES.has(rule.status) && normalizePath(rule.source) === pathname);
    assert.equal(redirect, undefined, pathname);
    assert.equal(existsSync(join(ROOT, pathname.slice(1), 'index.html')), true, pathname);
  }
  assert.doesNotMatch(REDIRECTS, /Force trailing-slash 301s for directory URLs/);
});

test('direct controls have no 3xx rule and approved aliases terminate within two hops', () => {
  const rules = parseRedirects(REDIRECTS);
  for (const pathname of [
    '/medicare/',
    '/get-help/',
    '/lp/medicare/',
    '/lp/medicare.html',
    '/lp/aca/',
    '/lp/aca.html'
  ]) {
    const rule = matchingRule(rules, pathname);
    assert.ok(!rule || !REDIRECT_CODES.has(rule.status), pathname);
  }

  const paidHtmlRewrites = new Map([
    ['/lp/medicare.html', '/lp/medicare/index.html'],
    ['/lp/aca.html', '/lp/aca/index.html']
  ]);
  for (const [source, target] of paidHtmlRewrites) {
    const rule = matchingRule(rules, source);
    assert.ok(rule, `${source} has an explicit content rewrite`);
    assert.equal(rule.status, 200, source);
    assert.equal(normalizePath(rule.target), normalizePath(target), source);
  }

  const aliases = new Map([
    ['/aca', '/aca-health-insurance-lakeland-fl/'],
    ['/help', '/get-help/'],
    ['/life', '/life-insurance-dime-method/'],
    ['/medicare-advantage', '/medicare/'],
    ['/privacy', '/privacy-policy.html'],
    ['/index.html', '/']
  ]);
  for (const [source, expected] of aliases) {
    const result = followRedirects(rules, source);
    assert.equal(normalizePath(result.final), normalizePath(expected), source);
    assert.ok(result.hops <= 2, `${source} used ${result.hops} hops`);
  }

  for (const source of ['/lp/campaign-regression', '/lp/campaign-regression.html']) {
    const result = followRedirects(rules, source);
    assert.equal(normalizePath(result.final), '/get-help', source);
    assert.ok(result.hops <= 2, `${source} used ${result.hops} hops`);
  }
});
