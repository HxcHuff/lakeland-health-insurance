import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  handler,
  pingIndexNow,
  isProductionLakelandDeploy,
  INDEXNOW_KEY
} = require('../netlify/functions/deploy-succeeded.js');

test('isProductionLakelandDeploy skips non-production contexts and hosts', () => {
  assert.equal(
    isProductionLakelandDeploy({ context: 'deploy-preview', url: 'https://deploy-preview-1--lhi.netlify.app' }, {}).ok,
    false
  );
  assert.equal(
    isProductionLakelandDeploy({ context: 'branch-deploy', url: 'https://staging--lhi.netlify.app' }, {}).ok,
    false
  );
  assert.equal(
    isProductionLakelandDeploy({ context: 'production', url: 'https://other-site.example.com' }, { LHI_SITE_ENV: 'production' }).ok,
    false
  );
  assert.equal(
    isProductionLakelandDeploy(
      { context: 'production', url: 'https://main--lhi.netlify.app', ssl_url: 'https://lakelandhealthinsurance.com' },
      { LHI_SITE_ENV: 'production' }
    ).ok,
    true
  );
});

test('pingIndexNow attaches timeout signals to sitemap GET and IndexNow POST', async () => {
  const calls = [];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset>',
    '  <url><loc>https://lakelandhealthinsurance.com/</loc><lastmod>2026-11-12</lastmod></url>',
    '  <url><loc>https://lakelandhealthinsurance.com/about/</loc><lastmod>2026-10-01</lastmod></url>',
    '</urlset>'
  ].join('\n');

  const summary = await pingIndexNow({
    payload: {
      context: 'production',
      url: 'https://lakelandhealthinsurance.com',
      published_at: '2026-11-12T15:00:00Z'
    },
    env: { LHI_SITE_ENV: 'production' },
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('/sitemap.xml')) {
        return { ok: true, status: 200, text: async () => xml };
      }
      return { ok: true, status: 200, text: async () => '' };
    }
  });

  assert.equal(summary.skipped, false);
  assert.equal(summary.ok, true);
  assert.equal(summary.mode, 'lastmod-changed');
  assert.equal(summary.submitted, 1);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].init.signal, 'expected AbortSignal on sitemap fetch');
  assert.ok(calls[1].init.signal, 'expected AbortSignal on IndexNow POST');
  const submittedBody = JSON.parse(calls[1].init.body);
  assert.equal(submittedBody.key, INDEXNOW_KEY);
  assert.deepEqual(submittedBody.urlList, ['https://lakelandhealthinsurance.com/']);
});

test('deploy-succeeded handler sets cache-control no-store and handles errors non-fatally', async () => {
  const res = await handler({ body: '{invalid-json' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.skipped, true);
  assert.equal(parsed.reason, 'handler-error');
});
