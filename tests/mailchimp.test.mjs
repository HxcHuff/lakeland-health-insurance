import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const {
  MAILCHIMP_TIMEOUT_MS,
  coverageTagFromPayload,
  memberHash,
  mergeFieldsFromPayload,
  readMailchimpConfig,
  shouldAttemptMailchimpSync,
  sourceTagsForForm,
  syncToMailchimp,
  tagsForPayload
} = require('../netlify/functions/lib/mailchimp.js');
const { handler } = require('../netlify/functions/lead.js');

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SECRET_KEY = 'mc-test-secret-key-do-not-log-xyz';
const AUDIENCE_ID = 'cd34641e14';
const DC = 'us17';
const TEST_EMAIL = 'Reader.Example@Example.COM';
const TEST_HASH = createHash('md5').update('reader.example@example.com').digest('hex');

const ENV_KEYS = [
  'MAILCHIMP_API_KEY',
  'MAILCHIMP_AUDIENCE_ID',
  'MAILCHIMP_DC',
  'MAILCHIMP_SERVER_PREFIX',
  'CONTEXT',
  'LHI_SITE_ENV',
  'META_PIXEL_ID',
  'META_CAPI_ACCESS_TOKEN',
  'LEAD_FORMS_ORIGIN',
  'LEAD_ALLOWED_ORIGINS'
];
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

after(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] == null) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function configuredEnv(overrides = {}) {
  return {
    MAILCHIMP_API_KEY: SECRET_KEY,
    MAILCHIMP_AUDIENCE_ID: AUDIENCE_ID,
    MAILCHIMP_DC: DC,
    ...overrides
  };
}

function jsonResponse(status, body = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

function captureLogger() {
  const logs = [];
  return {
    logs,
    logger: {
      warn: (...args) => logs.push(['warn', ...args]),
      error: (...args) => logs.push(['error', ...args]),
      info: (...args) => logs.push(['info', ...args])
    },
    serialized() {
      return JSON.stringify(logs);
    }
  };
}

function abortingFetch() {
  return async (_url, init = {}) => new Promise((_resolve, reject) => {
    if (init.signal) {
      if (init.signal.aborted) {
        const error = new Error(`Aborted with ${SECRET_KEY}`);
        error.name = 'AbortError';
        reject(error);
        return;
      }
      init.signal.addEventListener('abort', () => {
        const error = new Error(`Aborted with ${SECRET_KEY}`);
        error.name = 'AbortError';
        reject(error);
      });
    }
  });
}

test('member hash is the md5 of the lowercased email', () => {
  assert.equal(memberHash(TEST_EMAIL), TEST_HASH);
  assert.equal(memberHash('  TEST@example.com  '), createHash('md5').update('test@example.com').digest('hex'));
  assert.equal(TEST_HASH, '34599e9fdceb9255bbac39dd824001a9');
});

test('merge fields send only first and last name', () => {
  assert.deepEqual(mergeFieldsFromPayload({
    first_name: 'Ada',
    last_name: 'Lovelace',
    phone: '8635551212',
    zip_code: '33801',
    dob: '1950-01-01',
    interest: 'Medicare'
  }), { FNAME: 'Ada', LNAME: 'Lovelace' });
  assert.deepEqual(mergeFieldsFromPayload({ full_name: 'Ada Lovelace Byron' }), {
    FNAME: 'Ada',
    LNAME: 'Lovelace Byron'
  });
});

test('source and coverage tags stay on the existing allowlist', () => {
  assert.deepEqual(sourceTagsForForm('homepage-newsletter'), ['homepage', 'newsletter']);
  assert.deepEqual(sourceTagsForForm('newsletter-signup'), ['newsletter', 'newsletter-page']);
  assert.deepEqual(sourceTagsForForm('get-help'), ['get-help', 'lead']);
  assert.deepEqual(sourceTagsForForm('lp-gap-lead'), ['lead']);
  assert.equal(coverageTagFromPayload({ interest: 'medicare' }), 'Medicare');
  assert.equal(coverageTagFromPayload({ coverage_type: 'Under 65' }), 'Under 65');
  assert.equal(coverageTagFromPayload({ line_of_business: 'Individual and Family Coverage' }), 'individual-and-family-coverage');
  assert.equal(coverageTagFromPayload({ interest: 'Life' }), 'Life');
  assert.equal(coverageTagFromPayload({ interest: 'general' }), '');
  assert.equal(coverageTagFromPayload({ coverage_type: 'Short-Term / Gap' }), '');
  assert.deepEqual(tagsForPayload({ interest: 'medicare' }, 'newsletter-signup'), [
    'newsletter',
    'newsletter-page',
    'Medicare'
  ]);
  assert.deepEqual(tagsForPayload({ line_of_business: 'Medicare' }, 'get-help'), [
    'get-help',
    'lead',
    'Medicare'
  ]);
});

test('lead forms require marketing-email consent; newsletters do not', () => {
  assert.equal(shouldAttemptMailchimpSync({
    'form-name': 'get-help',
    email: 'jane@example.com'
  }), false);
  assert.equal(shouldAttemptMailchimpSync({
    'form-name': 'get-help',
    email: 'jane@example.com',
    consent_marketing_email: 'yes'
  }), true);
  assert.equal(shouldAttemptMailchimpSync({
    'form-name': 'newsletter-signup',
    email: 'reader@example.com'
  }), true);
  assert.equal(shouldAttemptMailchimpSync({
    'form-name': 'homepage-newsletter',
    email: 'reader@example.com'
  }), true);
});

test('new members are created pending and then tagged', async () => {
  const calls = [];
  const result = await syncToMailchimp({
    'form-name': 'newsletter-signup',
    email: TEST_EMAIL,
    first_name: 'Reader',
    last_name: 'Example',
    interest: 'medicare',
    phone: '8635550100'
  }, {
    env: configuredEnv(),
    timeoutMs: 50,
    fetch: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (init.method === 'GET') return jsonResponse(404);
      return jsonResponse(200, { status: 'pending' });
    }
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, `https://us17.api.mailchimp.com/3.0/lists/${AUDIENCE_ID}/members/${TEST_HASH}`);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[1].init.method, 'PUT');
  const upsert = JSON.parse(calls[1].init.body);
  assert.equal(upsert.email_address, TEST_EMAIL);
  assert.equal(upsert.status_if_new, 'pending');
  assert.equal('status' in upsert, false);
  assert.deepEqual(upsert.merge_fields, { FNAME: 'Reader', LNAME: 'Example' });
  assert.equal(JSON.stringify(upsert).includes('8635550100'), false);
  assert.equal(calls[2].url, `${calls[0].url}/tags`);
  assert.deepEqual(JSON.parse(calls[2].init.body), {
    tags: [
      { name: 'newsletter', status: 'active' },
      { name: 'newsletter-page', status: 'active' },
      { name: 'Medicare', status: 'active' }
    ]
  });
});

test('existing subscribed members are not downgraded', async () => {
  const calls = [];
  const result = await syncToMailchimp({
    'form-name': 'get-help',
    email: 'jane@example.com',
    full_name: 'Jane Example',
    consent_marketing_email: 'yes',
    line_of_business: 'Medicare'
  }, {
    env: configuredEnv(),
    fetch: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (init.method === 'GET') return jsonResponse(200, { status: 'subscribed' });
      return jsonResponse(200, { status: 'subscribed' });
    }
  });

  assert.equal(result.ok, true);
  const upsert = JSON.parse(calls[1].init.body);
  assert.equal('status' in upsert, false);
  assert.equal('status_if_new' in upsert, false);
  assert.deepEqual(JSON.parse(calls[2].init.body).tags.map((tag) => tag.name), [
    'get-help',
    'lead',
    'Medicare'
  ]);
});

test('unsubscribed and cleaned members are not resubscribed', async () => {
  for (const status of ['unsubscribed', 'cleaned']) {
    const calls = [];
    const result = await syncToMailchimp({
      'form-name': 'newsletter-signup',
      email: 'former@example.com',
      first_name: 'Former'
    }, {
      env: configuredEnv(),
      fetch: async (url, init = {}) => {
        calls.push({ url: String(url), init });
        return jsonResponse(200, { status });
      }
    });
    assert.equal(result.ok, false);
    assert.equal(result.skipped, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.method, 'GET');
  }
});

test('lead forms make no Mailchimp call without consent', async () => {
  const calls = [];
  const result = await syncToMailchimp({
    'form-name': 'get-help',
    email: 'jane@example.com',
    consent_marketing_email: ''
  }, {
    env: configuredEnv(),
    fetch: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return jsonResponse(200);
    }
  });
  assert.equal(result.skipped, true);
  assert.equal(calls.length, 0);
});

test('unset API key skips with a one-line warning and never logs the key', async () => {
  const { logger, serialized } = captureLogger();
  const calls = [];
  const result = await syncToMailchimp({
    'form-name': 'newsletter-signup',
    email: 'reader@example.com'
  }, {
    env: { MAILCHIMP_AUDIENCE_ID: AUDIENCE_ID, MAILCHIMP_DC: DC },
    logger,
    fetch: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return jsonResponse(200);
    }
  });
  assert.equal(result.skipped, true);
  assert.equal(calls.length, 0);
  assert.equal(logger.logs.length, 1);
  assert.equal(logger.logs[0][0], 'warn');
  assert.match(String(logger.logs[0][1]), /MAILCHIMP_API_KEY is unset/);
  assert.equal(serialized().includes(SECRET_KEY), false);
});

test('API key never appears in Mailchimp errors or logs', async () => {
  const { logger, serialized } = captureLogger();
  const result = await syncToMailchimp({
    'form-name': 'newsletter-signup',
    email: 'reader@example.com'
  }, {
    env: configuredEnv(),
    logger,
    fetch: async () => {
      throw new Error(`upstream failed ${SECRET_KEY}`);
    }
  });
  assert.equal(result.ok, false);
  assert.equal(String(result.error).includes(SECRET_KEY), false);
  assert.equal(serialized().includes(SECRET_KEY), false);
});

test('Mailchimp 500 and timeout fail open', async () => {
  const failed = await syncToMailchimp({
    'form-name': 'newsletter-signup',
    email: 'reader@example.com'
  }, {
    env: configuredEnv(),
    fetch: async () => jsonResponse(500, { title: 'Server Error' })
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.error, 'MC lookup 500');

  const timedOut = await syncToMailchimp({
    'form-name': 'newsletter-signup',
    email: 'reader@example.com'
  }, {
    env: configuredEnv(),
    timeoutMs: 20,
    fetch: abortingFetch()
  });
  assert.equal(timedOut.ok, false);
  assert.equal(timedOut.error, 'Mailchimp timeout');
});

test('readMailchimpConfig prefers MAILCHIMP_DC and never returns a logged secret helper', () => {
  assert.deepEqual(readMailchimpConfig({
    MAILCHIMP_API_KEY: SECRET_KEY,
    MAILCHIMP_AUDIENCE_ID: AUDIENCE_ID,
    MAILCHIMP_DC: DC,
    MAILCHIMP_SERVER_PREFIX: 'us12'
  }), { apiKey: SECRET_KEY, audienceId: AUDIENCE_ID, dc: DC });
  assert.equal(readMailchimpConfig({
    MAILCHIMP_SERVER_PREFIX: 'us12'
  }).dc, 'us12');
});

function getHelpPayload(overrides = {}) {
  const startedAt = Date.now() - 2_000;
  return {
    'form-name': 'get-help',
    started_at: String(startedAt),
    human_check: Buffer.from(`${startedAt}:lakeland-human`).toString('base64'),
    full_name: 'Jane Example',
    phone: '863-555-1212',
    email: 'jane@example.com',
    zip_code: '33801',
    consent_request: 'yes',
    consent_call: 'yes',
    source_page: '/get-help/',
    ...overrides
  };
}

async function invokeLead(payload, { mailchimpStatus = 200, memberStatus = 'pending', hang = false } = {}) {
  const calls = [];
  const logs = [];
  const originalFetch = global.fetch;
  const originalConsole = {
    info: console.info,
    warn: console.warn,
    error: console.error
  };
  process.env.CONTEXT = 'production';
  process.env.LHI_SITE_ENV = 'production';
  process.env.META_PIXEL_ID = '1480756087079484';
  process.env.META_CAPI_ACCESS_TOKEN = 'test-token';
  process.env.LEAD_FORMS_ORIGIN = 'https://lakelandhealthinsurance.com';
  process.env.LEAD_ALLOWED_ORIGINS = 'https://lakelandhealthinsurance.com';
  process.env.MAILCHIMP_API_KEY = SECRET_KEY;
  process.env.MAILCHIMP_AUDIENCE_ID = AUDIENCE_ID;
  process.env.MAILCHIMP_DC = DC;

  global.fetch = async (url, init = {}) => {
    const href = String(url);
    calls.push({ url: href, init });
    if (href.includes('api.mailchimp.com')) {
      if (hang) return abortingFetch()(href, { ...init, signal: AbortSignal.timeout(1) }).catch((error) => {
        error.name = 'AbortError';
        throw error;
      });
      if (mailchimpStatus >= 500) return jsonResponse(mailchimpStatus);
      if (init.method === 'GET') return jsonResponse(200, { status: memberStatus });
      return jsonResponse(200, { status: memberStatus });
    }
    return { ok: true, status: 200 };
  };
  console.info = (...args) => logs.push(['info', ...args]);
  console.warn = (...args) => logs.push(['warn', ...args]);
  console.error = (...args) => logs.push(['error', ...args]);

  try {
    const response = await handler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://lakelandhealthinsurance.com',
        referer: 'https://lakelandhealthinsurance.com/get-help/'
      },
      body: JSON.stringify(payload)
    });
    return { response, calls, logs };
  } finally {
    global.fetch = originalFetch;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }
}

test('lead handler does not call Mailchimp without marketing consent', async () => {
  const { response, calls } = await invokeLead(getHelpPayload());
  const result = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(result.ok, true);
  assert.equal(result.forms, true);
  assert.equal(result.mailchimp, false);
  assert.equal(calls.some((call) => call.url.includes('api.mailchimp.com')), false);
});

test('lead handler stays 200 when Mailchimp returns 500', async () => {
  const { response, calls, logs } = await invokeLead(getHelpPayload({
    consent_marketing_email: 'yes'
  }), { mailchimpStatus: 500 });
  const result = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(result.ok, true);
  assert.equal(result.forms, true);
  assert.equal(result.mailchimp, false);
  assert.equal(calls.some((call) => call.url.includes('api.mailchimp.com')), true);
  assert.equal(JSON.stringify(logs).includes(SECRET_KEY), false);
  assert.equal(JSON.stringify(result).includes(SECRET_KEY), false);
});

test('sitelink and gap forms expose an optional unchecked marketing checkbox', () => {
  const files = [
    'blog/index.html',
    'carriers/index.html',
    'dental-vision/index.html',
    'medicare/index.html',
    'plans/index.html',
    'private-medical-insurance/index.html',
    'supplemental-insurance/index.html',
    'lp/gap/index.html'
  ];
  for (const rel of files) {
    const html = readFileSync(resolve(ROOT, rel), 'utf8');
    assert.match(html, /name="consent_marketing_email" value="yes"/, rel);
    assert.doesNotMatch(html, /name="consent_marketing_email"[^>]*\brequired\b/, rel);
    assert.doesNotMatch(html, /name="consent_marketing_email"[^>]*\bchecked\b/, rel);
    assert.match(html, /Email me Lakeland Health Insurance tips and updates\. Unsubscribe anytime\./, rel);
  }
});

test('timeout helper stays at about three seconds', () => {
  assert.equal(MAILCHIMP_TIMEOUT_MS, 3000);
});
