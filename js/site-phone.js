(function (global) {
  'use strict';

  var canonical = Object.freeze({
    e164: '+18636403102',
    display: '(863) 640-3102',
    href: 'tel:+18636403102',
    local: '863-640-3102'
  });

  var callTracking = Object.freeze({
    e164: '+18636403102',
    display: '(863) 640-3102',
    href: 'tel:+18636403102',
    local: '863-640-3102'
  });

  global.LHIPhone = Object.freeze({
    canonical: canonical,
    callTracking: callTracking
  });
})(typeof window !== 'undefined' ? window : globalThis);
