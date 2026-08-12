#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { claimCandidates } from './audit/collect-repository.mjs';

const DEFAULT_ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const APPROVED_HOSTS = new Set([
  'cms.gov',
  'www.cms.gov',
  'dol.gov',
  'www.dol.gov',
  'healthcare.gov',
  'www.healthcare.gov',
  'ahca.myflorida.com',
  'myflfamilies.com',
  'www.myflfamilies.com',
  'irs.gov',
  'www.irs.gov',
  'medicare.gov',
  'www.medicare.gov',
  'myfloridacfo.com',
  'www.myfloridacfo.com',
  'floir.com',
  'www.floir.com',
  'uhone.com',
  'www.uhone.com',
  'nipr.com',
  'www.nipr.com'
]);
const REQUIRED_FIELDS = [
  'id',
  'claim',
  'sourceUrl',
  'accessDate',
  'applicableYear',
  'state',
  'productLine',
  'reviewStatus',
  'reviewCadenceDays',
  'usedBy'
];
const ALLOWED_STATUSES = new Set(['approved', 'qualified', 'blocked']);

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayDifference(later, earlier) {
  return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

export async function checkRegistry({
  root = DEFAULT_ROOT,
  registry,
  asOf = new Date().toISOString().slice(0, 10),
  online = false,
  fetchImpl = globalThis.fetch
} = {}) {
  const issues = [];
  const warnings = [];
  const probes = [];
  const asOfDate = parseIsoDate(asOf);
  if (!asOfDate) return { issues: [`Invalid --as-of date: ${asOf}`], warnings, probes, controlledCandidateCount: 0 };

  if (!registry || !Array.isArray(registry.claims) || registry.claims.length === 0) {
    return { issues: ['Claim registry is missing or empty'], warnings, probes, controlledCandidateCount: 0 };
  }

  const ids = new Set();
  const candidateEvidenceKeys = new Map();
  for (const [index, claim] of registry.claims.entries()) {
    const label = claim?.id || `claim ${index + 1}`;
    for (const field of REQUIRED_FIELDS) {
      if (claim?.[field] === undefined || claim?.[field] === null || claim?.[field] === '') {
        issues.push(`${label}: missing ${field}`);
      }
    }

    if (claim?.id) {
      if (ids.has(claim.id)) issues.push(`${label}: duplicate claim ID`);
      ids.add(claim.id);
    }

    if (!ALLOWED_STATUSES.has(claim?.reviewStatus)) {
      issues.push(`${label}: invalid reviewStatus ${JSON.stringify(claim?.reviewStatus)}`);
    }

    let source;
    try {
      source = new URL(claim?.sourceUrl);
      if (source.protocol !== 'https:') issues.push(`${label}: source URL must use HTTPS`);
      if (!APPROVED_HOSTS.has(source.hostname)) {
        issues.push(`${label}: source host ${source.hostname} is not approved`);
      }
    } catch {
      issues.push(`${label}: invalid source URL`);
    }

    const accessDate = parseIsoDate(claim?.accessDate);
    if (!accessDate) {
      issues.push(`${label}: accessDate must be YYYY-MM-DD`);
    } else {
      const ageDays = dayDifference(asOfDate, accessDate);
      if (ageDays < 0) issues.push(`${label}: accessDate is after as-of date`);
      if (!Number.isInteger(claim?.reviewCadenceDays) || claim.reviewCadenceDays < 1) {
        issues.push(`${label}: reviewCadenceDays must be a positive integer`);
      } else if (ageDays > claim.reviewCadenceDays) {
        issues.push(`${label}: source review is stale by ${ageDays - claim.reviewCadenceDays} day(s)`);
      }
    }

    if (!Number.isInteger(claim?.applicableYear) || claim.applicableYear < 2000) {
      issues.push(`${label}: applicableYear must be a four-digit year`);
    }

    if (!Array.isArray(claim?.usedBy) || claim.usedBy.length === 0) {
      issues.push(`${label}: usedBy must contain at least one public page`);
    } else {
      for (const rel of claim.usedBy) {
        if (typeof rel !== 'string' || rel.startsWith('/') || rel.includes('..')) {
          issues.push(`${label}: invalid usedBy path ${JSON.stringify(rel)}`);
          continue;
        }
        const pagePath = resolve(root, rel);
        if (!existsSync(pagePath)) {
          issues.push(`${label}: usedBy page does not exist (${rel})`);
          continue;
        }
        const page = readFileSync(pagePath, 'utf8');
        if (claim.sourceUrl && !page.includes(claim.sourceUrl)) {
          issues.push(`${label}: ${rel} does not cite the registered source URL`);
        }
      }
    }

    if (claim?.candidateEvidence !== undefined) {
      if (!Array.isArray(claim.candidateEvidence) || claim.candidateEvidence.length === 0) {
        issues.push(`${label}: candidateEvidence must contain at least one page mapping when present`);
      } else {
        for (const mapping of claim.candidateEvidence) {
          const rel = mapping?.page;
          if (typeof rel !== 'string' || rel.startsWith('/') || rel.includes('..')) {
            issues.push(`${label}: invalid candidateEvidence page ${JSON.stringify(rel)}`);
            continue;
          }
          if (!claim.usedBy?.includes(rel)) {
            issues.push(`${label}: candidateEvidence page is not listed in usedBy (${rel})`);
          }
          if (!Array.isArray(mapping.fingerprints) || mapping.fingerprints.length === 0) {
            issues.push(`${label}: candidateEvidence for ${rel} must contain fingerprints`);
            continue;
          }
          const pagePath = resolve(root, rel);
          if (!existsSync(pagePath)) continue;
          const currentFingerprints = new Set(claimCandidates(readFileSync(pagePath, 'utf8')).map((item) => item.fingerprint));
          const localFingerprints = new Set();
          for (const fingerprint of mapping.fingerprints) {
            if (typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint)) {
              issues.push(`${label}: invalid candidate fingerprint for ${rel}`);
              continue;
            }
            if (localFingerprints.has(fingerprint)) {
              issues.push(`${label}: duplicate candidate fingerprint in ${rel} (${fingerprint})`);
            }
            localFingerprints.add(fingerprint);
            if (!currentFingerprints.has(fingerprint)) {
              issues.push(`${label}: candidate fingerprint no longer matches ${rel} (${fingerprint})`);
            }
            const evidenceKey = `${rel}:${fingerprint}`;
            const prior = candidateEvidenceKeys.get(evidenceKey);
            if (prior && prior !== label) {
              issues.push(`${label}: candidate fingerprint for ${rel} is already controlled by ${prior}`);
            } else {
              candidateEvidenceKeys.set(evidenceKey, label);
            }
          }
        }
      }
    }

    if (online && source && fetchImpl) {
      try {
        const response = await fetchImpl(source, {
          redirect: 'follow',
          signal: AbortSignal.timeout(15_000),
          headers: {
            accept: 'text/html,application/pdf;q=0.9,*/*;q=0.8',
            'user-agent': 'LakelandHealthInsurance-SourceMonitor/1.0'
          }
        });
        probes.push({ id: label, status: response.status, finalUrl: response.url });
        if (!response.ok) issues.push(`${label}: source returned HTTP ${response.status}`);
        await response.body?.cancel();
      } catch (error) {
        issues.push(`${label}: source probe failed (${error.message})`);
      }
    }
  }

  if (registry.reviewedAt) {
    const reviewedAt = parseIsoDate(registry.reviewedAt);
    if (!reviewedAt) issues.push('reviewedAt must be YYYY-MM-DD');
    else if (dayDifference(asOfDate, reviewedAt) < 0) issues.push('reviewedAt is after as-of date');
  } else {
    issues.push('reviewedAt is missing');
  }

  return { issues, warnings, probes, controlledCandidateCount: candidateEvidenceKeys.size };
}

function parseArgs(args) {
  const parsed = { asOf: new Date().toISOString().slice(0, 10), online: false, json: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--online') parsed.online = true;
    else if (args[i] === '--json') parsed.json = true;
    else if (args[i] === '--as-of') parsed.asOf = args[++i];
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  return parsed;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  const registry = JSON.parse(readFileSync(resolve(DEFAULT_ROOT, 'data/regulated-claims.json'), 'utf8'));
  const result = await checkRegistry({ root: DEFAULT_ROOT, registry, asOf: args.asOf, online: args.online });
  if (args.json) {
    console.log(JSON.stringify({ asOf: args.asOf, online: args.online, ...result }, null, 2));
  } else if (result.issues.length) {
    console.error(`FAIL — ${result.issues.length} regulated-claim issue(s):`);
    result.issues.forEach((issue) => console.error(`  - ${issue}`));
  } else {
    console.log(`OK — ${registry.claims.length} regulated claims are current, cited, and structurally valid; ${result.controlledCandidateCount} exact candidate statement(s) are controlled${args.online ? '; primary-source probes passed' : ''}`);
  }
  if (result.issues.length) process.exit(1);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
