#!/usr/bin/env node
/**
 * One-time rollout: inject lhi-lead-hero blocks, assets, and remove legacy city lead forms.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildLeadHeroHtml } from './lib/lead-hero-html.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CSS_SNIPPET = '<link rel="stylesheet" href="/css/lead-hero.css?v=20261015-v6merge">';
const JS_SNIPPET = '<script src="/js/lead-hero.js?v=20261015-v6merge" defer></script>';

const EXCLUDE_PATHS = new Set([
  '/about/',
  '/contact/',
  '/terms/',
  '/privacy-policy.html',
  '/data-deletion/',
  '/thanks.html',
  '/thank-you/',
  '/newsletter/',
  '/book/',
  '/links/',
  '/offline.html',
  '/404.html',
  '/get-help/',
  '/lp/aca/',
  '/lp/medicare/',
  '/lp/gap/',
  '/aca-health-insurance-lakeland-fl/',
  '/aca-health-insurance-agent-polk-county-fl/'
]);

const CITY_PAGES = [
  '/brandon-health-insurance/',
  '/clearwater-health-insurance/',
  '/davenport-health-insurance/',
  '/haines-city-health-insurance/',
  '/lake-alfred-health-insurance/',
  '/largo-health-insurance/',
  '/new-port-richey-health-insurance/',
  '/riverview-health-insurance/',
  '/st-petersburg-health-insurance/',
  '/tampa-health-insurance/',
  '/wesley-chapel-health-insurance/',
  '/winter-haven-health-insurance/'
];

const PRODUCT_ACA_PAGES = [
  '/accident-wise/',
  '/advantage-guard/',
  '/critical-guard/',
  '/dental-vision/',
  '/hospital-safeguard-gi/',
  '/hospital-wise/',
  '/life-insurance-dime-method/',
  '/plans/',
  '/private-medical-insurance/',
  '/supplemental-insurance/',
  '/health-protector-guard/',
  '/short-term-medical/'
];

const MEDICARE_HUB_PAGES = [
  '/medicare-broker-lakeland-fl/',
  '/medicare-part-d-lakeland-fl/',
  '/retiring-and-medicare-lakeland-fl/',
  '/working-past-65-medicare-lakeland-fl/',
  '/moving-florida-medicare/',
  '/health-insurance-broker-lakeland-fl/',
  '/provider-prescription-check/',
  '/quote/',
  '/coverage-center/',
  '/learning/'
];

const ACA_TOPIC_PAGES = [
  '/losing-coverage/',
  '/losing-medicaid-florida/',
  '/retiring-before-65-florida/',
  '/self-employed-health-insurance/',
  '/turning-26/',
  '/short-term-medical/',
  '/aca-subsidy-estimator/',
  '/marketplace-agent-fraud-cms-crackdown-florida/'
];

const STATE_ACA_PAGES = [
  '/health-insurance-texas/',
  '/health-insurance-north-carolina/',
  '/health-insurance-south-carolina/',
  '/health-insurance-tennessee/',
  '/health-insurance-alabama/',
  '/health-insurance-georgia/',
  '/states/'
];

const LOCAL_ANSWERS_MEDICARE = [
  '/local-health-insurance-answers/health-insurance-broker-lakeland-fl/',
  '/local-health-insurance-answers/lakeland-regional-unitedhealthcare-2027/',
  '/local-health-insurance-answers/watson-clinic-insurance-network-help/',
  '/local-health-insurance-answers/medicare-plan-help-lakeland/',
  '/local-health-insurance-answers/employee-losing-group-coverage/',
  '/local-health-insurance-answers/self-employed-health-insurance-polk-county/',
  '/local-health-insurance-answers/'
];

const CARRIER_PAGES = [
  '/carriers/',
  '/carriers/ambetter-aca-2026/',
  '/carriers/molina-aca-2026/',
  '/carriers/oscar-aca-2026/',
  '/carriers/unitedhealthcare-aca-2026/',
  '/carriers/wellpoint-aca-2026/',
  '/carriers/cigna-aca-2026/'
];

function walkHtml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      walkHtml(full, out);
    } else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function publicPath(file) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  if (rel.startsWith('blog/')) return `/${rel}`;
  return `/${rel}`;
}

function loadBlogTags() {
  const indexPath = join(ROOT, 'blog/index.html');
  const html = readFileSync(indexPath, 'utf8');
  const map = new Map();
  const re = /href="(\/blog\/[^"]+\.html)"[^>]*data-tags="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    map.set(m[1], m[2]);
  }
  return map;
}

function blogVariant(tags, filePath) {
  const tagBlob = String(tags || '').toLowerCase();
  const hasMedicare = /\bmedicare\b/.test(tagBlob);
  const hasAca = /\b(aca|marketplace)\b/.test(tagBlob);
  if (hasAca && !hasMedicare) return 'aca';
  if (hasMedicare && !hasAca) return 'medicare';
  if (hasMedicare && hasAca) return 'medicare';
  const name = filePath.toLowerCase();
  if (/medicare|aep|medigap|part-d|turning-65|advantage/.test(name)) return 'medicare';
  if (/aca|marketplace|cobra|subsidy|medicaid|turning-26|self-employed/.test(name)) return 'aca';
  return 'aca';
}

function pageConfig(path) {
  if (EXCLUDE_PATHS.has(path)) return null;
  if (path.startsWith('/health-protector-guard/') && path !== '/health-protector-guard/') return null;
  if (path.startsWith('/search-engine-from-zip/')) return null;

  if (path === '/') {
    return { variant: 'aca', sourceTemplate: 'homepage', funnelName: 'site_homepage_lead' };
  }
  if (CITY_PAGES.includes(path)) {
    return { variant: 'aca', sourceTemplate: 'city_page', funnelName: 'site_city_lead', removeLegacyForm: true };
  }
  if (PRODUCT_ACA_PAGES.includes(path)) {
    return { variant: 'aca', sourceTemplate: 'product_page', funnelName: 'site_product_lead' };
  }
  if (MEDICARE_HUB_PAGES.includes(path)) {
    return { variant: 'medicare', sourceTemplate: 'medicare_hub', funnelName: 'site_medicare_hub_lead' };
  }
  if (ACA_TOPIC_PAGES.includes(path)) {
    return { variant: 'aca', sourceTemplate: 'aca_topic', funnelName: 'site_aca_topic_lead' };
  }
  if (STATE_ACA_PAGES.includes(path)) {
    return { variant: 'aca', sourceTemplate: 'state_aca', funnelName: 'site_state_aca_lead' };
  }
  if (LOCAL_ANSWERS_MEDICARE.includes(path)) {
    return { variant: 'medicare', sourceTemplate: 'local_answers', funnelName: 'site_local_answers_lead' };
  }
  if (CARRIER_PAGES.includes(path)) {
    return { variant: 'aca', sourceTemplate: 'carrier_page', funnelName: 'site_carrier_lead' };
  }
  if (path.startsWith('/blog/') && path !== '/blog/index.html') {
    return { dynamic: 'blog' };
  }
  return null;
}

function idPrefixFromPath(path) {
  return path.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'siteLead';
}

function ensureAssets(html) {
  let next = html;
  if (!next.includes('lead-hero.css')) {
    next = next.replace(
      /<link rel="stylesheet" href="\/css\/fonts.css[^"]*">/,
      (m) => `${m}\n  ${CSS_SNIPPET}`
    );
  }
  if (!next.includes('lead-hero.js')) {
    if (next.includes('</body>')) {
      next = next.replace('</body>', `  ${JS_SNIPPET}\n</body>`);
    }
  }
  return next;
}

function removeLegacyCityForm(html) {
  return html.replace(/<section id="lead-form">[\s\S]*?<\/section>\s*/i, '');
}

function removeDuplicateSitelinkHeroForms(html) {
  return html.replace(
    /<form class="sitelink-lead-form"[\s\S]*?<\/form>\s*/i,
    ''
  );
}

function insertBlogLeadHero(html, heroHtml) {
  const articleHero = html.match(/<section class="article-hero"[\s\S]*?<\/section>/i);
  if (articleHero) {
    const end = articleHero.index + articleHero[0].length;
    return `${html.slice(0, end)}\n\n${heroHtml}\n\n${html.slice(end)}`;
  }
  const articleHeader = html.match(/<section class="article-header"[\s\S]*?<\/section>/i);
  if (articleHeader) {
    const headerEnd = articleHeader.index + articleHeader[0].length;
    const keyAnswer = html
      .slice(headerEnd)
      .match(/<section class="key-answer"[\s\S]*?<\/section>/i);
    const end = keyAnswer ? headerEnd + keyAnswer.index + keyAnswer[0].length : headerEnd;
    return `${html.slice(0, end)}\n\n${heroHtml}\n\n${html.slice(end)}`;
  }
  const h1 = html.match(/<h1\b[\s\S]*?<\/h1>/i);
  if (h1) {
    const afterH1 = h1.index + h1[0].length;
    const keyAnswer = html.slice(afterH1).match(/<section class="key-answer"[\s\S]*?<\/section>/i);
    const end = keyAnswer ? afterH1 + keyAnswer.index + keyAnswer[0].length : afterH1;
    return `${html.slice(0, end)}\n\n${heroHtml}\n\n${html.slice(end)}`;
  }
  return insertHero(html, heroHtml);
}

function insertHero(html, heroHtml) {
  if (html.includes('class="lhi-lead-hero"')) return html;
  const heroSection = html.match(
    /<section\b[^>]*class="[^"]*\b(?:hero|home-hero|answer-hero)\b[^"]*"[\s\S]*?<\/section>/i
  );
  if (heroSection) {
    const end = heroSection.index + heroSection[0].length;
    const shell =
      `<div class="lhi-hero-shell">\n${heroSection[0].trim()}\n\n${heroHtml.trim()}\n</div>`;
    let next = html.slice(0, heroSection.index) + shell + html.slice(end);
    next = next.replace(/<body(\s[^>]*)?>/i, (m, attrs = '') => {
      if (/class="/i.test(attrs)) {
        return m.replace(/class="([^"]*)"/, (_, classes) =>
          classes.includes('lhi-page-hero') ? m : `class="${classes} lhi-page-hero"`
        );
      }
      return `<body class="lhi-page-hero"${attrs}>`;
    });
    return next;
  }
  if (html.includes('<main')) {
    return html.replace(/<main([^>]*)>/, `<main$1>\n${heroHtml}`);
  }
  return html;
}

const blogTags = loadBlogTags();
const files = walkHtml(ROOT);
let changed = 0;

for (const file of files) {
  const path = publicPath(file);
  let cfg = pageConfig(path);
  if (!cfg) continue;

  if (cfg.dynamic === 'blog') {
    const tags = blogTags.get(path.replace(/^\//, '')) || blogTags.get(path);
    const variant = blogVariant(tags, path);
    cfg = {
      variant,
      sourceTemplate: 'blog_post',
      funnelName: variant === 'aca' ? 'site_blog_aca_lead' : 'site_blog_medicare_lead',
      removeSitelinkForm: path.includes('orlando-health-watson-clinic-insurance-2026')
    };
  }

  let html = readFileSync(file, 'utf8');
  if (html.includes('class="lhi-lead-hero"')) continue;

  const formName = cfg.variant === 'medicare' ? 'site-medicare-lead' : 'site-aca-lead';
  const heroHtml = buildLeadHeroHtml({
    variant: cfg.variant,
    formName,
    sourceTemplate: cfg.sourceTemplate,
    sourcePage: path.endsWith('.html') ? path : path,
    idPrefix: idPrefixFromPath(path),
    funnelName: cfg.funnelName
  });

  html = ensureAssets(html);
  if (cfg.removeLegacyForm) html = removeLegacyCityForm(html);
  if (cfg.removeSitelinkForm) html = removeDuplicateSitelinkHeroForms(html);
  html =
    cfg.sourceTemplate === 'blog_post'
      ? insertBlogLeadHero(html, heroHtml.trim())
      : insertHero(html, heroHtml.trim());

  writeFileSync(file, html);
  changed += 1;
  console.log('updated', path);
}

console.log(`Done. ${changed} files updated.`);
