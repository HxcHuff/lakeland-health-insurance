import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClientCopy, extractHtmlCopy, findContentPolicyIssues } from '../scripts/content-policy.mjs';

const issuesFor = (html) => findContentPolicyIssues(extractHtmlCopy(html));

for (const phrase of [
  'Free Help',
  'Free Quote',
  'Free Plan Review',
  'Free licensed broker help',
  'Free Medicare review',
  'Free 15-minute consultation',
  'Free, local, licensed help',
  'Request your free personalized plan review',
  'Broker services are free',
  'Free Tips',
  'plain‑language',
  "That's it",
  'No sales pitch',
  'Medicare for Dummies',
  'How to avoid going broke'
]) {
  test(`content policy rejects ${phrase}`, () => {
    assert.ok(issuesFor(`<main><p>${phrase}</p></main>`).length > 0);
  });
}

test('content policy catches markup-split promotional copy', () => {
  assert.ok(issuesFor('<a href="/get-help/">Free Plan <span>Review</span></a>').includes('promotional free-language'));
});

test('content policy rejects standalone free and semantic substitutes in promotional elements', () => {
  assert.ok(issuesFor('<button>FREE</button>').includes('promotional free-language'));
  assert.ok(issuesFor('<a href="/get-help/">Plan review at no cost</a>').includes('promotional no-cost language'));
});

test('content policy rejects slogan and promotional-scam framing', () => {
  assert.ok(issuesFor('<h2>Honest advice</h2>').includes('honest-advice slogan'));
  assert.ok(issuesFor('<h2>Work with an honest broker</h2>').includes('honest-advice slogan'));
  assert.ok(issuesFor('<h2>An honest breakdown of your options</h2>').includes('honest-advice slogan'));
  assert.ok(issuesFor('<a href="/guide/">Avoid the scam now</a>').includes('scam-promotion framing'));
  assert.ok(issuesFor('<h3>Network reality check</h3>').includes('reality-check framing'));
  assert.ok(issuesFor('<strong>Pro Tip</strong>').includes('pro-tip framing'));
});

test('content policy rejects paragraph-level no-cost and pressure slogans', () => {
  for (const html of [
    '<p>No fees.</p>',
    '<p>No-Cost plan review.</p>',
    '<p>This review costs you nothing.</p>',
    '<p>No-pressure guidance.</p>',
    '<p>Here is what nobody tells you about coverage.</p>',
    '<p>My honest advice is to call today.</p>',
    '<p>I am an honest broker.</p>',
    '<p>Here is an honest breakdown of the options.</p>'
  ]) {
    assert.ok(issuesFor(html).length > 0, html);
  }
});

test('content policy rejects zero-dollar service marketing and frictionless slogans', () => {
  for (const html of [
    '<p>$0 / Client service fee</p>',
    '<p>Broker help costs you $0.</p>',
    '<p>Plan support with no extra cost and no extra hassle.</p>',
    '<p>No extra paperwork.</p>'
  ]) {
    assert.ok(issuesFor(html).length > 0, html);
  }
});

test('content policy rejects call-center, guesswork, universal-scope, and savings claims', () => {
  for (const html of [
    '<p>Personal help, not a 1-800 number.</p>',
    '<p>Work directly with a broker, not a call center.</p>',
    '<p>We catch mistakes that national call centers miss.</p>',
    '<p>Same premium, less guesswork.</p>',
    '<a href="/get-help/">See What You Qualify For</a>',
    '<p>You qualify for a Special Enrollment Period.</p>',
    '<p>You do qualify for subsidies.</p>',
    '<p>This service is available to everyone.</p>',
    '<p>We work with every major carrier.</p>',
    '<p>A broker can calculate your eligibility.</p>',
    '<p>This is almost always the better option.</p>',
    '<p>Silver is better than Gold at a lower price.</p>',
    '<p>A quick review could save you hundreds.</p>',
    '<p>This check guarantees savings.</p>'
  ]) {
    assert.ok(issuesFor(html).length > 0, html);
  }
});

test('content policy allows the approved direct-contact statement without weakening comparison rules', () => {
  assert.deepEqual(issuesFor('<p>This is not a call center.</p>'), []);
  assert.ok(issuesFor('<p>Work directly with a broker, not a call center.</p>').includes('call-center comparison'));
  assert.ok(issuesFor('<p>This is not a call center that ignores you.</p>').includes('call-center comparison'));
  assert.ok(issuesFor('<p>This is not a call center comparison.</p>').includes('call-center comparison'));
});

test('content policy allows qualified eligibility, scope, and savings language', () => {
  for (const html of [
    '<p>If the Marketplace determines you qualify, premium tax credits may reduce the monthly premium.</p>',
    '<p>A licensed broker can compare available plans and networks.</p>',
    '<p>Plan availability and potential savings vary; savings are not guaranteed.</p>',
    '<p>This article does not guarantee coverage or savings.</p>',
    '<p>A license does not constitute a guarantee of savings.</p>',
    '<p>Avoid guarantees of savings or outcomes.</p>',
    '<p>For official Medicare assistance, call 1-800-MEDICARE.</p>',
    '<p>Covered in-network preventive care may have no cost-sharing, subject to plan terms.</p>'
  ]) {
    assert.deepEqual(issuesFor(html), [], html);
  }
});

test('content policy rejects zero-price and zero-fee JSON-LD claims', () => {
  const offer = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Offer","price":"0.00","priceCurrency":"USD"}</script>';
  const zeroFeeOffer = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Offer","price":"No fee"}</script>';
  const priceRange = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"InsuranceAgency","priceRange":"$0"}</script>';
  assert.ok(issuesFor(offer).includes('zero-price JSON-LD Offer claim'));
  assert.ok(issuesFor(zeroFeeOffer).includes('zero-price JSON-LD Offer claim'));
  assert.ok(issuesFor(priceRange).includes('zero-fee JSON-LD priceRange claim'));
});

test('content policy allows explicit cautions about prohibited slogans', () => {
  for (const html of [
    '<p>Do not assume "no fees" means the plan has no other costs.</p>',
    '<p>Check the plan documents before assuming a visit has no cost.</p>',
    '<p>A "no-pressure" promise is not proof of plan suitability.</p>',
    '<p>The phrase "nobody tells you" is a cliché to avoid.</p>',
    '<p>An "honest broker" slogan is not proof of quality.</p>'
  ]) {
    assert.deepEqual(issuesFor(html), [], html);
  }
});

test('content policy allows neutral broker-compensation disclosures', () => {
  for (const html of [
    '<p>No fees are charged directly to consumers; brokers may be compensated by insurance carriers.</p>',
    '<p>Consumers pay no fee; insurance carriers compensate the broker.</p>',
    '<p>Licensed brokers may be compensated by insurance carriers. Using a broker does not change the plan premium.</p>'
  ]) {
    assert.deepEqual(issuesFor(html), [], html);
  }
});

test('content policy distinguishes benefit explanations from promotional benefit claims', () => {
  assert.deepEqual(issuesFor('<p>Some plans may have a $0 monthly premium; deductibles, copays, and other costs may still apply.</p>'), []);
  assert.deepEqual(issuesFor('<p>Covered in-network preventive services may have no cost-sharing, subject to plan terms.</p>'), []);
  assert.ok(issuesFor('<a href="/get-help/">Get a plan with a $0 monthly premium</a>').includes('promotional zero-premium language'));
  assert.ok(issuesFor('<p>Many residents qualify for premium subsidies, some to $0 per month.</p>').includes('promotional zero-premium range'));
  assert.ok(issuesFor('<p>Sample premium range: $0-$250 monthly.</p>').includes('promotional zero-premium range'));
  assert.ok(issuesFor('<a href="/get-help/">Unlock benefits with no-cost-sharing</a>').includes('promotional no-cost-sharing language'));
});

test('content policy allows ordinary nonzero JSON-LD pricing', () => {
  const html = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Offer","price":"125.00","priceCurrency":"USD"}</script>';
  assert.deepEqual(issuesFor(html), []);
});

test('content policy decodes numeric HTML entities', () => {
  assert.ok(issuesFor('<p>That&#8217;s it</p>').includes('that-is-it framing'));
  assert.ok(issuesFor('<p>That&#x2019;s it</p>').includes('that-is-it framing'));
});

test('content policy scans metadata and JSON-LD copy', () => {
  const html = '<meta name="description" content="Free consultation"><script type="application/ld+json">{"@context":"https://schema.org","description":"plain-language help"}</script>';
  assert.ok(issuesFor(html).length >= 2);
});

for (const phrase of [
  'premium-free Medicare Part A',
  'tax-free growth',
  'toll-free number',
  'PHI-free evidence',
  'free-text response',
  'tobacco-free for 12 months',
  '$0 plans are not free',
  'insurance is not designed to make care free'
]) {
  test(`content policy allows ${phrase}`, () => {
    assert.deepEqual(issuesFor(`<main><p>${phrase}</p></main>`), []);
  });
}

test('content policy ignores legacy wording in URLs but catches visible anchor text', () => {
  assert.deepEqual(issuesFor('<a href="/blog/medicare-for-dummies.html">Medicare enrollment guide</a>'), []);
  assert.deepEqual(issuesFor('<p>Legacy filename: medicare-for-dummies.html</p>'), []);
  assert.ok(issuesFor('<a href="/blog/medicare-for-dummies.html">Medicare for Dummies</a>').length > 0);
});

test('content policy ignores URL-looking JSON-LD values', () => {
  const html = '<script type="application/ld+json">{"@context":"https://schema.org","image":"https://example.com/medicare-for-dummies.jpg","url":"https://example.com/plain-language/"}</script>';
  assert.deepEqual(issuesFor(html), []);
});

test('client-copy extraction ignores backtick URLs and comments', () => {
  const source = 'const url = `/blog/medicare-for-dummies.html`; // plain English\nconst file = "medicare-for-dummies.html";\nconst label = "Coverage guidance";';
  assert.deepEqual(findContentPolicyIssues(extractClientCopy(source)), []);
});

test('content policy ignores HTML, CSS, and inline JavaScript comments', () => {
  const html = '<!-- <h2>No fees</h2> --><style>/* .cta::before { content: "No-Cost help"; } */</style><script>// const label = "No-pressure help";\n</script><p>Coverage guidance</p>';
  assert.deepEqual(issuesFor(html), []);
});

test('content policy scans generated CSS, templates, and inline JavaScript copy', () => {
  assert.ok(issuesFor('<style>.cta::before { content: "Free Help"; }</style>').includes('promotional free-language'));
  assert.ok(issuesFor('<template><a href="/get-help/">Free Help</a></template>').includes('promotional free-language'));
  assert.ok(issuesFor('<script>button.textContent = "Free Help";</script>').includes('promotional free-language'));
});
