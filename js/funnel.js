/*
 * Lakeland Health Insurance — Funnel Event Bus
 * Single source of truth for first-party funnel event tracking.
 *
 * Fires to:
 *   - Google Tag Manager (GTM-W6MZ7XT6)
 *   - Google Ads conversion events for delivered Lead events
 *
 * Usage:
 *   window.LHI.track('Lead', { content_name: 'lead_form' });
 *
 * Page-type inference (for GA4 / Ads segmentation):
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

  /* Google Ads "Submit lead form" conversion. Fires a non-identifying
     conversion event after first-party form delivery. */
  var LEAD_CONVERSION_SEND_TO = 'AW-300112445/hChjCJvYraUcEL20jY8B';
  var OPENAI_ADS_CONFIG_PATH = '/api/openai-ads-config';
  var OPENAI_ADS_SDK_SRC = 'https://bzrcdn.openai.com/sdk/oaiq.min.js';
  var openAIAdsConfigPromise = null;
  var openAIAdsPixelReady = false;

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
      var secure = w.location && w.location.protocol === 'https:' ? '; Secure' : '';
      if (days) {
        var dt = new Date();
        dt.setTime(dt.getTime() + days * 86400000);
        exp = '; expires=' + dt.toUTCString();
      }
      d.cookie = name + '=' + encodeURIComponent(val) + exp + '; path=/; SameSite=Lax' + secure;
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

  function safeProps(props) {
    var out = {};
    var prohibited = {
      full_name: true, name: true, first_name: true, last_name: true,
      email: true, phone: true, phone_number: true,
      zip: true, zip_code: true, postal_code: true, county: true,
      provider_name: true, provider_location: true, prescription_name: true,
      doctors_to_keep: true, prescriptions_to_review: true, additional_notes: true,
      income: true, household_income: true, subsidy: true, health_status: true,
      coverage_status: true, current_plan: true, best_time_to_reach: true,
      need_timing: true, coverage_situation: true, medicare_timing: true,
      normalized_intent: true, line_of_business: true,
      lead_priority: true, lead_priority_reason: true,
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

  function openAIAdsEnabled() {
    return w.__LHI_IS_PROD !== false;
  }

  function loadOpenAIAdsPixel() {
    if (!openAIAdsEnabled()) return Promise.resolve(null);
    if (openAIAdsConfigPromise) return openAIAdsConfigPromise;

    openAIAdsConfigPromise = fetch(OPENAI_ADS_CONFIG_PATH, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function (config) {
      var pixelId = config && config.pixel_id ? String(config.pixel_id).trim() : '';
      if (!pixelId) return null;
      if (typeof w.oaiq === 'function') {
        if (!openAIAdsPixelReady) {
          w.oaiq('init', { pixelId: pixelId });
          openAIAdsPixelReady = true;
        }
        return pixelId;
      }
      if (!d.createElement || !d.head) return null;
      return new Promise(function (resolve) {
        var script = d.createElement('script');
        script.async = true;
        script.src = OPENAI_ADS_SDK_SRC;
        script.onload = function () {
          try {
            if (typeof w.oaiq === 'function') {
              w.oaiq('init', { pixelId: pixelId });
              openAIAdsPixelReady = true;
              resolve(pixelId);
              return;
            }
          } catch (e) {}
          resolve(null);
        };
        script.onerror = function () { resolve(null); };
        d.head.appendChild(script);
      });
    }).catch(function () {
      return null;
    });

    return openAIAdsConfigPromise;
  }

  function fireGA(name, props) {
    props = props || {};
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push(Object.assign({ event: name }, props));

    /* GTM owns Lead -> generate_lead and the phone-call tag. These direct
       GA4 sends cover secondary events that the site already emits but GTM
       does not currently convert into named GA4 events. */
    var directGA4Events = {
      Subscriber: 'newsletter_signup',
      Schedule: 'schedule_appointment',
      ExternalQuoteClick: 'external_quote_click',
      messenger_click: 'messenger_click',
      LeadReceiptView: 'lead_receipt_view'
    };
    var ga4Name = directGA4Events[name];
    if (!ga4Name) return;

    var params = Object.assign({}, props.event_params || {});
    if (props.page_type && !params.page_type) params.page_type = props.page_type;
    params.original_event_name = name;
    params.transport_type = 'beacon';

    w.gtag = w.gtag || function () { w.dataLayer.push(arguments); };
    try { w.gtag('event', ga4Name, params); } catch (e) {}
  }

  function fireOpenAIAdsLead(eventID) {
    if (!eventID) return;
    loadOpenAIAdsPixel().then(function (pixelId) {
      if (!pixelId || typeof w.oaiq !== 'function') return;
      try {
        w.oaiq('measure', 'lead_created', {
          type: 'customer_action'
        }, {
          event_id: eventID
        });
      } catch (e) {}
    }).catch(function () { /* swallow — never let analytics break the page */ });
  }

  // Public API ------------------------------------------------------------
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

  function cleanAnalyticsPath(value) {
    if (value == null) return null;
    var cleaned = String(value).trim().toLowerCase().split(/[?#]/, 1)[0];
    if (cleaned.charAt(0) !== '/') return null;
    cleaned = cleaned.replace(/[^a-z0-9/_\-.]/g, '').slice(0, 160);
    return cleaned || null;
  }

  function setFormFieldValue(f, name, value) {
    if (!f || value == null) return;
    var field = f.elements && f.elements[name];
    if (field) field.value = value;
  }

  function safeLeadPropsFromForm(f, fd, content, step, apiResult) {
    var props = {
      content_name: 'first_party_lead',
      step: cleanAnalyticsToken(step || 'submit')
    };

    if (apiResult && apiResult.lead_priority) {
      setFormFieldValue(f, 'lead_priority', cleanAnalyticsToken(apiResult.lead_priority));
    }
    if (apiResult && apiResult.lead_priority_reason) {
      setFormFieldValue(f, 'lead_priority_reason', cleanAnalyticsToken(apiResult.lead_priority_reason));
    }
    if (apiResult && apiResult.event_id) {
      props.event_id = String(apiResult.event_id).trim();
    }

    return props;
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
    var eventID = props.event_id ? String(props.event_id) : makeEventID();
    if (props.event_id) delete props.event_id;

    getSession();
    getAttribution();

    // GTM owns the single GA4 and Google Ads Lead conversion tags. Emit its
    // shared custom event only after first-party delivery has succeeded.
    if (name === 'Lead') {
      fireGA('Lead', Object.assign({}, props, {
        event_id: eventID,
        page_type: pt,
        original_event_name: 'Lead'
      }));
      markCompletedSubmission('Lead', eventID, props, pt);
      fireOpenAIAdsLead(eventID);
    } else if (name === 'Subscriber') {
      fireGA(name, { page_type: pt, event_params: props });
      markCompletedSubmission('Subscriber', eventID, props, pt);
    } else {
      fireGA(name, { page_type: pt, event_params: props });
    }
  }

  function pageView() {
    track('PageView', { page_type: pageType() });
  }

  function trackLeadReceiptView() {
    var marker = w.__LHI_THANKS_LEAD_MARKER;
    if (pageType() !== 'conversion' || !marker) return;
    track('LeadReceiptView', {
      content_name: 'lead_thank_you',
      step: 'complete',
      source_page_type: cleanAnalyticsToken(marker.page_type),
      source_page_path: cleanAnalyticsPath(marker.page_path)
    });
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

    /* analytics.js owns canonical phone tracking when present. Keep this
       fallback for pages that load funnel.js directly, but never double-wire
       the same physical click after analytics.js has initialized. */
    if (typeof w.lhiTrackPhoneClick !== 'function') {
      d.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
        if (a.__lhiPhoneWired) return;
        a.__lhiPhoneWired = true;
        a.addEventListener('click', function () {
          track('PhoneCallClick', { content_name: pageType() + '_phone_click' });
        });
      });
    }

    d.querySelectorAll('a[data-funnel-external-quote], a[href*="healthsherpa.com"], a[href*="/find-plans"]').forEach(function (a) {
      if (a.__lhiExternalQuoteWired) return;
      a.__lhiExternalQuoteWired = true;
      a.addEventListener('click', function () {
        var contentName = cleanAnalyticsToken(a.getAttribute('data-analytics-label')) || (pageType() + '_external_quote_click');
        track('ExternalQuoteClick', { content_name: contentName });
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
  w.LHI = { track: track, pageType: pageType, session: getSession };

  /* Test-only surface. Tree-shaken for prod by the gate: only attaches when
     w.__LHI_TEST is set to true before this script evaluates (Node test
     harness), so production bundles never expose helpers. */
  if (w.__LHI_TEST === true) {
    w.LHI._t = {
      pageType: pageType,
      leadValueFor: leadValueFor,
      cleanAnalyticsToken: cleanAnalyticsToken,
      LEAD_VALUE_BY_PAGE_TYPE: LEAD_VALUE_BY_PAGE_TYPE,
      LEAD_CONVERSION_SEND_TO: LEAD_CONVERSION_SEND_TO,
      OPENAI_ADS_CONFIG_PATH: OPENAI_ADS_CONFIG_PATH,
      OPENAI_ADS_SDK_SRC: OPENAI_ADS_SDK_SRC
    };
  }

  // Give GTM time to initialize (analytics.js loads on interaction/idle/timeout)
  function boot() {
    getAttribution(); // persist UTMs on first hit
    wireForms();
    trackLeadReceiptView();
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
