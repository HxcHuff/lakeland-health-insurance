/*
 * Lakeland Health Insurance — Funnel Event Bus
 * Single source of truth for GA4 + Supabase event tracking.
 *
 * Fires simultaneously to:
 *   - Google Tag Manager (GTM-W6MZ7XT6)
 *   - Supabase funnel_events table (via publishable key)
 *
 * Usage:
 *   window.LHI.track('Lead', { content_name: 'lp_aca_lead_form' });
 *   window.LHI.identify({ zip: '33801', line: 'ACA' });
 *
 * Event ownership and definitions live in /FUNNEL-EVENT-DICTIONARY.md.
 */
(function (w, d) {
  'use strict';

  var SUPABASE_URL = 'https://cdlrpthlmvyksfljlfik.supabase.co';
  var SUPABASE_ANON = 'sb_publishable_4iawXiwpNvk04SziN4Bs5w_ECZ7qRPl';
  var TABLE = 'funnel_events';

  /* Google Ads "Submit lead form" conversion. Fires for every Lead event
     across the site so Smart Bidding gets a cost-per-lead signal. Paired
     with allow_enhanced_conversions=true in analytics.js for hashed-PII
     match-back via gtag.set('user_data'). */
  var LEAD_CONVERSION_SEND_TO = 'AW-300112445/hChjCJvYraUcEL20jY8B';

  /* Business-input surface for Google Ads conversion values.
     Values remain 0 until David supplies authoritative lead economics or
     approved relative values. This preserves count-based conversion tracking
     without implying value-based bidding is configured. */
  var LEAD_VALUE_BY_PAGE_TYPE = {
    lp_medicare: 0,
    local_seo_medicare: 0,
    lp_aca: 0,
    local_seo_aca: 0,
    coverage_change: 0,
    estimator: 0,
    lp_gap: 0,
    guard_lp: 0,
    dime_method: 0,
    get_help: 0,
    provider_network: 0,
    turning_65: 0,
    aging_off_26: 0,
    client_review: 0,
    post_enrollment: 0,
    self_employed: 0,
    employer_offboarding: 0,
    guide_optin: 0,
    newsletter: 0,
    booking: 0,
    'default': 0
  };

  function leadValueFor(pt) {
    if (LEAD_VALUE_BY_PAGE_TYPE.hasOwnProperty(pt)) return LEAD_VALUE_BY_PAGE_TYPE[pt];
    return LEAD_VALUE_BY_PAGE_TYPE['default'] || 0;
  }

  /* SHA-256 helper. Returns a Promise<string> of the lowercase hex digest.
     Used for Google Enhanced Conversions and Supabase event hygiene. */
  function sha256(str) {
    if (!str) return Promise.resolve(null);
    var s = String(str).trim().toLowerCase();
    var buf = new TextEncoder().encode(s);
    return crypto.subtle.digest('SHA-256', buf).then(function (hashBuf) {
      var bytes = new Uint8Array(hashBuf);
      var hex = '';
      for (var i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }
      return hex;
    });
  }

  /* Normalize phone: digits only, prepend US country code if missing. */
  function normPhone(p) {
    if (!p) return null;
    var d = String(p).replace(/\D/g, '');
    if (d.length === 10) d = '1' + d;
    return d || null;
  }

  /* eventID generator — used for conversion transaction IDs and event audit trails. */
  function makeEventID() {
    return 'lhi_' + Date.now() + '_' + Math.random().toString(36).slice(2, 12);
  }

  function routePath() {
    var p = (w.location.pathname || '/').toLowerCase();
    p = p.replace(/\/index\.html$/, '/');
    if (p.length > 1) p = p.replace(/\/$/, '');
    return p || '/';
  }

  function hasAny(p, terms) {
    for (var i = 0; i < terms.length; i++) {
      if (p.indexOf(terms[i]) !== -1) return true;
    }
    return false;
  }

  function pageType() {
    var p = routePath();
    if (p === '/' || p === '/index.html') return 'home';
    if (p === '/thanks' || p === '/thanks.html') return 'conversion';
    if (p === '/calendly-book' || p === '/calendly-book.html') return 'booking';
    if (p === '/newsletter') return 'newsletter';
    if (p.indexOf('/lp/aca') === 0) return 'lp_aca';
    if (p.indexOf('/lp/medicare') === 0) return 'lp_medicare';
    if (p.indexOf('/lp/gap') === 0) return 'coverage_change';
    if (hasAny(p, ['coverage-change-checkup', 'lost-job-health-insurance', 'life-change-health-insurance', 'coverage-loss', 'cobra', 'job-loss'])) return 'coverage_change';
    if (hasAny(p, ['provider-prescription-check', 'orlando-health-watson-clinic', 'watson-clinic', 'provider-network', 'network-check'])) return 'provider_network';
    if (hasAny(p, ['turning-65', 'age-65', 'medicare-for-dummies'])) return 'turning_65';
    if (hasAny(p, ['aging-off-26', 'turning-26', 'college-student-health-insurance'])) return 'aging_off_26';
    if (hasAny(p, ['client-review', 'annual-review', 'plan-review'])) return 'client_review';
    if (hasAny(p, ['post-enrollment', '30-day-checkup'])) return 'post_enrollment';
    if (hasAny(p, ['self-employed-income-checkup', 'freelancer-health-insurance', 'self-employed'])) return 'self_employed';
    if (hasAny(p, ['employer-offboarding', 'cobra-checkup'])) return 'employer_offboarding';
    if (p.indexOf('/carriers/') === 0) return 'carrier_lp';
    if (p.indexOf('/aca-subsidy-estimator') === 0) return 'estimator';
    if (p.indexOf('/get-help') === 0) return 'get_help';
    if (p.indexOf('/health-protector-guard') === 0) return 'guard_lp';
    if (p.indexOf('/aca-health-insurance-lakeland') === 0) return 'local_seo_aca';
    if (p.indexOf('/medicare-broker-lakeland') === 0) return 'local_seo_medicare';
    if (p.indexOf('/best-medicare-broker-lakeland') === 0) return 'local_seo_medicare';
    if (p.indexOf('/medicare/east-polk') === 0) return 'local_seo_medicare';
    if (p.indexOf('/medicare') === 0) return 'lp_medicare';
    if (p.indexOf('/life-insurance-dime') === 0) return 'dime_method';
    if (p.indexOf('/download-free-guide') === 0) return 'guide_optin';
    if (p.indexOf('/blog/') === 0) return 'blog';
    return 'site';
  }

  // Session + attribution -------------------------------------------------
  function uuid() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function (c) {
      return (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16);
    });
  }

  function cookie(name, val, days) {
    if (arguments.length >= 2) {
      var exp = '';
      if (days) {
        var dt = new Date();
        dt.setTime(dt.getTime() + days * 86400000);
        exp = '; expires=' + dt.toUTCString();
      }
      d.cookie = name + '=' + encodeURIComponent(val) + exp + '; path=/; SameSite=Lax';
      return val;
    }
    var match = d.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function getSession() {
    return cookie('lhi_sid') || cookie('lhi_sid', uuid(), 365);
  }

  function getAttribution() {
    var qs = new URLSearchParams(w.location.search);
    var stored = {};
    try { stored = JSON.parse(cookie('lhi_attr') || '{}'); } catch (e) {}
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
    var fresh = {};
    keys.forEach(function (k) { if (qs.get(k)) fresh[k] = qs.get(k); });
    if (Object.keys(fresh).length) {
      stored = Object.assign({}, stored, fresh, { first_seen: stored.first_seen || new Date().toISOString() });
      cookie('lhi_attr', JSON.stringify(stored), 90);
    }
    var first = {};
    try { first = JSON.parse(cookie('lhi_first_attr') || '{}'); } catch (e) {}
    if (!first.first_seen) {
      first = {
        first_seen: new Date().toISOString(),
        landing_page: w.location.pathname || '/',
        referrer: d.referrer || null,
        attribution: Object.assign({}, stored, fresh)
      };
      cookie('lhi_first_attr', JSON.stringify(first), 365);
    }
    return {
      current_touch: stored,
      first_touch: first
    };
  }

  // Transport -------------------------------------------------------------
  function sendSupabase(payload) {
    try {
      var url = SUPABASE_URL + '/rest/v1/' + TABLE;
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        // sendBeacon cannot set headers — fall back to fetch keepalive
      }
      fetch(url, {
        method: 'POST',
        mode: 'cors',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON,
          'Authorization': 'Bearer ' + SUPABASE_ANON,
          'Prefer': 'return=minimal'
        },
        body: body
      }).catch(function () { /* swallow */ });
    } catch (e) { /* swallow */ }
  }

  function fireGA(name, props) {
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push(Object.assign({ event: name }, props || {}));
  }

  /* Fire Google Ads conversion for Lead submissions, with Enhanced
     Conversions for Leads (hashed PII passed via gtag.set('user_data')
     so Google can match offline-closed leads back to the original click).
     Skipped on non-prod, when gtag isn't loaded, or when the conversion
     label is still the placeholder. transaction_id=eventID prevents
     double-counting if the same Lead event fires twice. */
  function fireGoogleAdsLead(eventID) {
    if (w.__LHI_IS_PROD === false) return;
    if (typeof w.gtag !== 'function') return;
    if (LEAD_CONVERSION_SEND_TO.indexOf('PLACEHOLDER') !== -1) return;

    var emailRaw = identity.email || null;
    var phoneRaw = normPhone(identity.phone);
    var first = null, last = null;
    if (identity.name) {
      var parts = String(identity.name).trim().split(/\s+/);
      first = parts[0] || null;
      if (parts.length > 1) last = parts.slice(1).join(' ');
    }

    Promise.all([
      sha256(emailRaw),
      phoneRaw ? sha256(phoneRaw) : Promise.resolve(null),
      sha256(first),
      sha256(last)
    ]).then(function (vals) {
      var userData = {};
      if (vals[0]) userData.sha256_email_address = vals[0];
      if (vals[1]) userData.sha256_phone_number = vals[1];
      if (vals[2] || vals[3] || identity.zip) {
        userData.address = {};
        if (vals[2]) userData.address.sha256_first_name = vals[2];
        if (vals[3]) userData.address.sha256_last_name = vals[3];
        if (identity.zip) userData.address.postal_code = String(identity.zip).slice(0, 5);
      }
      try { w.gtag('set', 'user_data', userData); } catch (e) {}
      try {
        w.gtag('event', 'conversion', {
          send_to: LEAD_CONVERSION_SEND_TO,
          transaction_id: eventID,
          value: leadValueFor(pageType()),
          currency: 'USD'
        });
      } catch (e) {}
    }).catch(function () { /* swallow — never let analytics break the page */ });
  }

  // Public API ------------------------------------------------------------
  var identity = {};

  function identify(attrs) {
    identity = Object.assign({}, identity, attrs || {});
    try { cookie('lhi_id', JSON.stringify(identity), 365); } catch (e) {}

    /* Identity is retained locally for Supabase payloads and Google Enhanced
       Conversions when a Lead event fires. */
  }

  function fdGet(fd, names) {
    for (var i = 0; i < names.length; i++) {
      var val = fd.get(names[i]);
      if (val != null && String(val).trim() !== '') return val;
    }
    return null;
  }

  function identifyFromFormData(fd) {
    var attrs = {};
    var zip = fdGet(fd, ['zip', 'ZIP', 'zip_code', 'postal_code']);
    var email = fdGet(fd, ['email']);
    var phone = fdGet(fd, ['phone', 'phone_number']);
    var name = fdGet(fd, ['name', 'full_name']);
    if (zip) attrs.zip = zip;
    if (email) attrs.email = email;
    if (phone) attrs.phone = phone;
    if (name) attrs.name = name;
    if (Object.keys(attrs).length) identify(attrs);
  }

  function formPayload(f, fd, content) {
    var payload = {
      content_name: content,
      source_url: w.location.href
    };
    fd.forEach(function (v, k) {
      payload[k] = v;
    });
    return payload;
  }

  function redirectAfterLead(f) {
    w.location.href = f.getAttribute('action') || '/thanks.html';
  }

  function submitLeadViaApi(f, payload) {
    if (f.__lhiApiSubmitting) return;
    f.__lhiApiSubmitting = true;

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error('lead api ' + res.status);
      redirectAfterLead(f);
    }).catch(function () {
      try {
        f.submit();
      } catch (e) {
        redirectAfterLead(f);
      }
    });
  }

  function track(name, props) {
    props = props || {};
    var pt = pageType();
    var eventID = makeEventID();
    props = Object.assign({
      page_type: pt,
      source_page: w.location.pathname,
      source_url: w.location.href
    }, props);
    var payload = {
      event_name: name,
      event_id: eventID,
      page_type: pt,
      page_path: w.location.pathname,
      page_url: w.location.href,
      referrer: d.referrer || null,
      session_id: getSession(),
      attribution: getAttribution(),
      identity: identity,
      props: props,
      user_agent: navigator.userAgent,
      viewport_w: w.innerWidth,
      viewport_h: w.innerHeight,
      fired_at: new Date().toISOString()
    };

    // 1. GTM / GA4 dataLayer
    fireGA(name, Object.assign({ page_type: pt, event_params: props }, props));

    // 2. Supabase stream
    sendSupabase(payload);

    // 3. Google Ads conversion + Enhanced Conversions (Lead events only)
    if (name === 'Lead') {
      try {
        sessionStorage.setItem('lhi_lead_submitted', JSON.stringify({
          event_id: eventID,
          content_name: props.content_name || null,
          intent: props.intent || props.intent_type || null,
          cta_name: props.cta_name || null,
          page_type: pt,
          page_path: w.location.pathname,
          fired_at: Date.now()
        }));
      } catch (e) {}
      fireGoogleAdsLead(eventID);
    }
  }

  function pageView() {
    track('PageView', { page_type: pageType() });
  }

  // Auto-wire form submissions -------------------------------------------
  function wireForms() {
    d.querySelectorAll('form[data-funnel-track], form[data-funnel-step]').forEach(function (f) {
      if (f.__lhiWired) return;
      f.__lhiWired = true;
      f.addEventListener('submit', function (e) {
        var name = f.getAttribute('data-funnel-event') || 'Lead';
        var step = f.getAttribute('data-funnel-step') || 'submit';
        var content = f.getAttribute('data-funnel-name') || (pageType() + '_' + step);
        var fd = new FormData(f);
        identifyFromFormData(fd);

        if (name === 'Lead' && !f.hasAttribute('data-funnel-api-opt-out')) {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          if (f.__lhiLeadTracked) return;
          f.__lhiLeadTracked = true;
          track(name, { content_name: content, step: step });
          submitLeadViaApi(f, formPayload(f, fd, content));
          return;
        }

        track(name, { content_name: content, step: step });
      }, { capture: true });
    });

    // Auto-wire Calendly booking buttons
    d.querySelectorAll('[data-funnel-booking], a[href*="calendly.com"]').forEach(function (a) {
      if (a.__lhiWired) return;
      a.__lhiWired = true;
      a.addEventListener('click', function () {
        track('Schedule', {
          content_name: pageType() + '_calendly_click',
          cta_name: ctaName(a),
          destination_url: a.href || null,
          schedule_state: 'click'
        });
      });
    });

    d.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      if (a.__lhiPhoneWired) return;
      a.__lhiPhoneWired = true;
      a.addEventListener('click', function () {
        track('PhoneClick', {
          content_name: pageType() + '_phone_click',
          cta_name: ctaName(a),
          destination_url: a.href || null
        });
      });
    });

    d.querySelectorAll('a[href*="m.me/"], a[href*="messenger.com"]').forEach(function (a) {
      if (a.__lhiMessengerWired) return;
      a.__lhiMessengerWired = true;
      a.addEventListener('click', function () {
        track('MessengerClick', {
          content_name: pageType() + '_messenger_click',
          cta_name: ctaName(a),
          destination_url: a.href || null
        });
      });
    });

    d.querySelectorAll('a[href*="healthsherpa.com"], a[href*="healthcare.gov"], a[href*="/find-plans"], a[href*="/search-engine-from-zip"]').forEach(function (a) {
      if (a.__lhiQuoteWired) return;
      a.__lhiQuoteWired = true;
      a.addEventListener('click', function () {
        track('SelfServiceQuoteClick', {
          content_name: pageType() + '_self_service_quote_click',
          cta_name: ctaName(a),
          destination_url: a.href || null
        });
      });
    });
  }

  function ctaName(el) {
    return el.getAttribute('data-funnel-cta') ||
      el.getAttribute('data-analytics-label') ||
      el.getAttribute('aria-label') ||
      (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) ||
      'unnamed_cta';
  }

  // Boot ------------------------------------------------------------------
  w.LHI = { track: track, identify: identify, pageType: pageType, session: getSession };

  /* Test-only surface. Tree-shaken for prod by the gate: only attaches when
     w.__LHI_TEST is set to true before this script evaluates (Node test
     harness), so production bundles never expose helpers. */
  if (w.__LHI_TEST === true) {
    w.LHI._t = {
      sha256: sha256,
      normPhone: normPhone,
      pageType: pageType,
      routePath: routePath,
      getAttribution: getAttribution,
      wireForms: wireForms,
      leadValueFor: leadValueFor,
      LEAD_VALUE_BY_PAGE_TYPE: LEAD_VALUE_BY_PAGE_TYPE,
      LEAD_CONVERSION_SEND_TO: LEAD_CONVERSION_SEND_TO
    };
  }

  // Give GTM time to initialize (analytics.js loads on interaction/idle/timeout)
  function boot() {
    getAttribution(); // persist UTMs on first hit
    wireForms();
    setTimeout(pageView, 300);
    // Observe DOM for late-rendered forms (React/etc.)
    if (w.MutationObserver) {
      new MutationObserver(wireForms).observe(d.body, { childList: true, subtree: true });
    }
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window, document);
