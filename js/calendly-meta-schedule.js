/*
 * Lakeland Health Insurance — booking-page Meta Schedule conversion
 *
 * Listens for Calendly event_scheduled on /book/ (the /calendly-book.html
 * destination) and sends the standard Meta event Schedule. This is advertising
 * conversion measurement, not the consent-gated website-audience PageView
 * loader in analytics.js. It never reads Calendly invitee details or form
 * fields. Automatic advanced matching stays off.
 */
(function (w, d) {
  'use strict';

  var PIXEL_ID = '1480756087079484';
  var PIXEL_SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
  var CAPI_PATH = '/api/calendly-schedule';
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

  function applyBookingFrame() {
    var frame = d.getElementById('booking-frame');
    if (!frame || !w.location || !w.location.search) return false;
    frame.src = '/book/embed' + w.location.search;
    return true;
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
    w.fbq.disablePushState = true;
    w.fbq('consent', 'grant');
    w.fbq('set', 'autoConfig', false, PIXEL_ID);
    w.fbq('init', PIXEL_ID);
    w.fbq('trackSingle', PIXEL_ID, 'PageView');

    var script = d.createElement('script');
    script.async = true;
    script.src = PIXEL_SCRIPT_SRC;
    if (d.head) d.head.appendChild(script);
    pixelQueued = true;
    return true;
  }

  function ensurePixel() {
    if (pixelQueued || typeof w.fbq === 'function') return true;
    return installFbq();
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

  function firePixel(eventId) {
    if (typeof w.fbq !== 'function') return false;
    try {
      w.fbq('trackSingle', PIXEL_ID, 'Schedule', {}, { eventID: eventId });
      return true;
    } catch (_) {
      return false;
    }
  }

  function fireCapi(eventId) {
    if (typeof w.fetch !== 'function') return false;
    try {
      w.fetch(CAPI_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        keepalive: true,
        body: JSON.stringify({
          event_name: 'Schedule',
          event_id: eventId
        })
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
    fireGtag(eventId);

    if (!isProductionHost(w.location && w.location.hostname)) {
      setStatus('recorded', 'non-production-host', { event_id: eventId, meta: false });
      return true;
    }

    var blocked = privacyBlocked();
    if (blocked) {
      setStatus('recorded', blocked, { event_id: eventId, meta: false });
      return true;
    }

    ensurePixel();
    var pixel = firePixel(eventId);
    var capi = fireCapi(eventId);
    setStatus('sent', 'schedule-conversion', {
      event_id: eventId,
      event_name: 'Schedule',
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
    ensurePixel();
    setStatus('ready', pixelQueued ? 'pixel-initialized' : 'pixel-reused');
    return true;
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
    approvedEventId: approvedEventId,
    handleScheduled: handleScheduled,
    isBookingPath: isBookingPath,
    isCalendlyOrigin: isCalendlyOrigin,
    isScheduledMessage: isScheduledMessage,
    normalizePath: normalizePath
  };

  init();
})(window, document);
