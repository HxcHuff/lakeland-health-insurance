import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const leadFunction = require('../netlify/functions/lead.js');

test('paid plan-review lead form requires the same bot timing evidence as get-help', async () => {
  const response = await leadFunction.handler({
    httpMethod: 'POST',
    headers: { origin: 'https://lakelandhealthinsurance.com' },
    body: JSON.stringify({
      'form-name': 'lp-aca-lead',
      zip_code: '33801'
    })
  });

  assert.equal(response.statusCode, 422);
  assert.match(response.body, /human check failed/);
});

test('lead endpoint rejects unrecognized forms before forwarding data', async () => {
  const response = await leadFunction.handler({
    httpMethod: 'POST',
    headers: { origin: 'https://lakelandhealthinsurance.com' },
    body: JSON.stringify({ 'form-name': 'not-a-site-form' })
  });

  assert.equal(response.statusCode, 422);
  assert.match(response.body, /unrecognized form/);
});

test('lead endpoint rejects explicit cross-origin requests', async () => {
  const response = await leadFunction.handler({
    httpMethod: 'OPTIONS',
    headers: { origin: 'https://example.invalid' },
    body: ''
  });

  assert.equal(response.statusCode, 403);
  assert.notEqual(response.headers['Access-Control-Allow-Origin'], '*');
});

test('email-only leads with ZIP count as a complete contact path', () => {
  const result = leadFunction._test.classifyLead({
    email: 'person@example.com',
    zip_code: '33801',
    coverage_status: 'uninsured'
  }, 'lp-aca-lead');

  assert.equal(result.level, 'high');
  assert.equal(result.reason, 'urgent_or_high_intent_with_contact_path');
});

test('paid plan-review timing values map to operational priority without exposing form answers to analytics', () => {
  const urgent = leadFunction._test.classifyLead({
    phone: '863-555-0100',
    zip_code: '33801',
    need_timing: 'Need coverage as soon as eligible'
  }, 'lp-aca-lead');
  const research = leadFunction._test.classifyLead({
    email: 'person@example.com',
    zip_code: '33801',
    need_timing: 'Researching available options'
  }, 'lp-aca-lead');

  assert.equal(urgent.level, 'high');
  assert.equal(research.level, 'research');
});

test('paid plan-review coverage interest adds routing tags without retaining the legacy ACA base tag', () => {
  const config = leadFunction._test.mailchimpConfigFor({
    normalized_intent: 'individual-family',
    line_of_business: 'individual-family',
    coverage_interest: 'TriTerm Medical'
  }, 'lp-aca-lead');

  assert.ok(config.tags.includes('plan-review'));
  assert.ok(config.tags.includes('intent-individual-family'));
  assert.ok(config.tags.includes('interest-triterm-medical'));
  assert.ok(!config.tags.includes('aca'));
});
