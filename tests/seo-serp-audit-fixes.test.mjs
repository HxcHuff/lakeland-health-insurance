import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

function source(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function decode(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

const FACILITY_FILES = [
  'adventhealth-haines-city.html',
  'adventhealth-heart-of-florida-insurance.html',
  'adventhealth-lake-wales-insurance.html',
  'bartow-regional-medical-center-insurance.html',
  'baycare-behavioral-health-winter-haven.html',
  'baycare-urgent-care-haines-city.html',
  'baycare-urgent-care-lakeland.html',
  'baycare-urgent-care-winter-haven.html',
  'bond-clinic-winter-haven-insurance.html',
  'carol-jenkins-barnett-pavilion-insurance.html',
  'cassidy-cancer-center-winter-haven.html',
  'centra-care-four-corners.html',
  'centra-care-lakeland.html',
  'centra-care-winter-haven.html',
  'central-florida-health-care-polk-county.html',
  'central-florida-health-care-winter-haven.html',
  'concentra-lakeland.html',
  'dedicated-senior-medical-center-lakeland.html',
  'doctor-frostproof-fl.html',
  'doctor-mulberry-fl.html',
  'elon-health-urgent-care-davenport.html',
  'encompass-health-lakeland-insurance.html',
  'florida-cancer-specialists-davenport.html',
  'gessler-clinic-insurance.html',
  'good-shepherd-hospice-lakeland-medicare.html',
  'harrell-family-center-for-behavioral-wellness-lakeland.html',
  'hca-florida-auburndale-emergency.html',
  'hca-florida-haines-city-emergency.html',
  'hca-florida-lakeland-emergency.html',
  'hca-florida-north-lakeland-emergency.html',
  'hollis-cancer-center-lakeland-insurance.html',
  'johns-hopkins-all-childrens-lakeland-insurance.html',
  'lakeland-regional-freestanding-emergency-department.html',
  'lakeland-regional-health-insurance-accepted.html',
  'lakeland-regional-lake-wales.html',
  'lakeland-regional-urgent-care.html',
  'lakeland-va-clinic-medicare.html',
  'lakeland-volunteers-in-medicine.html',
  'lrh-physician-group-insurance.html',
  'md-now-lakeland.html',
  'owl-now-urgent-care.html',
  'palm-medical-centers-lakeland.html',
  'peace-river-center-bartow.html',
  'polk-county-health-department-clinic.html',
  'sunshine-urgent-care-lakeland.html',
  'tri-county-human-services-lakeland.html',
  'watson-clinic-urgent-care.html',
  'winter-haven-hospital-insurance.html',
  'winter-haven-womens-hospital-insurance.html'
];

const TITLE_CAP_PAGES = [
  'brandon-health-insurance/index.html',
  'clearwater-health-insurance/index.html',
  'davenport-health-insurance/index.html',
  'haines-city-health-insurance/index.html',
  'lake-alfred-health-insurance/index.html',
  'largo-health-insurance/index.html',
  'new-port-richey-health-insurance/index.html',
  'riverview-health-insurance/index.html',
  'st-petersburg-health-insurance/index.html',
  'tampa-health-insurance/index.html',
  'wesley-chapel-health-insurance/index.html',
  'winter-haven-health-insurance/index.html',
  'carriers/index.html',
  'carriers/ambetter-aca-2026/index.html',
  'carriers/molina-aca-2026/index.html',
  'carriers/oscar-aca-2026/index.html',
  'carriers/unitedhealthcare-aca-2026/index.html',
  'carriers/wellpoint-aca-2026/index.html',
  'about/index.html',
  'blog/cigna-exiting-aca-marketplace-polk-county-2026.html',
  'blog/why-florida-health-insurance-premiums-increased-2026.html',
  'blog/florida-cancer-specialists-davenport.html'
];

const REDIRECTED = [
  '/blog/aca-premiums-2026-lakeland.html',
  '/blog/florida-aca-premiums-up-31-percent-2026.html',
  '/blog/understanding-out-of-pocket-maximum.html',
  '/blog/what-to-do-when-insurance-denies-claim.html',
  '/blog/index.html'
];

test('facility posts have unique 70-160 character complete-sentence descriptions', () => {
  const seen = new Set();
  for (const file of FACILITY_FILES) {
    const html = source(`blog/${file}`);
    const desc = decode(html.match(/<meta name="description" content="([^"]*)"/)[1]);
    const og = decode(html.match(/<meta property="og:description" content="([^"]*)"/)[1]);
    const twitter = decode(html.match(/<meta name="twitter:description" content="([^"]*)"/)[1]);
    assert.equal(og, desc, file);
    assert.equal(twitter, desc, file);
    assert.ok(desc.length >= 70 && desc.length <= 160, `${file} description length ${desc.length}`);
    assert.match(desc, /[.!?]$/);
    assert.ok(!seen.has(desc), `${file} reused a facility description`);
    seen.add(desc);
  }
  assert.equal(seen.size, FACILITY_FILES.length);
});

test('facility titles stay one untruncated question across title, H1, headline, and FAQ Q1', () => {
  for (const file of FACILITY_FILES) {
    const html = source(`blog/${file}`);
    const title = decode(html.match(/<title>([^<]*)<\/title>/)[1]);
    const h1 = decode(html.match(/<h1>([^<]*)<\/h1>/)[1]);
    const headline = decode(html.match(/"headline":\s*"([^"]+)"/)[1]);
    const faq = decode(html.match(/"@type": "Question",\s*"name": "([^"]+)"/)[1]);
    assert.match(title, /\?$/);
    assert.doesNotMatch(title, /…|\.\.\./);
    assert.equal(h1, title, file);
    assert.equal(headline, title, file);
    assert.equal(faq, title, file);
    assert.ok(html.includes('<h2>Nearby facilities</h2>'), file);
  }
});

test('shortened city, carrier, and audit titles stay at or under 60 characters', () => {
  for (const rel of TITLE_CAP_PAGES) {
    const title = decode(source(rel).match(/<title>([^<]*)<\/title>/)[1]);
    assert.ok(title.length <= 60, `${rel} title length ${title.length}: ${title}`);
  }
});

test('carrier enrollment guide titles use the current plan year', () => {
  const titles = [
    ['carriers/ambetter-aca-2026/index.html', 'Ambetter ACA Plans in Florida (2027) | Enrollment Guide'],
    ['carriers/molina-aca-2026/index.html', 'Molina ACA Plans in Florida (2027) | Enrollment Guide'],
    ['carriers/oscar-aca-2026/index.html', 'Oscar ACA Plans in Florida (2027) | Enrollment Guide'],
    ['carriers/unitedhealthcare-aca-2026/index.html', 'UnitedHealthcare ACA Florida (2027) | Enrollment Guide'],
    ['carriers/wellpoint-aca-2026/index.html', 'Wellpoint ACA Plans in Florida (2027) | Enrollment Guide']
  ];

  for (const [rel, expected] of titles) {
    const html = source(rel);
    assert.equal(decode(html.match(/<title>([^<]*)<\/title>/)[1]), expected, rel);
    assert.match(html, new RegExp(`property="og:title" content="${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
    assert.match(html, new RegExp(`name="twitter:title" content="${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  }
});

test('short-term options CTA asks for current-season coverage and income', () => {
  const html = source('blog/health-insurance-too-expensive-florida-2026-short-term-options.html');
  assert.match(html, /<h2>Do not guess with 2027 coverage\.<\/h2>/);
  assert.match(html, /estimated 2027 income/);
  assert.doesNotMatch(html, /Do not guess with 2026 coverage/);
  assert.doesNotMatch(html, /estimated 2026 income/);
});

test('shared chrome uses one phone display, booking CTA, schema name, and asset version', () => {
  const answerPagesHref = '/css/answer-pages.css?v=20261008-answer-snippet-links';
  const schedulePages = [
    'blog/aca-subsidy-cliff.html',
    'blog/non-income-based-health-insurance-florida.html',
    'blog/planning-healthcare-budget-2026.html'
  ];
  const fontPages = [
    'index.html',
    'privacy-policy.html',
    'terms/index.html',
    'data-deletion/index.html'
  ];

  for (const rel of schedulePages) {
    const html = source(rel);
    assert.match(html, /href="\/book\/"[^>]*>Schedule a Plan Review/);
    assert.doesNotMatch(html, /href="\/get-help\/"[^>]*>Schedule a Plan Review/);
  }

  for (const rel of fontPages) {
    const html = source(rel);
    assert.match(html, /href="\/css\/fonts\.css"/);
    assert.match(html, /rel="icon"[^>]+href="\/favicon\.ico"[^>]+type="image\/x-icon"|rel="icon"[^>]+type="image\/x-icon"[^>]+href="\/favicon\.ico"/);
  }

  const dental = source('dental-vision/index.html');
  assert.match(dental, /"name": "Lakeland Health Insurance — Dental & Vision \(David Huff\)"/);
  assert.doesNotMatch(dental, /"name": "Lakeland Health Insurance — Dental &amp; Vision \(David Huff\)"/);
  assert.doesNotMatch(dental, /David The Insurance Dude/);

  const skip = new Set(['.git', 'node_modules', 'netlify', '.netlify', 'output', 'tests', 'scripts', 'audit', 'search-engine-from-zip']);
  const walk = (dir, files = []) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(name.name)) continue;
      const full = join(dir, name.name);
      if (name.isDirectory()) walk(full, files);
      else if (name.name.endsWith('.html')) files.push(full);
    }
    return files;
  };

  for (const file of walk(ROOT)) {
    const html = readFileSync(file, 'utf8');
    const refs = html.match(/\/css\/answer-pages\.css(?:\?[^"']*)?/g) || [];
    for (const ref of refs) {
      assert.equal(ref, answerPagesHref, `${file.slice(ROOT.length + 1)} uses ${ref}`);
    }
  }

  assert.match(source('js/chat-widget.js'), /Call Lakeland Health Insurance at \(863\) 640-3102/);
  assert.match(source('js/blog-floating-actions.js'), /Call David now at \(863\) 640-3102/);
});

test('internal links do not point at redirected URLs', () => {
  const skip = new Set(['.git', 'node_modules', 'netlify', '.netlify', 'output', 'tests', 'scripts', 'audit']);
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(name.name)) continue;
      const full = join(dir, name.name);
      if (name.isDirectory()) walk(full);
      else if (name.name.endsWith('.html') || name.name === 'site-search.js' || name.name === 'llms.txt') files.push(full);
    }
  };
  walk(ROOT);

  const issues = [];
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    for (const url of REDIRECTED) {
      const name = url.split('/').pop();
      const patterns = [
        new RegExp(`href="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
        new RegExp(`href="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`)
      ];
      if (patterns.some((pattern) => pattern.test(html)) || html.includes(`](${`https://lakelandhealthinsurance.com${url}`})`)) {
        issues.push(`${file.slice(ROOT.length + 1)} -> ${url}`);
      }
    }
  }
  assert.deepEqual(issues, []);
});

test('merged and duplicate URLs 301 in _redirects and are absent from the sitemap', () => {
  const redirects = source('_redirects');
  const sitemap = source('sitemap.xml');
  assert.match(redirects, /\/blog\/index\.html \/blog\/ 301!/);
  for (const url of REDIRECTED) {
    if (url === '/blog/index.html') continue;
    assert.match(redirects, new RegExp(`${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `));
    assert.doesNotMatch(sitemap, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(sitemap, /\/blog\/index\.html/);
});
