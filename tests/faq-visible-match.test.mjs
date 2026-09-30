import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectFaqVisibleMatchIssues,
  FAQ_MATCH_EXTRA_SKIP_RELS,
  FAQ_MATCH_SCOPE_RELS,
  FAQ_MATCH_SKIP_RELS,
  findFaqVisibleMatchIssues,
  normalizeFaqText,
  visiblePageText,
} from '../scripts/faq-visible-match.mjs';

test('normalizes FAQ whitespace and HTML entities', () => {
  assert.equal(normalizeFaqText('  What&nbsp;is&nbsp;COBRA?  '), 'What is COBRA?');
  assert.equal(normalizeFaqText('A&amp;B &#39;quote&#39;'), "A&B 'quote'");
  assert.equal(normalizeFaqText('opened on July 8, 2026 . Confirm'), 'opened on July 8, 2026. Confirm');
});

test('visible text ignores JSON-LD script blocks', () => {
  const html = `
    <h2>Visible question?</h2>
    <p>Visible answer.</p>
    <script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Hidden question?","acceptedAnswer":{"@type":"Answer","text":"Hidden answer."}}]}</script>
  `;
  const visible = visiblePageText(html);
  assert.match(visible, /Visible question\?/);
  assert.doesNotMatch(visible, /Hidden question\?/);
});

test('fails when FAQPage text is only in schema', () => {
  const html = `
    <p>Body copy only.</p>
    <script type="application/ld+json">
      {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Is COBRA the same as a Marketplace plan?","acceptedAnswer":{"@type":"Answer","text":"No. They are different contracts."}}]}
    </script>
  `;
  const issues = findFaqVisibleMatchIssues('blog/cobra-vs-marketplace-florida.html', html);
  assert.equal(issues.length, 2);
  assert.match(issues[0], /FAQPage question is not visible/);
  assert.match(issues[1], /FAQPage answer is not visible/);
});

test('passes when FAQPage text is visible after entity and whitespace normalization', () => {
  const html = `
    <h3>Can I get ACA insurance if I lost job coverage in Florida?</h3>
    <p>Yes.&nbsp;Losing job-based coverage can qualify you.</p>
    <script type="application/ld+json">
      {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Can I get ACA insurance if I lost job coverage in Florida?","acceptedAnswer":{"@type":"Answer","text":"Yes. Losing job-based coverage can qualify you."}}]}
    </script>
  `;
  assert.deepEqual(findFaqVisibleMatchIssues('blog/cobra-vs-marketplace-florida.html', html), []);
});

test('skips PR 200 conflict files and requires visible FAQ text on audited pages', () => {
  const skipped = findFaqVisibleMatchIssues(
    'blog/aca-subsidy-cliff.html',
    '<p>No FAQ.</p><script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Missing?","acceptedAnswer":{"@type":"Answer","text":"Nope."}}]}</script>'
  );
  assert.deepEqual(skipped, []);
  assert.equal(FAQ_MATCH_SKIP_RELS.size, 13);
  assert.equal(FAQ_MATCH_SCOPE_RELS, null);
  assert.ok(FAQ_MATCH_EXTRA_SKIP_RELS instanceof Set);
  const issues = collectFaqVisibleMatchIssues();
  assert.equal(issues.length, 0, issues.slice(0, 12).join('\n'));
});
