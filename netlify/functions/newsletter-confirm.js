'use strict';

const { completeDoubleOptIn, getContactByEmail, verifyConfirmToken } = require('./lib/newsletter-resend');
const { notifyHopperOfConfirmedSubscriber } = require('./lib/newsletter-hopper');

const PRIMARY_SITE_ORIGIN = 'https://lakelandhealthinsurance.com';

function redirectPath(status) {
  return `/newsletter/confirmed/?status=${encodeURIComponent(status)}`;
}

function redirectResponse(status, extraHeaders = {}) {
  return {
    statusCode: 302,
    headers: {
      Location: redirectPath(status),
      'Cache-Control': 'no-store',
      ...extraHeaders
    },
    body: ''
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const token = (event.queryStringParameters && event.queryStringParameters.token) || '';
  const secret = String(process.env.NEWSLETTER_CONFIRM_SECRET || '').trim();
  if (!secret) {
    return redirectResponse('unavailable');
  }

  const verified = verifyConfirmToken(token, secret);
  if (!verified.ok) {
    const status = verified.reason === 'expired' ? 'expired' : 'invalid';
    return redirectResponse(status);
  }

  const confirmed = await completeDoubleOptIn(verified.email);
  if (!confirmed.ok) {
    return redirectResponse('error');
  }

  const contactResult = await getContactByEmail(verified.email);
  const props = contactResult.ok && contactResult.contact && contactResult.contact.properties
    ? contactResult.contact.properties
    : {};
  await notifyHopperOfConfirmedSubscriber({
    email: verified.email,
    firstName: contactResult.ok ? contactResult.contact.firstName : '',
    lastName: contactResult.ok ? contactResult.contact.lastName : '',
    interest: props.lhi_interest,
    signupPage: props.lhi_signup_page,
    confirmedAt: confirmed.confirmedAt
  });

  return redirectResponse('confirmed');
};

exports._test = {
  redirectPath,
  PRIMARY_SITE_ORIGIN
};
