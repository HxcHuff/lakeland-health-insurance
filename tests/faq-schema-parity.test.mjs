import test from 'node:test';
import assert from 'node:assert/strict';
import { faqParityIssues } from '../scripts/faq-schema-parity.mjs';

function page(question, answer, visible = '') {
  return `<!doctype html><html><body>
    <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [{
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer }
      }]
    })}</script>
    <main>${visible}</main>
  </body></html>`;
}

test('accepts materially identical visible FAQ question and answer text', () => {
  const html = page(
    'Is this ACA-compliant?',
    'No — review the complete terms & limitations.',
    '<h3>Is this ACA-compliant?</h3><p>No &mdash; review the complete terms &amp; limitations.</p>'
  );
  assert.deepEqual(faqParityIssues(html), []);
});

test('rejects a hidden FAQ schema question and answer', () => {
  const issues = faqParityIssues(page('Hidden question?', 'Hidden answer.', '<p>Visible page copy.</p>'));
  assert.equal(issues.length, 2);
  assert.match(issues[0], /question is not visible/);
  assert.match(issues[1], /answer is not visible/);
});

test('rejects visible questions whose schema answer differs from visible copy', () => {
  const issues = faqParityIssues(page('Visible question?', 'Different answer.', '<h3>Visible question?</h3><p>Visible answer.</p>'));
  assert.equal(issues.length, 1);
  assert.match(issues[0], /answer is not visible/);
});
