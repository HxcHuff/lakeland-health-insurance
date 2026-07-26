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
 * Page-type inference (for GA4 / Supabase segmentation):
 *   - /lp/aca/            -> lp_aca
 *   - /lp/medicare/       -> lp_medicare
 *   - /lp/gap/            -> lp_gap
 *   - /carriers/*         -> carrier_lp
 *   - /blog/*             -> blog
 *   - /aca-subsidy-estimator/ -> estimator
 *   - /get-help/          -> get_help
 *   - /health-protector-guard/ -> guard_lp
 *   - /thanks.html        -> conversion
 *   - /calendly-book.html -> booking
 *   else                  -> site
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

  /* Per-page-type lead value (USD) sent with the Google Ads conversion.
     Smart Bidding uses these as a relative-LTV signal — Medicare residuals
     are worth multiples of an ACA enrollment, so weighting matters. Edit
     one place to tune. Default 0 = unchanged behavior; 'default' applies
     when pageType() returns something not in the map. Anything <= 0 still
     fires the conversion (count signal) but with value 0. */
  var LEAD_VALUE_BY_PAGE_TYPE = {
    lp_medicare: 0,
    local_seo_medicare: 0,
    lp_aca: 0,
    local_seo_aca: 0,
    lp_job_loss: 0,
    estimator: 0,
    lp_gap: 0,
    guard_lp: 0,
    dime_method: 0,
    get_help: 0,
    guide_optin: 0,
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

  function pageType() {
    var p = (w.location.pathname || '/').toLowerCase();
    if (p.indexOf('/lp/aca') === 0) return 'lp_aca';
    if (p.indexOf('/lp/medicare') === 0) return 'lp_medicare';
    if (p.indexOf('/lp/gap') === 0) return 'lp_gap';
    if (p.indexOf('/carriers/') === 0) return 'carrier_lp';
    if (p.indexOf('/blog/') === 0) return 'blog';
    if (p.indexOf('/aca-subsidy-estimator') === 0) return 'estimator';
    if (p.indexOf('/get-help') === 0) return 'get_help';
    if (p.indexOf('/health-protector-guard') === 0) return 'guard_lp';
    if (p.indexOf('/aca-health-insurance-lakeland') === 0) return 'local_seo_aca';
    if (p.indexOf('/medicare-broker-lakeland') === 0) return 'local_seo_medicare';
    if (p.indexOf('/life-insurance-dime') === 0) return 'dime_method';
    if (p.indexOf('/lost-job-health-insurance') === 0) return 'lp_job_loss';
    if (p.indexOf('/download-free-guide') === 0) return 'guide_optin';
    if (p.indexOf('/calendly-book') === 0) return 'booking';
    if (p === '/thanks.html' || p === '/thanks/') return 'conversion';
    if (p === '/' || p === '/index.html') return 'home';
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
    return stored;
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

  function currentAttribution() {
    var attr = getAttribution() || {};
    var source = attr.utm_source || (attr.gclid ? 'google_ads' : (attr.fbclid ? 'facebook_click' : 'direct'));
    var medium = attr.utm_medium || (attr.gclid ? 'cpc' : (attr.fbclid ? 'paid_social' : 'none'));
    return {
      raw: attr,
      source: source,
      medium: medium,
      campaign: attr.utm_campaign || null,
      content: attr.utm_content || null,
      term: attr.utm_term || null,
      gclid: attr.gclid || null,
      fbclid: attr.fbclid || null
    };
  }

  function identityAudit() {
    return {
      has_email: !!identity.email,
      has_phone: !!identity.phone,
      has_name: !!identity.name,
      zip: identity.zip ? String(identity.zip).replace(/\D/g, '').slice(0, 5) : null
    };
  }

  function formPayload(f, fd, content, eventID) {
    var attr = currentAttribution();
    var payload = {
      content_name: content,
      source_url: w.location.href,
      _lhi_client_event_id: eventID || null,
      _lhi_page_type: pageType(),
      _lhi_page_path: w.location.pathname,
      _lhi_session_id: getSession(),
      _lhi_attribution_source: attr.source,
      _lhi_attribution_medium: attr.medium,
      _lhi_attribution_campaign: attr.campaign || '',
      _lhi_attribution_content: attr.content || '',
      _lhi_attribution_term: attr.term || ''
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
    var attr = currentAttribution();
    var payload = {
      event_name: name,
      event_id: eventID,
      page_type: pt,
      page_path: w.location.pathname,
      page_url: w.location.href,
      referrer: d.referrer || null,
      session_id: getSession(),
      attribution: attr.raw,
      identity: identityAudit(),
      props: props,
      user_agent: navigator.userAgent,
      viewport_w: w.innerWidth,
      viewport_h: w.innerHeight,
      fired_at: new Date().toISOString()
    };

    // 1. GTM / GA4 dataLayer
    fireGA(name, Object.assign({
      event_id: eventID,
      page_type: pt,
      page_path: w.location.pathname,
      funnel_name: props.content_name || props.funnel_name || pt,
      funnel_step: props.step || null,
      form_name: props.form_name || null,
      line_of_business: props.line_of_business || null,
      attribution_source: attr.source,
      attribution_medium: attr.medium,
      attribution_campaign: attr.campaign,
      attribution_content: attr.content,
      attribution_term: attr.term,
      lhi_session_id: getSession(),
      transport_type: 'beacon'
    }, props));

    // 2. Supabase stream
    sendSupabase(payload);

    // 3. Google Ads conversion + Enhanced Conversions (Lead events only)
    if (name === 'Lead') {
      try {
        sessionStorage.setItem('lhi_lead_submitted', JSON.stringify({
          event_id: eventID,
          content_name: props.content_name || null,
          funnel_step: props.step || null,
          form_name: props.form_name || null,
          page_type: pt,
          page_path: w.location.pathname,
          fired_at: Date.now()
        }));
      } catch (e) {}
      fireGoogleAdsLead(eventID);
    }

    return eventID;
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
        var formName = fdGet(fd, ['form-name', 'form_name']) || f.getAttribute('name') || f.id || null;
        identifyFromFormData(fd);

        track('form_submit', {
          content_name: content,
          step: step,
          form_name: formName,
          submitted_event_name: name
        });

        if (name === 'Lead' && !f.hasAttribute('data-funnel-api-opt-out')) {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          var leadEventID = track(name, { content_name: content, step: step, form_name: formName });
          submitLeadViaApi(f, formPayload(f, fd, content, leadEventID));
          return;
        }

        track(name, { content_name: content, step: step, form_name: formName });
      }, { capture: true });
    });

    // Auto-wire Calendly booking buttons
    d.querySelectorAll('[data-funnel-booking], a[href*="calendly.com"]').forEach(function (a) {
      if (a.__lhiWired) return;
      a.__lhiWired = true;
      a.addEventListener('click', function () {
        track('Schedule', { content_name: pageType() + '_calendly_click', step: 'booking_click' });
      });
    });
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
      currentAttribution: currentAttribution,
      identityAudit: identityAudit,
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
