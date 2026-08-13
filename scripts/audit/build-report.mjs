#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ROOT,
  canonicalUrl,
  createFinding,
  latestEnvelope,
  loadConfig,
  makeRunId,
  parseArgs,
  readEnvelopes,
  verifyEnvelope
} from './core.mjs';

function byWindow(envelopes) {
  return [...envelopes].sort((a, b) => String(a.request.reportingWindow?.endDate || a.retrievedAt).localeCompare(String(b.request.reportingWindow?.endDate || b.retrievedAt)));
}

function reportingWindow(envelope) {
  if (envelope?.request?.complete !== true) return null;
  const { startDate, endDate } = envelope.request.reportingWindow || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || '')) return null;
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  if (new Date(start).toISOString().slice(0, 10) !== startDate || new Date(end).toISOString().slice(0, 10) !== endDate) return null;
  return { startDate, endDate, start, end, days: Math.round((end - start) / 86400000) + 1 };
}

export function comparableSearchPerformanceWindows(envelopes) {
  const distinct = new Map();
  for (const envelope of envelopes || []) {
    const window = reportingWindow(envelope);
    if (!window) continue;
    const key = `${window.startDate}:${window.endDate}`;
    const existing = distinct.get(key);
    if (!existing || String(envelope.retrievedAt).localeCompare(String(existing.envelope.retrievedAt)) > 0) {
      distinct.set(key, { envelope, window });
    }
  }
  const windows = [...distinct.values()].sort((a, b) => a.window.end - b.window.end || a.window.start - b.window.start || String(a.envelope.retrievedAt).localeCompare(String(b.envelope.retrievedAt)));
  const current = windows.at(-1);
  if (!current) return { current: null, previous: null };
  const expectedPreviousEnd = current.window.start - 86400000;
  const previous = windows.findLast((item) => item.window.end === expectedPreviousEnd && item.window.days === current.window.days);
  return { current: current.envelope, previous: previous?.envelope || null };
}

function visibilityFrom(value) {
  if (value >= 1000) return 5;
  if (value >= 250) return 4;
  if (value >= 50) return 3;
  if (value >= 10) return 2;
  return 1;
}

function aliasMap(repository, config) {
  const map = new Map();
  for (const row of repository?.payload.redirects || []) {
    if ([301, 302, 307, 308].includes(row.status) && !row.from.includes('*')) map.set(canonicalUrl(row.fromUrl, config), canonicalUrl(row.toUrl, config));
  }
  const ledger = JSON.parse(readFileSync(resolve(ROOT, 'audit/url-aliases.json'), 'utf8'));
  for (const item of ledger.aliases || []) {
    if (!item.from || !item.to || !item.evidence || !item.reviewedAt) throw new Error('Alias ledger entry lacks required evidence');
    map.set(canonicalUrl(item.from, config), canonicalUrl(item.to, config));
  }
  return map;
}

function followAlias(url, aliases, config) {
  let current = canonicalUrl(url, config);
  const seen = new Set();
  while (aliases.has(current) && !seen.has(current)) {
    seen.add(current);
    current = aliases.get(current);
  }
  return { url: current, historicalAlias: seen.size > 0, aliasChain: [...seen] };
}

export function aggregateGa4LandingRows(envelope, config, aliases = new Map()) {
  if (!envelope) return [];
  const dimension = config.ga4.landingDimension;
  const rows = new Map();
  const identity = (row) => {
    const raw = row.normalizedUrl || row[dimension];
    if (!raw || raw === '(not set)') return { key: 'unattributed:(not set)', url: null, displayUrl: '(not set)' };
    const url = followAlias(raw, aliases, config).url;
    return { key: `url:${url}`, url, displayUrl: url };
  };
  const ensure = (row) => {
    const item = identity(row);
    if (!rows.has(item.key)) rows.set(item.key, {
      url: item.url,
      displayUrl: item.displayUrl,
      reportingWindow: envelope.request.reportingWindow,
      sessions: 0,
      engagedSessions: 0,
      approvedKeyEvents: 0
    });
    return rows.get(item.key);
  };
  for (const row of envelope.payload.landingRows || []) {
    const target = ensure(row);
    target.sessions += Number(row.sessions || 0);
    target.engagedSessions += Number(row.engagedSessions || 0);
  }
  for (const row of envelope.payload.keyEventRows || []) {
    ensure(row).approvedKeyEvents += Number(row.keyEvents || 0);
  }
  return [...rows.values()];
}

function evidence(source, envelope, detail) {
  return { source, retrievedAt: envelope.retrievedAt, checksum: envelope.integrity.payloadSha256, ...detail };
}

function consolidateFindings(findings) {
  const consolidated = new Map();
  for (const finding of findings) {
    const existing = consolidated.get(finding.id);
    if (!existing) {
      consolidated.set(finding.id, structuredClone(finding));
      continue;
    }
    const evidence = [...existing.evidence, ...finding.evidence];
    existing.evidence = [...new Map(evidence.map((item) => [JSON.stringify(item), item])).values()];
    existing.verificationRequired ||= finding.verificationRequired;
    if (finding.score > existing.score) {
      existing.score = finding.score;
      existing.severity = finding.severity;
      existing.dimensions = finding.dimensions;
    }
  }
  return [...consolidated.values()];
}

export function generateFindings(inputs, config) {
  const findings = [];
  const repo = inputs.repository;
  const crawl = inputs.crawl;
  const aliases = aliasMap(repo, config);
  const pageByUrl = new Map();
  const sitemap = new Set();
  if (repo) {
    for (const page of repo.payload.pages || []) pageByUrl.set(canonicalUrl(page.url, config), page);
    for (const row of repo.payload.sitemap || []) sitemap.add(canonicalUrl(row.url, config));
    for (const validator of repo.payload.validators || []) {
      if (validator.status === 0) continue;
      const compliance = /authority|regulated/i.test(validator.command);
      findings.push(createFinding({
        ruleId: 'repository-validator-failed',
        category: compliance ? 'compliance' : 'technical',
        summary: `Existing repository control failed: ${validator.command}`,
        evidence: [evidence('repository', repo, { exitStatus: validator.status, outputSha256: repo.integrity.payloadSha256 })],
        recommendedAction: 'Review the validator output and correct the underlying source only after approval.',
        risk: compliance ? 5 : 4,
        visibility: 3,
        confidence: 1,
        recency: 1.2
      }));
    }
    for (const page of repo.payload.pages || []) {
      const url = canonicalUrl(page.url, config);
      if (page.inSitemap && page.sitemapLastmod && page.schemaDates?.length && !page.schemaDates.includes(page.sitemapLastmod)) {
        findings.push(createFinding({
          ruleId: 'date-inconsistency', category: 'metadata', url,
          summary: 'Sitemap lastmod does not match any JSON-LD dateModified value.',
          evidence: [evidence('repository', repo, { file: page.file, sitemapLastmod: page.sitemapLastmod, schemaDates: page.schemaDates, lastCommit: page.lastCommit })],
          recommendedAction: 'Reconcile against meaningful Git history; never replace dates with the run date merely to make them match.',
          verificationRequired: true, risk: 3, visibility: 2, confidence: 1, recency: 1
        }));
      }
      if (page.inSitemap && page.inboundInternalLinks === 0 && url !== `${config.site.origin}/`) {
        findings.push(createFinding({
          ruleId: 'sitemap-orphan-candidate', category: 'technical', url,
          summary: 'Sitemap page has no static inbound internal link in the repository inventory.',
          evidence: [evidence('repository', repo, { file: page.file, inboundInternalLinks: 0, inSitemap: true })],
          recommendedAction: 'Verify shared JavaScript navigation and intentional discoverability before adding a link or removing the URL.',
          verificationRequired: true, risk: 2, visibility: 2, confidence: 0.7, recency: 0.9
        }));
      }
      if (page.uncoveredClaimCandidates?.length) {
        findings.push(createFinding({
          ruleId: 'regulated-claim-registry-gap-candidate', category: 'compliance', url,
          summary: 'Numeric, price, benefit, plan-count, market, or product language lacks exact statement coverage in the regulated-claims registry.',
          evidence: [evidence('repository', repo, { file: page.file, candidateCount: page.uncoveredClaimCandidates.length, candidateFingerprints: page.uncoveredClaimCandidates.slice(0, 10) })],
          recommendedAction: 'Review each candidate and add evidence/registry coverage or document why the text is not a regulated claim. Missing coverage is not proof the claim is false.',
          verificationRequired: true, risk: 5, visibility: page.inSitemap ? 3 : 1, confidence: 0.55, recency: 1
        }));
      }
      if (page.structuredIdentityDrift?.length) {
        findings.push(createFinding({
          ruleId: 'structured-visible-identity-drift', category: 'compliance', url,
          summary: 'Structured or visible contact identity differs from the canonical authority entity record.',
          evidence: [evidence('repository', repo, { file: page.file, drift: page.structuredIdentityDrift })],
          recommendedAction: 'Verify the canonical legal/DBA record, then align JSON-LD and visible contact identity after approval.',
          verificationRequired: true, risk: 5, visibility: page.inSitemap ? 3 : 1, confidence: 1, recency: 1
        }));
      }
      const metadataProblems = [];
      if (!page.title) metadataProblems.push('missing title');
      if (!page.description) metadataProblems.push('missing description');
      if (!page.canonical) metadataProblems.push('missing canonical');
      if (page.h1Count !== 1) metadataProblems.push(`${page.h1Count} H1 elements`);
      if (page.schema?.some((item) => !item.valid)) metadataProblems.push('invalid JSON-LD');
      if (metadataProblems.length && page.inSitemap) {
        findings.push(createFinding({
          ruleId: 'repository-metadata-defect', category: 'metadata', url,
          summary: `Sitemap page metadata defect: ${metadataProblems.join(', ')}.`,
          evidence: [evidence('repository', repo, { file: page.file, problems: metadataProblems })],
          recommendedAction: 'Correct the source metadata and validate locally, in preview, and through live readback after separate deployment approval.',
          risk: 3, visibility: 2, confidence: 1, recency: 1
        }));
      }
    }
  }

  const crawlByUrl = new Map();
  if (crawl) {
    for (const row of crawl.payload.observations || []) {
      let identity;
      try { identity = followAlias(row.requestedUrl, aliases, config); } catch { identity = { url: row.requestedUrl, historicalAlias: false, aliasChain: [] }; }
      crawlByUrl.set(identity.url, row);
      if (row.kind === 'security-probe' && row.status === 200) {
        findings.push(createFinding({
          ruleId: 'public-internal-document', category: 'confidentiality', url: identity.url,
          summary: 'A security-probe path for repository-internal or operational material returned HTTP 200.',
          evidence: [evidence('live-crawl', crawl, { requestedUrl: row.requestedUrl, status: row.status, contentType: row.contentType, bodySha256: row.bodySha256 })],
          recommendedAction: 'Confirm deploy-boundary exposure, remove the artifact from the publish directory or enforce an authenticated boundary, and do not rely on robots/noindex as access control.',
          risk: 5, visibility: 1, confidence: 1, recency: 1.5
        }));
      }
      if (row.kind !== 'security-probe' && (row.error || row.status === null || row.status >= 400)) {
        findings.push(createFinding({
          ruleId: row.kind === 'asset' ? 'broken-asset' : 'broken-page-or-link', category: 'technical', url: identity.url,
          summary: `${row.kind === 'asset' ? 'Asset' : 'Page or link'} failed read-only retrieval${row.status ? ` with HTTP ${row.status}` : ''}.`,
          evidence: [evidence('live-crawl', crawl, { requestedUrl: row.requestedUrl, sourceUrl: row.sourceUrl, status: row.status, error: row.error || null, historicalAlias: identity.historicalAlias })],
          recommendedAction: 'Confirm the failure in a second live readback, locate the repository reference, then repair or remove the reference after approval.',
          risk: row.kind === 'asset' ? 3 : 4, visibility: 3, confidence: row.status ? 1 : 0.8, recency: 1.4
        }));
      }
      if (row.redirectHops?.length > 2) {
        findings.push(createFinding({
          ruleId: 'redirect-chain', category: 'technical', url: identity.url,
          summary: `URL follows a ${row.redirectHops.length - 1}-redirect chain.`,
          evidence: [evidence('live-crawl', crawl, { hops: row.redirectHops })],
          recommendedAction: 'Before changing redirects, check source links, sitemap history, Git history, Search Console, and backlink evidence.',
          verificationRequired: true, risk: 2, visibility: 2, confidence: 1, recency: 1.2
        }));
      }
      if (row.externalRedirect) {
        findings.push(createFinding({
          ruleId: 'external-redirect-target', category: 'technical', url: identity.url,
          summary: 'An internal URL redirects to an external origin; the crawler stopped at the trust boundary.',
          evidence: [evidence('live-crawl', crawl, { requestedUrl: row.requestedUrl, finalUrl: row.finalUrl, hops: row.redirectHops })],
          recommendedAction: 'Verify the destination, ownership, user expectation, and historical evidence before changing the redirect.',
          verificationRequired: true, risk: 3, visibility: 2, confidence: 1, recency: 1.2
        }));
      }
      const isCustomErrorDocument = new URL(identity.url).pathname === '/404.html' && !sitemap.has(identity.url);
      if ((row.blank200 || row.soft404) && !isCustomErrorDocument) {
        findings.push(createFinding({
          ruleId: row.blank200 ? 'blank-http-200' : 'soft-404', category: 'technical', url: identity.url,
          summary: row.blank200 ? 'HTTP 200 page has negligible visible HTML content.' : 'HTTP 200 page presents not-found signals.',
          evidence: [evidence('live-crawl', crawl, { status: row.status, visibleTextLength: row.visibleTextLength, bodySha256: row.bodySha256, soft404: row.soft404 })],
          recommendedAction: 'Run the browser-render probe to identify failed JavaScript/assets; then replace, redirect, or return 404/410 only after historical-link evidence is checked.',
          verificationRequired: true, risk: 4, visibility: 3, confidence: row.blank200 ? 0.85 : 0.9, recency: 1.4
        }));
      }
      if (row.status === 200 && row.canonical) {
        const expected = canonicalUrl(row.finalUrl, config);
        const declared = canonicalUrl(row.canonical, config);
        if (expected !== declared && !identity.historicalAlias) {
          findings.push(createFinding({
            ruleId: 'live-canonical-mismatch', category: 'indexing', url: identity.url,
            summary: 'Live canonical differs from the final fetched URL.',
            evidence: [evidence('live-crawl', crawl, { finalUrl: row.finalUrl, declaredCanonical: row.canonical })],
            recommendedAction: 'Compare repository canonical, redirects, sitemap, and Google-selected canonical before editing.',
            verificationRequired: true, risk: 3, visibility: 3, confidence: 0.95, recency: 1.3
          }));
        }
      }
      for (const form of row.forms || []) {
        const external = form.action && new URL(form.action).origin !== config.site.origin;
        if (form.error || external) {
          findings.push(createFinding({
            ruleId: 'form-target-verification', category: 'technical', url: identity.url,
            summary: form.error ? 'Form action URL is invalid.' : 'Form posts to an external origin that the crawler intentionally did not submit.',
            evidence: [evidence('live-crawl', crawl, { method: form.method, action: form.action || null, error: form.error || null, submitted: false })],
            recommendedAction: 'Verify the action endpoint, consent boundary, and non-production test procedure without submitting applicant or lead data.',
            verificationRequired: true, risk: 4, visibility: 2, confidence: 0.9, recency: 1.2
          }));
        }
      }
    }
  }

  const render = inputs.render;
  if (render) {
    for (const row of render.payload.rows || []) {
      const failed = (row.failedRequests || []).length;
      const fatal = (row.consoleErrors || []).length;
      const blank = Number(row.httpStatus) === 200 && Number(row.visibleTextLength || 0) < config.thresholds.blankVisibleTextCharacters;
      if (blank || failed || fatal) {
        findings.push(createFinding({
          ruleId: blank ? 'rendered-blank-http-200' : 'rendered-js-or-asset-failure', category: 'technical', url: canonicalUrl(row.url, config),
          summary: blank ? 'Browser-render observation confirms a blank HTTP 200 page.' : 'Browser-render observation contains console errors or failed requests.',
          evidence: [evidence('render-observation', render, { profile: row.profile || null, httpStatus: row.httpStatus, visibleTextLength: row.visibleTextLength, mainTextLength: row.mainTextLength, failedRequestCount: failed, consoleErrorCount: fatal, formCount: row.formCount || 0, formSubmissionPerformed: row.formSubmissionPerformed === true, screenshotSha256: row.screenshotSha256 || null })],
          recommendedAction: 'Trace the failed JavaScript or asset dependency in repository source and verify a local rendered correction before any deployment.',
          risk: 4, visibility: 3, confidence: 1, recency: 1.4
        }));
      }
      if (row.visualComparison?.status === 'changed') {
        findings.push(createFinding({
          ruleId: 'rendered-visual-regression', category: 'technical', url: canonicalUrl(row.url, config),
          summary: 'Rendered screenshot differs materially from the most recent matching browser observation.',
          evidence: [evidence('render-observation', render, {
            profile: row.profile || null,
            screenshotSha256: row.screenshotSha256 || null,
            baselineScreenshotSha256: row.visualComparison.baselineSha256 || null,
            baselineRetrievedAt: row.visualComparison.baselineRetrievedAt || null,
            differenceRatio: row.visualComparison.differenceRatio,
            reason: row.visualComparison.reason || null
          })],
          recommendedAction: 'Review current and baseline screenshots at the same viewport, confirm whether the change was intentional, and resolve or accept the finding before updating the visual baseline.',
          verificationRequired: true, risk: 2, visibility: 3, confidence: 0.85, recency: 1.3
        }));
      }
    }
  }

  const inspections = inputs.inspection;
  if (inspections) {
    for (const row of inspections.payload.rows || []) {
      const url = followAlias(row.inspectionUrl, aliases, config).url;
      const index = row.indexStatusResult || {};
      if (sitemap.has(url) && index.verdict && index.verdict !== 'PASS') {
        findings.push(createFinding({
          ruleId: 'sitemap-url-not-indexed', category: 'indexing', url,
          summary: `Intended sitemap URL has Google index verdict ${index.verdict}.`,
          evidence: [evidence('url-inspection', inspections, { verdict: index.verdict, coverageState: index.coverageState, indexingState: index.indexingState, pageFetchState: index.pageFetchState })],
          recommendedAction: 'Diagnose repository, crawl, robots, canonical, and content evidence. Do not submit or request indexing automatically.',
          risk: 3, visibility: 3, confidence: 1, recency: 1.3
        }));
      }
      if (!sitemap.has(url) && index.verdict === 'PASS') {
        findings.push(createFinding({
          ruleId: 'indexed-url-absent-intended-sitemap', category: 'indexing', url,
          summary: 'Google reports an indexed URL that is absent from the intended sitemap.',
          evidence: [evidence('url-inspection', inspections, { verdict: index.verdict, coverageState: index.coverageState })],
          recommendedAction: 'Determine whether this is an intentional indexable page or historical alias before changing sitemap or status.',
          verificationRequired: true, risk: 2, visibility: 2, confidence: 1, recency: 1.2
        }));
      }
      if (index.googleCanonical && index.userCanonical && canonicalUrl(index.googleCanonical, config) !== canonicalUrl(index.userCanonical, config)) {
        findings.push(createFinding({
          ruleId: 'unexpected-google-canonical', category: 'indexing', url,
          summary: 'Google-selected canonical differs from the declared user canonical.',
          evidence: [evidence('url-inspection', inspections, { googleCanonical: index.googleCanonical, userCanonical: index.userCanonical, lastCrawlTime: index.lastCrawlTime })],
          recommendedAction: 'Review duplication, redirects, internal links, sitemap, and rendered parity before changing canonical signals.',
          verificationRequired: true, risk: 3, visibility: 3, confidence: 1, recency: 1.3
        }));
      }
    }
  }

  const gscPages = byWindow(inputs.gscPages || []);
  if (gscPages.length) {
    const current = gscPages.at(-1);
    const { previous } = comparableSearchPerformanceWindows(inputs.gscPages || []);
    if (previous) {
      const previousByUrl = new Map((previous.payload.rows || []).map((row) => [followAlias(row.page, aliases, config).url, row]));
      for (const row of current.payload.rows || []) {
        const url = followAlias(row.page, aliases, config).url;
        const prior = previousByUrl.get(url);
        if (!prior) continue;
        const impressionChange = prior.impressions ? (row.impressions - prior.impressions) / prior.impressions : 0;
        const clickChange = prior.clicks ? (row.clicks - prior.clicks) / prior.clicks : 0;
        if (impressionChange <= -config.thresholds.declineFraction || clickChange <= -config.thresholds.declineFraction) {
          findings.push(createFinding({
            ruleId: 'gsc-page-decline', category: 'search-performance', url,
            summary: 'Matched Search Console page row declined versus the previous reporting window.',
            evidence: [
              evidence('gsc-page-current', current, { window: current.request.reportingWindow, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }),
              evidence('gsc-page-previous', previous, { window: previous.request.reportingWindow, clicks: prior.clicks, impressions: prior.impressions, ctr: prior.ctr, position: prior.position })
            ],
            recommendedAction: 'Inspect query mix, index/canonical state, live defects, and content history; do not infer total-site decline from top-row API data.',
            verificationRequired: current.request.populationComplete === false || previous.request.populationComplete === false,
            risk: 3, visibility: visibilityFrom(Math.max(row.impressions, prior.impressions)), confidence: 0.9, recency: 1.2
          }));
        }
      }
    }
    for (const row of current.payload.rows || []) {
      const url = followAlias(row.page, aliases, config).url;
      if (row.impressions >= config.thresholds.highImpressions && row.ctr < config.thresholds.poorCtr) {
        findings.push(createFinding({
          ruleId: 'gsc-high-impression-low-ctr-page', category: 'search-performance', url,
          summary: 'A visible Search Console page has high impressions and CTR below the configured threshold.',
          evidence: [evidence('gsc-page', current, { window: current.request.reportingWindow, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })],
          recommendedAction: 'Review matched query intent, title/snippet, canonical state, and compliance evidence before proposing page changes.',
          verificationRequired: current.request.populationComplete === false, risk: 2, visibility: visibilityFrom(row.impressions), confidence: 0.95, recency: 1.2
        }));
      }
      if (!sitemap.has(url)) {
        findings.push(createFinding({
          ruleId: 'gsc-visible-page-absent-sitemap', category: 'indexing', url,
          summary: 'Google Search visibility exists for a URL absent from the intended sitemap.',
          evidence: [evidence('gsc-page', current, { window: current.request.reportingWindow, clicks: row.clicks, impressions: row.impressions, position: row.position })],
          recommendedAction: 'Determine whether this is an intentional page or historical alias before changing sitemap, redirects, or status.',
          verificationRequired: true, risk: 2, visibility: visibilityFrom(row.impressions), confidence: 1, recency: 1.2
        }));
      }
    }
  }

  const gscQueries = byWindow(inputs.gscQueries || []);
  if (gscQueries.length) {
    const current = gscQueries.at(-1);
    const queryPageEnvelope = byWindow(inputs.gscQueryPages || []).filter((item) =>
      item.request.reportingWindow?.startDate === current.request.reportingWindow?.startDate
      && item.request.reportingWindow?.endDate === current.request.reportingWindow?.endDate
    ).at(-1);
    const drilldowns = new Map();
    for (const item of queryPageEnvelope?.payload.rows || []) {
      if (!drilldowns.has(item.query)) drilldowns.set(item.query, []);
      drilldowns.get(item.query).push(item);
    }
    const queryEvidence = (row) => {
      const mapped = (drilldowns.get(row.query) || []).sort((a, b) => b.impressions - a.impressions).slice(0, 10);
      return queryPageEnvelope && mapped.length ? [evidence('gsc-query-page', queryPageEnvelope, {
        query: row.query,
        window: queryPageEnvelope.request.reportingWindow,
        mappings: mapped.map((item) => ({ page: item.page, clicks: item.clicks, impressions: item.impressions, ctr: item.ctr, position: item.position })),
        populationComplete: queryPageEnvelope.request.populationComplete !== false
      })] : [];
    };
    for (const row of current.payload.rows || []) {
      if (!row.query || row.is_anonymized_query === true || row.is_anonymized_query === 'true') continue;
      if (row.impressions >= config.thresholds.highImpressions && row.ctr < config.thresholds.poorCtr) {
        findings.push(createFinding({
          ruleId: 'gsc-high-impression-low-ctr-query', category: 'search-performance',
          scope: row.query,
          summary: 'A visible Search Console query has high impressions and CTR below the configured threshold.',
          evidence: [evidence('gsc-query', current, { query: row.query, window: current.request.reportingWindow, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }), ...queryEvidence(row)],
          recommendedAction: queryPageEnvelope ? 'Review the collected query-by-page mappings and each mapped page title/snippet before proposing copy changes.' : 'Collect a same-window query-by-page drilldown before attributing this query or proposing copy changes.',
          verificationRequired: true, risk: 2, visibility: visibilityFrom(row.impressions), confidence: 0.9, recency: 1.2
        }));
      }
      if (row.impressions >= config.thresholds.actionableQueryMinImpressions
        && row.position >= config.thresholds.actionablePositionMin
        && row.position <= config.thresholds.actionablePositionMax) {
        findings.push(createFinding({
          ruleId: 'gsc-actionable-position-query', category: 'search-performance',
          scope: row.query,
          summary: 'A visible Search Console query is in the configured actionable position band.',
          evidence: [evidence('gsc-query', current, { query: row.query, window: current.request.reportingWindow, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }), ...queryEvidence(row)],
          recommendedAction: queryPageEnvelope ? 'Use the separate query-by-page drilldown to verify relevance and compliance evidence before a scoped content improvement.' : 'Collect a same-window query-by-page drilldown, then verify relevance and compliance evidence before a scoped content improvement.',
          verificationRequired: true, risk: 1, visibility: visibilityFrom(row.impressions), confidence: 0.9, recency: 1.1
        }));
      }
    }
  }

  const ga4Landing = byWindow(inputs.ga4Landing || []).at(-1);
  if (ga4Landing) {
    for (const row of aggregateGa4LandingRows(ga4Landing, config, aliases)) {
      if (!row.url || row.sessions < config.thresholds.trafficLandingSessions) continue;
      const url = row.url;
      const keyEvents = row.approvedKeyEvents;
      if (keyEvents === 0) {
        findings.push(createFinding({
          ruleId: 'ga4-traffic-weak-approved-events', category: 'analytics', url,
          summary: 'GA4 landing page has material sessions but no approved key events in the reporting window.',
          evidence: [evidence('ga4-landing', ga4Landing, { window: ga4Landing.request.reportingWindow, sessions: row.sessions, engagedSessions: row.engagedSessions, keyEvents })],
          recommendedAction: 'Verify event instrumentation and downstream lead evidence before changing the page or key-event configuration.',
          verificationRequired: true, risk: 3, visibility: visibilityFrom(row.sessions), confidence: 0.9, recency: 1.2
        }));
      }
      const relatedDefects = findings.filter((item) => item.url === url && ['technical', 'compliance', 'confidentiality', 'metadata', 'indexing'].includes(item.category));
      if (relatedDefects.length) {
        findings.push(createFinding({
          ruleId: 'ga4-high-traffic-page-with-defect', category: 'analytics', url,
          summary: 'A GA4 landing page with material sessions also has collected technical, compliance, or indexing findings.',
          evidence: [
            evidence('ga4-landing', ga4Landing, { window: ga4Landing.request.reportingWindow, sessions: row.sessions, engagedSessions: row.engagedSessions, keyEvents }),
            { source: 'finding-join', findingIds: relatedDefects.map((item) => item.id) }
          ],
          recommendedAction: 'Prioritize evidence review for this page; do not change analytics settings or content automatically.',
          verificationRequired: relatedDefects.some((item) => item.verificationRequired), risk: 4, visibility: visibilityFrom(row.sessions), confidence: 0.95, recency: 1.2
        }));
      }
    }
  }

  return consolidateFindings(findings).sort((a, b) => b.score - a.score || a.ruleId.localeCompare(b.ruleId));
}

function sourceChecksums(inputs) {
  return Object.fromEntries([
    ['repository', inputs.repository], ['live-crawl', inputs.crawl], ['render-observation', inputs.render], ['connector-validation', inputs.connectorValidation], ['url-inspection', inputs.inspection],
    ['gsc-page', byWindow(inputs.gscPages || []).at(-1)], ['gsc-query', byWindow(inputs.gscQueries || []).at(-1)], ['gsc-query-page', byWindow(inputs.gscQueryPages || []).at(-1)],
    ['ga4-page', byWindow(inputs.ga4Pages || []).at(-1)], ['ga4-landing', byWindow(inputs.ga4Landing || []).at(-1)]
  ].filter(([, value]) => value).map(([name, value]) => [name, { retrievedAt: value.retrievedAt, checksum: value.integrity.payloadSha256, dataset: value.dataset }]));
}

export function buildNormalizedDataset(inputs, config, runId, generatedAt) {
  const aliases = aliasMap(inputs.repository, config);
  const inverseAliases = new Map();
  for (const [from, to] of aliases) {
    if (!inverseAliases.has(to)) inverseAliases.set(to, []);
    inverseAliases.get(to).push(from);
  }
  const entities = new Map();
  const ensure = (raw) => {
    const url = followAlias(raw, aliases, config).url;
    if (!entities.has(url)) entities.set(url, {
      url,
      historicalAliases: (inverseAliases.get(url) || []).sort(),
      repository: null,
      live: null,
      searchConsolePage: null,
      urlInspection: null,
      ga4Page: null,
      ga4Landing: null,
      render: []
    });
    return entities.get(url);
  };

  for (const page of inputs.repository?.payload.pages || []) {
    ensure(page.url).repository = {
      sourceFile: page.file,
      inSitemap: page.inSitemap,
      sitemapLastmod: page.sitemapLastmod,
      inboundInternalLinks: page.inboundInternalLinks,
      canonical: page.canonical,
      noindex: /noindex/i.test(page.robots || ''),
      lastCommit: page.lastCommit,
      registeredClaimIds: page.registeredClaimIds,
      regulatedClaimCandidateCount: page.claimCandidates?.length || 0,
      uncoveredRegulatedClaimCandidateCount: page.uncoveredClaimCandidates?.length || 0,
      structuredIdentityDriftCount: page.structuredIdentityDrift?.length || 0
    };
  }
  for (const row of inputs.crawl?.payload.observations || []) {
    ensure(row.requestedUrl).live = {
      status: row.status,
      finalUrl: row.finalUrl || null,
      redirectCount: Math.max(0, (row.redirectHops?.length || 1) - 1),
      contentType: row.contentType || null,
      blank200: Boolean(row.blank200),
      soft404: Boolean(row.soft404),
      bodySha256: row.bodySha256 || null,
      fetchedAt: row.fetchedAt || null
    };
  }
  for (const row of inputs.render?.payload.rows || []) {
    ensure(row.url).render.push({
      profile: row.profile || null,
      retrievedAt: row.retrievedAt || inputs.render.retrievedAt,
      finalUrl: row.finalUrl || null,
      httpStatus: row.httpStatus,
      visibleTextLength: row.visibleTextLength,
      mainTextLength: row.mainTextLength,
      domNodeCount: row.domNodeCount,
      consoleErrorCount: row.consoleErrors?.length || 0,
      failedRequestCount: row.failedRequests?.length || 0,
      formCount: row.formCount || 0,
      formSubmissionPerformed: row.formSubmissionPerformed === true,
      screenshotSha256: row.screenshotSha256 || null,
      visualComparison: row.visualComparison || null
    });
  }
  const gscPage = byWindow(inputs.gscPages || []).at(-1);
  for (const row of gscPage?.payload.rows || []) {
    ensure(row.page).searchConsolePage = {
      reportingWindow: gscPage.request.reportingWindow,
      dataState: gscPage.request.dataState,
      populationComplete: gscPage.request.populationComplete !== false,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position
    };
  }
  for (const row of inputs.inspection?.payload.rows || []) {
    ensure(row.inspectionUrl).urlInspection = { ...row.indexStatusResult };
  }
  const ga4Page = byWindow(inputs.ga4Pages || []).at(-1);
  for (const row of ga4Page?.payload.rows || []) {
    if (!row.pageLocation) continue;
    const target = ensure(row.pageLocation);
    const prior = target.ga4Page || { reportingWindow: ga4Page.request.reportingWindow, screenPageViews: 0, sessions: 0, engagedSessions: 0, userEngagementDuration: 0 };
    for (const metric of ['screenPageViews', 'sessions', 'engagedSessions', 'userEngagementDuration']) prior[metric] += Number(row[metric] || 0);
    target.ga4Page = prior;
  }
  const ga4Landing = byWindow(inputs.ga4Landing || []).at(-1);
  for (const row of aggregateGa4LandingRows(ga4Landing, config, aliases)) {
    if (!row.url) continue;
    const target = ensure(row.url);
    target.ga4Landing = {
      reportingWindow: row.reportingWindow,
      sessions: row.sessions,
      engagedSessions: row.engagedSessions,
      approvedKeyEvents: row.approvedKeyEvents
    };
  }
  const gscQuery = byWindow(inputs.gscQueries || []).at(-1);
  const searchQueries = (gscQuery?.payload.rows || []).map((row) => ({
    reportingWindow: gscQuery.request.reportingWindow,
    dataState: gscQuery.request.dataState,
    populationComplete: gscQuery.request.populationComplete !== false,
    ...row
  }));
  const gscQueryPage = byWindow(inputs.gscQueryPages || []).at(-1);
  const searchQueryPages = (gscQueryPage?.payload.rows || []).map((row) => ({
    reportingWindow: gscQueryPage.request.reportingWindow,
    dataState: gscQueryPage.request.dataState,
    populationComplete: gscQueryPage.request.populationComplete !== false,
    ...row,
    page: followAlias(row.page, aliases, config).url
  }));
  return {
    schemaVersion: 1,
    runId,
    generatedAt,
    canonicalOrigin: config.site.origin,
    sourceChecksums: sourceChecksums(inputs),
    urlEntities: [...entities.values()].sort((a, b) => a.url.localeCompare(b.url)),
    searchQueries,
    searchQueryPages
  };
}

function table(rows, columns) {
  if (!rows.length) return '_No qualifying evidence was collected for this section._';
  const escape = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  return [
    `| ${columns.map((item) => item.label).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${columns.map((item) => escape(item.value(row))).join(' | ')} |`)
  ].join('\n');
}

export function renderWeeklyReport({ runId, generatedAt, findings, inputs, config }) {
  const urgentRank = (item) => item.category === 'confidentiality' ? 0 : item.ruleId === 'structured-visible-identity-drift' ? 1 : item.category === 'compliance' ? 2 : 3;
  const urgent = findings.filter((item) => ['confidentiality', 'compliance'].includes(item.category) || item.severity === 'critical').sort((a, b) => urgentRank(a) - urgentRank(b) || b.score - a.score || a.url?.localeCompare(b.url || '')).slice(0, 30);
  const broken = findings.filter((item) => ['technical', 'metadata', 'content-control'].includes(item.category)).slice(0, 30);
  const indexing = findings.filter((item) => item.category === 'indexing').slice(0, 30);
  const declines = findings.filter((item) => item.ruleId === 'gsc-page-decline').slice(0, 20);
  const gscCurrent = byWindow(inputs.gscPages || []).at(-1);
  const { previous: gscPrevious } = comparableSearchPerformanceWindows(inputs.gscPages || []);
  const previousMap = new Map((gscPrevious?.payload.rows || []).map((row) => [canonicalUrl(row.page, config), row]));
  const winners = (gscCurrent?.payload.rows || []).map((row) => ({ ...row, prior: previousMap.get(canonicalUrl(row.page, config)) })).filter((row) => row.prior && (row.clicks > row.prior.clicks || row.impressions > row.prior.impressions)).sort((a, b) => (b.clicks - b.prior.clicks) - (a.clicks - a.prior.clicks)).slice(0, 20);
  const showing = [...(gscCurrent?.payload.rows || [])].sort((a, b) => b.impressions - a.impressions).slice(0, 30);
  const gscQueryPageCurrent = byWindow(inputs.gscQueryPages || []).at(-1);
  const queryPages = [...(gscQueryPageCurrent?.payload.rows || [])].sort((a, b) => b.impressions - a.impressions).slice(0, 30);
  const gaCurrent = byWindow(inputs.ga4Landing || []).at(-1);
  const landings = aggregateGa4LandingRows(gaCurrent, config, aliasMap(inputs.repository, config)).sort((a, b) => b.sessions - a.sessions).slice(0, 30);
  const status = (input) => input ? `${input.retrievedAt} / ${input.integrity.payloadSha256}` : 'NOT COLLECTED';
  const allInputEnvelopes = [inputs.repository, inputs.connectorValidation, inputs.crawl, inputs.render, inputs.inspection, gscCurrent, byWindow(inputs.gscQueries || []).at(-1), gscQueryPageCurrent, byWindow(inputs.ga4Pages || []).at(-1), gaCurrent].filter(Boolean);
  allInputEnvelopes.forEach(verifyEnvelope);

  return `# Weekly Website Audit and Search Performance Report

Run: ${runId}
Generated: ${generatedAt}
Mode: read-only; no website or external service was changed.

## Evidence status

| Source | Retrieval / checksum |
| --- | --- |
| Repository | ${status(inputs.repository)} |
| Live HTTP crawl | ${status(inputs.crawl)} |
| Browser render observations | ${status(inputs.render)} |
| Connector authentication validation | ${status(inputs.connectorValidation)} |
| Search Console pages | ${status(gscCurrent)} |
| Search Console queries | ${status(byWindow(inputs.gscQueries || []).at(-1))} |
| Search Console query-by-page drilldown | ${status(gscQueryPageCurrent)} |
| URL Inspection | ${status(inputs.inspection)} |
| GA4 pages | ${status(byWindow(inputs.ga4Pages || []).at(-1))} |
| GA4 landing pages | ${status(gaCurrent)} |

Search Console clicks and impressions below are Search visibility metrics, not page views. GA4 views and sessions are site-usage metrics. Page and query datasets remain separate. Missing sources are reported as not collected; no values are inferred.

## Urgent public or compliance problems

${table(urgent, [
    { label: 'Score', value: (row) => row.score },
    { label: 'URL', value: (row) => row.url || 'site-wide' },
    { label: 'Finding', value: (row) => row.summary },
    { label: 'Verification', value: (row) => row.verificationRequired ? 'VERIFICATION REQUIRED' : 'Confirmed by collected evidence' }
  ])}

## Newly broken or inconsistent pages

${inputs.crawl && (inputs.crawlHistoryCount || 0) < 2 ? '_This is the first retained crawl, so defects are current observations rather than proven new regressions._\n\n' : ''}${table(broken, [
    { label: 'Score', value: (row) => row.score },
    { label: 'URL', value: (row) => row.url || 'site-wide' },
    { label: 'Problem', value: (row) => row.summary },
    { label: 'Action', value: (row) => row.recommendedAction }
  ])}

## Search Console winners and declines

Winners and declines require distinct, complete, contiguous, equal-length page-level windows and compare only URLs present in both. They are not total-site estimates.

${table(winners, [
    { label: 'Page', value: (row) => row.page },
    { label: 'Clicks', value: (row) => `${row.prior.clicks} -> ${row.clicks}` },
    { label: 'Impressions', value: (row) => `${row.prior.impressions} -> ${row.impressions}` },
    { label: 'Position', value: (row) => `${row.prior.position} -> ${row.position}` }
  ])}

Declines:

${table(declines, [
    { label: 'Page', value: (row) => row.url },
    { label: 'Finding', value: (row) => row.summary },
    { label: 'Verification', value: (row) => row.verificationRequired ? 'VERIFICATION REQUIRED' : 'Matched complete rows' }
  ])}

## Pages Google is showing

${table(showing, [
    { label: 'Page', value: (row) => row.page },
    { label: 'Clicks', value: (row) => row.clicks },
    { label: 'Impressions', value: (row) => row.impressions },
    { label: 'CTR', value: (row) => Number(row.ctr || 0).toFixed(4) },
    { label: 'Position', value: (row) => Number(row.position || 0).toFixed(2) }
  ])}

## Query-to-page drilldown

This is a separate top-row mapping dataset. It is not summed into the independent page or query datasets, and absent mappings are not inferred.

${table(queryPages, [
    { label: 'Query', value: (row) => row.query },
    { label: 'Page', value: (row) => row.page },
    { label: 'Clicks', value: (row) => row.clicks },
    { label: 'Impressions', value: (row) => row.impressions },
    { label: 'CTR', value: (row) => Number(row.ctr || 0).toFixed(4) },
    { label: 'Position', value: (row) => Number(row.position || 0).toFixed(2) }
  ])}

## GA4 most-viewed landing pages

${table(landings, [
    { label: 'Landing page', value: (row) => row.displayUrl },
    { label: 'Sessions', value: (row) => row.sessions },
    { label: 'Engaged sessions', value: (row) => row.engagedSessions },
    { label: 'Approved key events', value: (row) => row.approvedKeyEvents }
  ])}

## Indexing and canonical exceptions

${table(indexing, [
    { label: 'Score', value: (row) => row.score },
    { label: 'URL', value: (row) => row.url },
    { label: 'Exception', value: (row) => row.summary },
    { label: 'Action', value: (row) => row.recommendedAction }
  ])}

## Recommended actions with evidence

${table(findings.slice(0, 50), [
    { label: 'Priority', value: (row) => `${row.severity}/${row.score}` },
    { label: 'Rule', value: (row) => row.ruleId },
    { label: 'URL', value: (row) => row.url || 'site-wide' },
    { label: 'Recommendation', value: (row) => row.recommendedAction },
    { label: 'Evidence sources', value: (row) => row.evidence.map((item) => `${item.source}@${item.retrievedAt}`).join('; ') }
  ])}

## Do not change automatically

- Do not edit or publish site content, regulated claims, disclaimers, metadata, sitemap, robots, canonicals, redirects, or status codes.
- Do not deploy to preview or production, change Netlify/DNS, submit or remove URLs, or request indexing.
- Do not change Search Console bulk export, GA4 property/settings/key events, or credentials.
- Do not infer total views from Search Console, combine page/query rows, fill missing rows, or treat API top-row output as a complete population.
- Do not redirect or return 404/410 without source-link, sitemap-history, Git-history, Search Console, and backlink evidence.
- Do not treat noindex or robots.txt as access control.

Normalized observations: .audit-data/normalized/${runId}.json.
Machine findings: .audit-data/findings/${runId}.json.
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  const inputs = {
    repository: latestEnvelope(config, 'repository'),
    connectorValidation: latestEnvelope(config, 'connector-validation'),
    crawl: latestEnvelope(config, 'live-crawl'),
    crawlHistoryCount: readEnvelopes(config, 'live-crawl').length,
    inspection: latestEnvelope(config, 'url-inspection'),
    render: latestEnvelope(config, 'render-observation'),
    gscPages: readEnvelopes(config, 'gsc-page').concat(readEnvelopes(config, 'gsc-bigquery-page')),
    gscQueries: readEnvelopes(config, 'gsc-query').concat(readEnvelopes(config, 'gsc-bigquery-query')),
    gscQueryPages: readEnvelopes(config, 'gsc-query-page'),
    ga4Pages: readEnvelopes(config, 'ga4-page'),
    ga4Landing: readEnvelopes(config, 'ga4-landing')
  };
  if (!inputs.repository) throw new Error('Repository evidence missing; run collect-repository.mjs first');
  const generatedAt = new Date().toISOString();
  const runId = args['run-id'] || makeRunId(new Date(generatedAt));
  const findings = generateFindings(inputs, config);
  const outputRoot = resolve(ROOT, config.storage.root);
  const findingsDir = join(outputRoot, 'findings');
  const reportsDir = join(outputRoot, 'reports');
  const normalizedDir = join(outputRoot, 'normalized');
  mkdirSync(findingsDir, { recursive: true, mode: 0o700 });
  mkdirSync(reportsDir, { recursive: true, mode: 0o700 });
  mkdirSync(normalizedDir, { recursive: true, mode: 0o700 });
  const findingsPath = join(findingsDir, `${runId}.json`);
  const reportPath = join(reportsDir, `${runId}.md`);
  const normalizedPath = join(normalizedDir, `${runId}.json`);
  if (existsSync(findingsPath) || existsSync(reportPath) || existsSync(normalizedPath)) throw new Error(`Run ID already exists: ${runId}`);
  const normalized = buildNormalizedDataset(inputs, config, runId, generatedAt);
  const manifest = {
    schemaVersion: 1,
    runId,
    generatedAt,
    readOnly: true,
    sourceChecksums: sourceChecksums(inputs),
    findingCount: findings.length,
    findings
  };
  writeFileSync(normalizedPath, `${JSON.stringify(normalized, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  writeFileSync(findingsPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  writeFileSync(reportPath, renderWeeklyReport({ runId, generatedAt, findings, inputs, config }), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ ok: true, runId, findingCount: findings.length, normalizedPath, findingsPath, reportPath }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(`Report build failed: ${error.message}`);
    process.exit(1);
  });
}
