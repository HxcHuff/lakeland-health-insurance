import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const {
  UTM_VALUE_MAX_LENGTH,
  sanitizeCampaignAttribution,
  sanitizeCampaignToken,
  sanitizeUtmValue
} = require('../netlify/functions/lib/campaign-attribution.js');
const FUNNEL_SRC = readFileSync(resolve(__dirname, '../js/funnel.js'), 'utf8');
const GET_HELP_SRC = readFileSync(resolve(__dirname, '../js/get-help-intake.js'), 'utf8');

function loadFunnel(search = '') {
  const sandbox = {
    __LHI_TEST: true,
    __LHI_IS_PROD: false,
    crypto: globalThis.crypto,
    navigator: { userAgent: 'node-test' },
    document: {
      cookie: '',
      referrer: '',
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: () => ({ async: false, src: '', onload: null, onerror: null }),
      head: { appendChild: () => {} },
      readyState: 'complete'
    },
    location: {
      pathname: '/',
      search,
      href: `http://localhost/${search}`,
      protocol: 'http:'
    },
    URLSearchParams,
    Promise,
    Date,
    Math,
    JSON,
    Object,
    String,
    setTimeout: () => 0,
    dataLayer: [],
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    }
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(FUNNEL_SRC, sandbox, { filename: 'funnel.js' });
  return sandbox;
}

function loadGetHelpIntake(search = '') {
  const inputs = {};
  const sandbox = {
    document: {
      cookie: '',
      referrer: '',
      getElementById(id) {
        if (!inputs[id]) inputs[id] = { id, value: '', hidden: false };
        return inputs[id];
      },
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: () => {}
    },
    location: {
      pathname: '/get-help/',
      search,
      href: `https://lakelandhealthinsurance.com/get-help/${search}`,
      origin: 'https://lakelandhealthinsurance.com',
      protocol: 'https:'
    },
    URLSearchParams,
    URL,
    Date,
    JSON,
    encodeURIComponent,
    decodeURIComponent,
    btoa: (value) => Buffer.from(value).toString('base64')
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(GET_HELP_SRC, sandbox, { filename: 'get-help-intake.js' });
  sandbox.LHIGetHelpIntake.initAttribution();
  return { sandbox, inputs };
}

test('UTM sanitizer lowercases, strips unsafe characters, caps length, and drops empties', () => {
  assert.equal(UTM_VALUE_MAX_LENGTH, 64);
  assert.equal(sanitizeUtmValue('FACEBOOK'), 'facebook');
  assert.equal(sanitizeUtmValue('Retiree Spouse Tips'), 'retireespousetips');
  assert.equal(sanitizeUtmValue('retiree🎉-spouse'), 'retiree-spouse');
  assert.equal(sanitizeUtmValue('<script>alert(1)</script>'), 'scriptalert1script');
  assert.equal(sanitizeUtmValue('a'.repeat(80)), 'a'.repeat(64));
  assert.equal(sanitizeUtmValue('   '), '');
  assert.equal(sanitizeUtmValue('!!!'), '');
  assert.equal(sanitizeUtmValue(''), '');
  assert.equal(sanitizeUtmValue('jane@example.com'), '');
  assert.equal(sanitizeUtmValue('863-640-3102'), '');
  assert.equal(sanitizeUtmValue('lhi_site_retargeting_fps'), 'lhi_site_retargeting_fps');
  assert.equal(sanitizeUtmValue('florida_brand'), 'florida_brand');
  assert.equal(sanitizeUtmValue('cid_24123358247'), 'cid_24123358247');
  assert.equal(sanitizeCampaignToken('Google'), 'google');
  assert.equal(sanitizeCampaignToken('Health Insurance Lakeland', true), 'health insurance lakeland');
});

test('lead and booking attribution keep organic Facebook and paid social UTMs', () => {
  const organic = sanitizeCampaignAttribution({
    utm_source: 'Facebook',
    utm_medium: 'social',
    utm_campaign: 'Retiree Spouse Tips!',
    utm_content: 'post_a 🎉'
  });
  assert.deepEqual(organic, {
    utm_source: 'facebook',
    utm_medium: 'social',
    utm_campaign: 'retireespousetips',
    utm_content: 'post_a'
  });

  const paid = sanitizeCampaignAttribution({
    utm_source: 'facebook',
    utm_medium: 'paid_social',
    utm_campaign: 'lhi_site_retargeting_fps',
    utm_content: 'blog_education_v1'
  });
  assert.deepEqual(paid, {
    utm_source: 'facebook',
    utm_medium: 'paid_social',
    utm_campaign: 'lhi_site_retargeting_fps',
    utm_content: 'blog_education_v1'
  });

  const brand = sanitizeCampaignAttribution({
    utm_source: 'instagram',
    utm_medium: 'paid_social',
    utm_campaign: 'florida_brand',
    utm_content: 'home_brand_v1'
  });
  assert.equal(brand.utm_campaign, 'florida_brand');
  assert.equal(brand.utm_content, 'home_brand_v1');

  assert.deepEqual(sanitizeCampaignAttribution({
    utm_campaign: 'jane@example.com',
    utm_content: '<script>alert(1)</script>',
    utm_term: 'Health Insurance Lakeland'
  }), {
    utm_content: 'scriptalert1script',
    utm_term: 'health insurance lakeland'
  });
});

test('funnel cookie attribution captures sanitized organic and paid Facebook UTMs', () => {
  const organic = loadFunnel(
    '?utm_source=Facebook&utm_medium=social&utm_campaign=Retiree+Spouse+Tips&utm_content=post_topic_v1'
  ).LHI.getAttribution();
  assert.equal(organic.utm_source, 'facebook');
  assert.equal(organic.utm_medium, 'social');
  assert.equal(organic.utm_campaign, 'retireespousetips');
  assert.equal(organic.utm_content, 'post_topic_v1');

  const paid = loadFunnel(
    '?utm_source=facebook&utm_medium=paid_social&utm_campaign=lhi_site_retargeting_fps&utm_content=blog_education_v1'
  ).LHI.getAttribution();
  assert.equal(paid.utm_source, 'facebook');
  assert.equal(paid.utm_medium, 'paid_social');
  assert.equal(paid.utm_campaign, 'lhi_site_retargeting_fps');
  assert.equal(paid.utm_content, 'blog_education_v1');

  const helper = loadFunnel().LHI._t;
  assert.equal(helper.approvedCampaignValue('FACEBOOK'), 'facebook');
  assert.equal(helper.approvedCampaignValue('Retiree Spouse Tips!'), 'retireespousetips');
  assert.equal(helper.approvedCampaignValue('<script>alert(1)</script>'), 'scriptalert1script');
  assert.equal(helper.approvedCampaignValue('🎉🎉🎉'), null);
  assert.equal(helper.approvedCampaignValue('a'.repeat(80)), 'a'.repeat(64));
  assert.equal(helper.approvedCampaignValue('jane@example.com'), null);
  assert.equal(helper.approvedCampaignValue('863-640-3102'), null);
});

test('Get Help hidden fields store sanitized organic campaign values', () => {
  const { sandbox } = loadGetHelpIntake(
    '?utm_source=Facebook&utm_medium=social&utm_campaign=Retiree+Spouse+Tips&utm_content=new_creative_v2'
  );
  assert.equal(sandbox.LHIGetHelpIntake.approvedCampaignValue('Retiree Spouse Tips!'), 'retireespousetips');
  assert.equal(sandbox.LHIGetHelpIntake.approvedCampaignValue('FACEBOOK'), 'facebook');
  assert.equal(sandbox.LHIGetHelpIntake.approvedCampaignValue('jane@example.com'), '');
  assert.equal(sandbox.document.getElementById('utmSourceInput').value, 'facebook');
  assert.equal(sandbox.document.getElementById('utmMediumInput').value, 'social');
  assert.equal(sandbox.document.getElementById('utmCampaignInput').value, 'retireespousetips');
  assert.equal(sandbox.document.getElementById('utmContentInput').value, 'new_creative_v2');
});
