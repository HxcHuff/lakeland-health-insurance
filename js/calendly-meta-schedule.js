/*
 * Lakeland Health Insurance — booking-page Meta Schedule conversion
 *
 * Listens for Calendly event_scheduled on /book/ (the /calendly-book.html
 * destination) and sends the standard Meta event Schedule plus the neutral
 * custom event booking_complete. Schedule stays on the wire so it works if
 * data-source restrictions later lift. booking_complete is the Ads Manager
 * optimization signal while Schedule is blocked. This is advertising
 * conversion measurement, not the consent-gated website-audience PageView
 * loader in analytics.js. It never reads Calendly invitee details or form
 * fields. Automatic advanced matching stays off. The booking iframe is loaded
 * from calendly.com so Calendly's booking API stays on their origin.
 */
(function (w, d) {
  'use strict';

  var PIXEL_ID = '1480756087079484';
  var PIXEL_SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
  var CAPI_PATH = '/api/calendly-schedule';
  var BOOKING_CUSTOM_EVENT = 'booking_complete';
  var BOOKING_CUSTOM_SUFFIX = 'bcomp';
  var BOOKING_EMBED_BASE = 'https://calendly.com/dhuff-healthmarkets';
  var CONSENT_KEY = 'lhi_meta_audience_consent';
  var LEGACY_OPT_OUT_KEY = 'lhi_meta_audience_opt_out';
  var PROD_HOSTS = {
    'lakelandhealthinsurance.com': true
  };
  var fired = false;
  var pixelQueued = false;

  function setStatus(state, reason, extra) {
    var status = { state: state, reason: reason };
    if (extra) {
      for (var key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) status[key] = extra[key];
      }
    }
    w.__LHI_CALENDLY_META_STATUS__ = status;
    return status;
  }

  function normalizePath(pathname) {
    var path = String(pathname || '/');
    if (path.charAt(0) !== '/') return '';
    path = path.replace(/\/index\.html$/i, '/');
    if (path !== '/' && path.charAt(path.length - 1) !== '/' && !/\.[a-z0-9]+$/i.test(path)) {
      path += '/';
    }
    return path;
  }

  function isBookingPath(pathname) {
    return normalizePath(pathname) === '/book/';
  }

  function isProductionHost(hostname) {
    return Boolean(PROD_HOSTS[String(hostname || '').toLowerCase()]);
  }

  function isCalendlyOrigin(origin, pageOrigin) {
    var value = String(origin || '');
    return value === 'https://calendly.com' || (pageOrigin && value === pageOrigin);
  }

  function isScheduledMessage(event, pageOrigin) {
    if (!event || !isCalendlyOrigin(event.origin, pageOrigin)) return false;
    var data = event.data;
    return Boolean(data && data.event === 'calendly.event_scheduled');
  }

  function readCookie(name) {
    try {
      var cookieText = String(d.cookie || '');
      var prefix = name + '=';
      var parts = cookieText.split(';');
      var matches = [];
      for (var i = 0; i < parts.length; i += 1) {
        var part = parts[i].trim();
        if (part.indexOf(prefix) === 0) matches.push(part.slice(prefix.length));
      }
      if (matches.length !== 1 || !matches[0] || matches[0].length > 128) return null;
      return decodeURIComponent(matches[0]);
    } catch (_) {
      return null;
    }
  }

  function readStorage(name) {
    try {
      if (!w.localStorage || typeof w.localStorage.getItem !== 'function') return null;
      var value = w.localStorage.getItem(name);
      return value == null ? null : String(value);
    } catch (_) {
      return null;
    }
  }

  function privacyBlocked() {
    var nav = w.navigator;
    if (nav && nav.globalPrivacyControl === true) return 'global-privacy-control';
    var signals = nav ? [nav.doNotTrack, w.doNotTrack, nav.msDoNotTrack] : [];
    for (var i = 0; i < signals.length; i += 1) {
      var signal = signals[i];
      if (signal === '1' || signal === 1 || signal === true || String(signal).toLowerCase() === 'yes') {
        return 'browser-opt-out-signal';
      }
    }
    if (readStorage(LEGACY_OPT_OUT_KEY) === '1' || readCookie(LEGACY_OPT_OUT_KEY) === '1') {
      return 'visitor-declined';
    }
    if (readStorage(CONSENT_KEY) === 'denied' || readCookie(CONSENT_KEY) === 'denied') {
      return 'visitor-declined';
    }
    return null;
  }

  function makeEventId() {
    if (w.crypto && typeof w.crypto.randomUUID === 'function') return w.crypto.randomUUID();
    return 'lhi_book_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function approvedEventId(value) {
    var text = String(value || '').trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
      return text;
    }
    if (/^lhi_book_[a-z0-9]{6,24}_[a-z0-9]{4,16}$/i.test(text)) return text;
    return null;
  }

  // Distinct event_id for booking_complete, derived from the Schedule id so
  // Pixel and CAPI share one booking prefix without colliding on dedup.
  function derivedCustomEventId(baseId, suffix) {
    var text = String(baseId || '').trim();
    var tag = String(suffix || '').toLowerCase();
    if (!/^[a-z0-9]{4,16}$/.test(tag)) return null;
    var compact;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
      compact = text.replace(/-/g, '').slice(0, 16).toLowerCase();
    } else {
      var match = text.match(/^lhi_book_([a-z0-9]{6,24})_[a-z0-9]{4,16}$/i);
      if (!match) return null;
      compact = match[1].toLowerCase();
    }
    return 'lhi_book_' + compact + '_' + tag;
  }

  var UTM_QUERY_KEYS = {
    utm_source: true,
    utm_medium: true,
    utm_campaign: true,
    utm_term: true,
    utm_content: true
  };
  var UTM_VALUE_MAX_LENGTH = 64;

  function sanitizeUtmValue(value) {
    var text = String(value || '').trim().toLowerCase();
    if (!text) return '';
    if (/^cid_\d{8,20}$/.test(text)) {
      return text.length <= UTM_VALUE_MAX_LENGTH ? text : text.slice(0, UTM_VALUE_MAX_LENGTH);
    }
    if (/@|(?:\d[\s().-]*){7,}/.test(text)) return '';
    return text.replace(/[^a-z0-9_-]/g, '').slice(0, UTM_VALUE_MAX_LENGTH);
  }

  function sanitizeBookingTerm(value) {
    var text = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!text || text.length > 80) return '';
    if (/@|(?:\d[\s().-]*){7,}/.test(text)) return '';
    return /^[a-z0-9][a-z0-9 ._~+\-]*$/.test(text) ? text : '';
  }

  function bookingEmbedUrl(hostname, search) {
    var params = [
      'embed_domain=' + encodeURIComponent(String(hostname || 'lakelandhealthinsurance.com')),
      'embed_type=Inline',
      'hide_event_type_details=1',
      'hide_gdpr_banner=1',
      'hide_landing_page_details=1'
    ];
    var extra = String(search || '');
    if (extra.charAt(0) === '?') extra = extra.slice(1);
    if (extra && typeof w.URLSearchParams === 'function') {
      var parsed = new w.URLSearchParams(extra);
      var cleaned = [];
      parsed.forEach(function (value, key) {
        if (UTM_QUERY_KEYS[key]) {
          var sanitized = key === 'utm_term' ? sanitizeBookingTerm(value) : sanitizeUtmValue(value);
          if (sanitized) cleaned.push(encodeURIComponent(key) + '=' + encodeURIComponent(sanitized));
          return;
        }
        cleaned.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
      });
      extra = cleaned.join('&');
    }
    if (extra) params.push(extra);
    return BOOKING_EMBED_BASE + '?' + params.join('&');
  }

  function applyBookingFrame() {
    var frame = d.getElementById('booking-frame');
    if (!frame || !w.location) return false;
    // Point the iframe at Calendly's origin. A same-origin 200 rewrite of
    // Calendly HTML makes their booking BFF call /api/booking/* on this host
    // and the calendar stays blank.
    frame.src = bookingEmbedUrl(w.location.hostname, w.location.search);
    return true;
  }

  function pixelHasInstance() {
    try {
      if (typeof w.fbq !== 'function' || typeof w.fbq.getState !== 'function') return false;
      var state = w.fbq.getState() || {};
      var pixels = state.pixels || [];
      for (var i = 0; i < pixels.length; i += 1) {
        if (pixels[i] && String(pixels[i].id) === PIXEL_ID) return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  function initPixelInstance() {
    w.fbq.disablePushState = true;
    w.fbq('consent', 'grant');
    w.fbq('set', 'autoConfig', false, PIXEL_ID);
    w.fbq('init', PIXEL_ID);
  }

  function adoptExistingFbq() {
    if (pixelHasInstance()) return 'pixel-reused';
    try {
      initPixelInstance();
    } catch (_) { /* GTM or another loader already owns fbq */ }
    return 'pixel-adopted';
  }

  function installFbq() {
    if (typeof w.fbq === 'function') return false;
    var queue = function () {
      if (queue.callMethod) queue.callMethod.apply(queue, arguments);
      else queue.queue.push(arguments);
    };
    w._fbq = queue;
    queue.push = queue;
    queue.loaded = true;
    queue.version = '2.0';
    queue.queue = [];
    w.fbq = queue;
    initPixelInstance();
    w.fbq('trackSingle', PIXEL_ID, 'PageView');

    var script = d.createElement('script');
    script.async = true;
    script.src = PIXEL_SCRIPT_SRC;
    if (d.head) d.head.appendChild(script);
    pixelQueued = true;
    return true;
  }

  function ensurePixel() {
    if (pixelQueued) return 'pixel-initialized';
    if (typeof w.fbq === 'function') return adoptExistingFbq();
    return installFbq() ? 'pixel-initialized' : 'pixel-unavailable';
  }

  function pixelTransportUrl(eventId, eventName) {
    return 'https://www.facebook.com/tr?id=' + encodeURIComponent(PIXEL_ID)
      + '&ev=' + encodeURIComponent(eventName || 'Schedule')
      + '&eid=' + encodeURIComponent(eventId)
      + '&noscript=1';
  }

  function firePixelTransport(eventId, eventName) {
    var url = pixelTransportUrl(eventId, eventName);
    try {
      if (typeof w.Image === 'function') {
        var probe = new w.Image(1, 1);
        probe.alt = '';
        probe.src = url;
        return true;
      }
    } catch (_) { /* fall through to a markup image */ }
    try {
      var img = d.createElement('img');
      img.alt = '';
      img.width = 1;
      img.height = 1;
      img.src = url;
      return true;
    } catch (_) {
      return false;
    }
  }

  function fireGtag(eventId) {
    if (typeof w.gtag !== 'function') return false;
    try {
      w.gtag('event', 'schedule_appointment', {
        event_category: 'conversion',
        event_label: 'booking_page',
        event_id: eventId
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  function firePixel(eventId, customEventId) {
    // Use the documented track + eventID form. Live 2026-10-05 capture:
    // trackSingle(PIXEL, 'Schedule', {}, {eventID}) incremented fbq eventCount
    // but never issued facebook.com/tr?ev=Schedule. GTM's track PageView did.
    // The image /tr with the same eid is Meta's official noscript/eventID
    // transport, so a GET still leaves if fbevents.js swallows the JS send.
    var tracked = false;
    if (typeof w.fbq === 'function') {
      try {
        w.fbq('track', 'Schedule', {}, { eventID: eventId });
        tracked = true;
      } catch (_) { /* keep going; the /tr transport still has to leave */ }
      if (customEventId) {
        try {
          w.fbq('trackCustom', BOOKING_CUSTOM_EVENT, {}, { eventID: customEventId });
        } catch (_) { /* image /tr still has to leave for the custom event */ }
      }
    }
    firePixelTransport(eventId, 'Schedule');
    if (customEventId) firePixelTransport(customEventId, BOOKING_CUSTOM_EVENT);
    return tracked;
  }

  function fireCapi(eventId, customEventId) {
    if (typeof w.fetch !== 'function') return false;
    try {
      var body = {
        event_name: 'Schedule',
        event_id: eventId
      };
      if (customEventId) body.custom_event_id = customEventId;
      w.fetch(CAPI_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        keepalive: true,
        body: JSON.stringify(body)
      }).catch(function () { /* never break the booking page */ });
      return true;
    } catch (_) {
      return false;
    }
  }

  function handleScheduled(event) {
    if (!isScheduledMessage(event, w.location && w.location.origin)) return false;
    if (fired) {
      setStatus('skipped', 'already-fired');
      return false;
    }
    fired = true;

    var eventId = makeEventId();
    var customEventId = derivedCustomEventId(eventId, BOOKING_CUSTOM_SUFFIX);
    fireGtag(eventId);

    if (!isProductionHost(w.location && w.location.hostname)) {
      setStatus('recorded', 'non-production-host', {
        event_id: eventId,
        custom_event_id: customEventId,
        meta: false
      });
      return true;
    }

    var blocked = privacyBlocked();
    if (blocked) {
      setStatus('recorded', blocked, {
        event_id: eventId,
        custom_event_id: customEventId,
        meta: false
      });
      return true;
    }

    ensurePixel();
    var pixel = firePixel(eventId, customEventId);
    var capi = fireCapi(eventId, customEventId);
    setStatus('sent', 'schedule-conversion', {
      event_id: eventId,
      event_name: 'Schedule',
      custom_event_id: customEventId,
      custom_event_name: BOOKING_CUSTOM_EVENT,
      pixel: pixel,
      capi: capi
    });
    return true;
  }

  function preparePixel() {
    if (!isProductionHost(w.location && w.location.hostname)) {
      setStatus('ready', 'non-production-host');
      return false;
    }
    var blocked = privacyBlocked();
    if (blocked) {
      setStatus('ready', blocked);
      return false;
    }
    var readyReason = ensurePixel();
    setStatus('ready', readyReason);
    return readyReason !== 'pixel-unavailable';
  }

  function init() {
    if (!w.location || !isBookingPath(w.location.pathname)) {
      setStatus('skipped', 'page-not-booking');
      return false;
    }
    applyBookingFrame();
    preparePixel();
    w.addEventListener('message', handleScheduled);
    return true;
  }

  w.__LHI_CALENDLY_META__ = {
    PIXEL_ID: PIXEL_ID,
    CAPI_PATH: CAPI_PATH,
    BOOKING_CUSTOM_EVENT: BOOKING_CUSTOM_EVENT,
    BOOKING_EMBED_BASE: BOOKING_EMBED_BASE,
    approvedEventId: approvedEventId,
    bookingEmbedUrl: bookingEmbedUrl,
    derivedCustomEventId: derivedCustomEventId,
    handleScheduled: handleScheduled,
    isBookingPath: isBookingPath,
    isCalendlyOrigin: isCalendlyOrigin,
    isScheduledMessage: isScheduledMessage,
    normalizePath: normalizePath,
    pixelTransportUrl: pixelTransportUrl
  };

  init();
})(window, document);
