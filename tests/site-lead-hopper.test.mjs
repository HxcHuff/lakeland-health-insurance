import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { deliverSiteLeadToHopper, SITE_LEAD_FORMS } = require('../netlify/functions/lib/site-lead-hopper.js');

test('site lead hopper posts minimized payload to quick-add', async () => {
  process.env.HOPPER_INTAKE_URL = 'https://huff-health-app.vercel.app/api/leads/quick-add';
  process.env.HOPPER_INTAKE_KEY = 'test-hopper-key';
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response('{}', { status: 200 });
  };
  const result = await deliverSiteLeadToHopper({
    form_name: 'site-aca-lead',
    name: 'Pat Example',
    first_name: 'Pat',
    last_name: 'Example',
    phone: '8635550118',
    zip: '33801',
    page_url: 'https://lakelandhealthinsurance.com/tampa-health-insurance/'
  }, { fetchImpl });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /quick-add$/);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.insuranceType, 'ACA');
  assert.equal(body.phone, '8635550118');
  assert.equal(body.source, 'lhi_site_lead_form');
  assert.equal(SITE_LEAD_FORMS.has('site-medicare-lead'), true);

  const fbResult = await deliverSiteLeadToHopper({
    form_name: 'site-medicare-lead',
    name: 'Pamela Example',
    first_name: 'Pamela',
    last_name: 'Example',
    phone: '8635550199',
    zip: '33813',
    utm_source: 'fb_ig',
    utm_medium: 'paid_social',
    utm_campaign: 'lhi_2027_polk_traffic_lpv',
    utm_content: 'watson_sunset_clean_photo_2027',
    click_id_type: 'fbclid',
    lead_channel: 'facebook',
    page_url: 'https://lakelandhealthinsurance.com/blog/watson-clinic-humana-2027.html'
  }, { fetchImpl });
  assert.equal(fbResult.ok, true);
  const fbBody = JSON.parse(calls[1].options.body);
  assert.equal(fbBody.source, 'facebook_ads');
  assert.equal(fbBody.campaign, 'lhi_2027_polk_traffic_lpv');
  assert.equal(fbBody.utmSource, 'fb_ig');
  assert.equal(fbBody.utmCampaign, 'lhi_2027_polk_traffic_lpv');
  assert.equal(fbBody.utmContent, 'watson_sunset_clean_photo_2027');
});
