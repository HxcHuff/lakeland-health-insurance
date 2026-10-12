import {
  buildBlockedResponse,
  decideGeoBlock,
  isGeoBlockEnabled,
  withGeoDebugHeader,
} from './lib/geo-block-logic.mjs';

export default async (request, context) => {
  const url = new URL(request.url);
  const enabled = isGeoBlockEnabled(Netlify.env.get('GEO_BLOCK_ENABLED'));
  const countryCode = context.geo?.country?.code ?? '';
  const decision = decideGeoBlock({
    enabled,
    countryCode,
    pathname: url.pathname,
    method: request.method,
    userAgent: request.headers.get('user-agent'),
  });

  if (decision.action === 'block') {
    const blocked = buildBlockedResponse();
    return new Response(blocked.body, {
      status: blocked.status,
      headers: blocked.headers,
    });
  }

  const response = await context.next();
  return withGeoDebugHeader(response, 'allow');
};
