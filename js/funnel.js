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
    lp_losing_coverage: 0,
    lp_turning_26: 0,
    lp_self_employed: 0,
    lp_current_client_review: 0,
    lp_provider_check: 0,
    lp_employer_referral: 0,
    lp_post_enrollment_review: 0,
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
    if (p.indexOf('/losing-coverage') === 0) return 'lp_losing_coverage';
    if (p.indexOf('/turning-26') === 0) return 'lp_turning_26';
    if (p.indexOf('/self-employed-health-insurance') === 0) return 'lp_self_employed';
    if (p.indexOf('/current-client-review') === 0) return 'lp_current_client_review';
    if (p.indexOf('/provider-prescription-check') === 0) return 'lp_provider_check';
    if (p.indexOf('/employer-referral') === 0) return 'lp_employer_referral';
    if (p.indexOf('/post-enrollment-review') === 0) return 'lp_post_enrollment_review';
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

  function safeIdentity() {
    return {
      zip: identity.zip ? String(identity.zip).slice(0, 5) : null,
      has_email: !!identity.email,
      has_phone: !!identity.phone,
      has_name: !!identity.name
    };
  }

  function safeProps(props) {
    var out = {};
    var prohibited = {
      full_name: true, name: true, first_name: true, last_name: true,
      email: true, phone: true, phone_number: true,
      provider_name: true, provider_location: true, prescription_name: true,
      doctors_to_keep: true, prescriptions_to_review: true, additional_notes: true,
      notes: true, message: true
    };
    Object.keys(props || {}).forEach(function (key) {
      if (prohibited[key]) return;
      var val = props[key];
      if (val == null) return;
      if (typeof val === 'string' && /@|(?:\d[\s().-]*){7,}/.test(val)) return;
      out[key] = val;
    });
    return out;
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

  function cleanAnalyticsToken(value) {
    if (value == null) return null;
    var cleaned = String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return cleaned || null;
  }

  function inferLineOfBusiness(content, formName, pt) {
    var source = [content, formName, pt].join(' ').toLowerCase();
    if (source.indexOf('medicare') !== -1) return 'medicare';
    if (source.indexOf('aca') !== -1 || source.indexOf('marketplace') !== -1) return 'aca';
    if (source.indexOf('gap') !== -1 || source.indexOf('short') !== -1) return 'coverage_gap';
    if (source.indexOf('dental') !== -1 || source.indexOf('vision') !== -1) return 'dental_vision';
    if (source.indexOf('supplemental') !== -1) return 'supplemental';
    return null;
  }

  function inferIntent(content, formName, pt) {
    var source = [content, formName, pt].join(' ').toLowerCase();
    if (source.indexOf('medicare') !== -1) return 'medicare';
    if (source.indexOf('coverage_gap') !== -1 || source.indexOf('lp-gap') !== -1 || source.indexOf(' gap') !== -1) return 'coverage_gap';
    if (source.indexOf('aca') !== -1 || source.indexOf('marketplace') !== -1) return 'aca';
    return null;
  }

  function setFormFieldValue(f, name, value) {
    if (!f || value == null) return;
    var field = f.elements && f.elements[name];
    if (field) field.value = value;
  }

  function safeLeadPropsFromForm(f, fd, content, step, apiResult) {
    var formName = fdGet(fd, ['form-name', 'form_name']);
    var pt = pageType();
    var props = {
      content_name: cleanAnalyticsToken(fdGet(fd, ['content_name']) || content),
      step: cleanAnalyticsToken(step || 'submit'),
      coverage_status: cleanAnalyticsToken(fdGet(fd, ['coverage_status', 'current_plan', 'coverage_type'])),
      best_time_to_reach: cleanAnalyticsToken(fdGet(fd, ['best_time_to_reach'])),
      normalized_intent: cleanAnalyticsToken(fdGet(fd, ['normalized_intent', 'inquiry_type']) || inferIntent(content, formName, pt)),
      line_of_business: cleanAnalyticsToken(fdGet(fd, ['line_of_business']) || inferLineOfBusiness(content, formName, pt)),
      need_timing: cleanAnalyticsToken(fdGet(fd, ['need_timing', 'coverage_situation', 'medicare_timing', 'age_timeline']))
    };

    if (apiResult && apiResult.lead_priority) {
      props.lead_priority = cleanAnalyticsToken(apiResult.lead_priority);
      setFormFieldValue(f, 'lead_priority', props.lead_priority);
    }
    if (apiResult && apiResult.lead_priority_reason) {
      props.lead_priority_reason = cleanAnalyticsToken(apiResult.lead_priority_reason);
      setFormFieldValue(f, 'lead_priority_reason', props.lead_priority_reason);
    }

    return props;
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

  function clearPendingLeadMarker() {
    try { w.sessionStorage.removeItem('lhi_lead_submitted'); } catch (e) {}
  }

  function markCompletedSubmission(kind, eventID, props, pt) {
    var marker = {
      kind: kind,
      event_id: eventID,
      content_name: props.content_name || null,
      page_type: pt,
      page_path: w.location.pathname,
      normalized_intent: props.normalized_intent || null,
      line_of_business: props.line_of_business || null,
      fired_at: Date.now()
    };
    try { sessionStorage.setItem('lhi_submission_completed', JSON.stringify(marker)); } catch (e) {}
    if (kind === 'Lead') {
      try { sessionStorage.setItem('lhi_lead_submitted', JSON.stringify(marker)); } catch (e) {}
    }
  }

  function redirectAfterLead(f) {
    w.location.href = f.getAttribute('action') || '/thanks.html';
  }

  function submitLeadViaApi(f, payload, onDelivered) {
    if (f.__lhiApiSubmitting) return;
    f.__lhiApiSubmitting = true;

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (res.ok) {
        return (typeof res.json === 'function' ? res.json().catch(function () { return {}; }) : Promise.resolve({})).then(function (body) {
          if (typeof onDelivered === 'function') onDelivered(body || {});
          redirectAfterLead(f);
        });
      }
      var err = new Error('lead api ' + res.status);
      err.status = res.status;
      throw err;
    }).catch(function (err) {
      if (err && err.status >= 400 && err.status < 500) {
        clearPendingLeadMarker();
        f.__lhiApiSubmitting = false;
        try { w.alert('Please wait a moment, then send your request again.'); } catch (e) {}
        return;
      }
      try {
        f.submit();
      } catch (e) {
        redirectAfterLead(f);
      }
    });
  }

  function track(name, props) {
    props = safeProps(props || {});
    var pt = pageType();
    var eventID = makeEventID();
    var payload = {
      event_name: name,
      event_id: eventID,
      page_type: pt,
      page_path: w.location.pathname,
      page_url: w.location.href,
      referrer: d.referrer || null,
      session_id: getSession(),
      attribution: getAttribution(),
      identity: safeIdentity(),
      props: props,
      user_agent: navigator.userAgent,
      viewport_w: w.innerWidth,
      viewport_h: w.innerHeight,
      fired_at: new Date().toISOString()
    };

    // 1. GTM / GA4 dataLayer
    fireGA(name, { page_type: pt, event_params: props });

    // 2. Supabase stream
    sendSupabase(payload);

    // 3. Google Ads conversion + Enhanced Conversions (Lead events only)
    if (name === 'Lead') {
      markCompletedSubmission('Lead', eventID, props, pt);
      fireGoogleAdsLead(eventID);
    } else if (name === 'Subscriber') {
      markCompletedSubmission('Subscriber', eventID, props, pt);
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
      f.__lhiFormStarted = false;
      var name = f.getAttribute('data-funnel-event') || 'Lead';
      var step = f.getAttribute('data-funnel-step') || 'submit';
      var content = f.getAttribute('data-funnel-name') || (pageType() + '_' + step);

      function trackFormStart() {
        if (f.__lhiFormStarted) return;
        f.__lhiFormStarted = true;
        track('StartLead', { content_name: content, step: 'start' });
      }

      ['focusin', 'input', 'change'].forEach(function (type) {
        f.addEventListener(type, trackFormStart, { capture: true });
      });

      f.addEventListener('submit', function (e) {
        var fd = new FormData(f);
        identifyFromFormData(fd);
        trackFormStart();

        if ((name === 'Lead' || name === 'Subscriber') && !f.hasAttribute('data-funnel-api-opt-out')) {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          submitLeadViaApi(f, formPayload(f, fd, content), function (apiResult) {
            if (name === 'Lead') {
              track(name, safeLeadPropsFromForm(f, fd, content, step, apiResult));
            } else {
              track(name, { content_name: content, step: step });
            }
          });
          return;
        }

        if (name === 'Lead') {
          track(name, safeLeadPropsFromForm(f, fd, content, step, null));
        } else {
          track(name, { content_name: content, step: step });
        }
      }, { capture: true });
    });

    // Auto-wire Calendly booking buttons
    d.querySelectorAll('[data-funnel-booking], a[href*="calendly.com"]').forEach(function (a) {
      if (a.__lhiWired) return;
      a.__lhiWired = true;
      a.addEventListener('click', function () {
        track('Schedule', { content_name: pageType() + '_calendly_click' });
      });
    });

    d.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      if (a.__lhiPhoneWired) return;
      a.__lhiPhoneWired = true;
      a.addEventListener('click', function () {
        track('PhoneCallClick', { content_name: pageType() + '_phone_click' });
      });
    });

    d.querySelectorAll('a[href*="healthsherpa.com"], a[href*="/find-plans"]').forEach(function (a) {
      if (a.__lhiExternalQuoteWired) return;
      a.__lhiExternalQuoteWired = true;
      a.addEventListener('click', function () {
        track('ExternalQuoteClick', { content_name: pageType() + '_external_quote_click' });
      });
    });

    d.querySelectorAll('a[href*="m.me/"]').forEach(function (a) {
      if (a.__lhiMessengerWired) return;
      a.__lhiMessengerWired = true;
      a.addEventListener('click', function () {
        track('messenger_click', { content_name: pageType() + '_messenger_click' });
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
      leadValueFor: leadValueFor,
      cleanAnalyticsToken: cleanAnalyticsToken,
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
