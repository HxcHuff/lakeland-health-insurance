/*
 * Lakeland Health Insurance — Funnel Event Bus
 * Single source of truth for first-party funnel event tracking.
 *
 * Fires to:
 *   - Google Tag Manager (GTM-W6MZ7XT6)
 *   - GTM's single accepted-Lead trigger, which owns downstream GA4 and Ads tags
 *
 * Usage:
 *   window.LHI.track('StartLead', { content_name: 'lead_form', step: 'start' });
 * Canonical Lead calls are internal and require a server-approved event ID plus
 * acceptance_status=forms_accepted.
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

  var OPENAI_ADS_CONFIG_PATH = '/api/openai-ads-config';
  var OPENAI_ADS_SDK_SRC = 'https://bzrcdn.openai.com/sdk/oaiq.min.js';
  var openAIAdsConfigPromise = null;
  var openAIAdsPixelReady = false;
  var MEDICARE_ATTRIBUTION_SCHEMA_VERSION = 'medicare-attribution.v1';
  var MEDICARE_CONTENT_CLUSTER = 'lakeland_medicare_broker';
  var ATTRIBUTION_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var MEDICARE_PAGE_REGISTRY = {
    medicare: {
      path: '/medicare/',
      page_role: 'hub',
      cta_keys: {
        start_review_hero: true,
        request_review_process: true,
        start_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    aep_2026_polk_county_checklist: {
      path: '/blog/aep-2026-polk-county-checklist.html/',
      page_role: 'education',
      cta_keys: {
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    medicare_supplement_cost_lakeland: {
      path: '/blog/medicare-supplement-cost-lakeland.html/',
      page_role: 'education',
      cta_keys: {
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    medicare_vs_aca_central_florida_age_65: {
      path: '/blog/medicare-vs-aca-central-florida-age-65.html/',
      page_role: 'education',
      cta_keys: {
        request_review_nav: true,
        request_review_hero: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    turning_65_medicare_checklist_florida: {
      path: '/blog/turning-65-medicare-checklist-florida.html/',
      page_role: 'education',
      cta_keys: {
        request_review_nav: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    when_can_i_switch_medicare_plans_florida: {
      path: '/blog/when-can-i-switch-medicare-plans-florida.html/',
      page_role: 'education',
      cta_keys: {
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    medicare_east_polk: {
      path: '/medicare/east-polk/',
      page_role: 'education',
      cta_keys: {
        request_review_nav: true,
        request_review_hero: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    moving_florida_medicare: {
      path: '/moving-florida-medicare/',
      page_role: 'education',
      cta_keys: {
        request_move_review: true,
        request_related_review: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    best_medicare_broker_lakeland_fl: {
      path: '/best-medicare-broker-lakeland-fl/',
      page_role: 'selection',
      cta_keys: {
        request_review_hero: true,
        start_review_criteria: true,
        request_help_final: true,
        broker_help_nav: true,
        see_review_process: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    medicare_broker_lakeland_fl: {
      path: '/medicare-broker-lakeland-fl/',
      page_role: 'transaction',
      cta_keys: {
        request_review_hero: true,
        request_review_verification: true,
        request_review_final: true,
        selection_guide_nav: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    }
  };

  function normalizePath(pathname) {
    var path = String(pathname || '/').toLowerCase().split(/[?#]/, 1)[0];
    path = path.replace(/\/index\.html$/, '/');
    if (path.charAt(0) !== '/') path = '/' + path;
    if (path !== '/' && path.charAt(path.length - 1) !== '/') path += '/';
    return path;
  }

  function hasOwn(object, key) {
    return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
  }

  function registeredPageForPath(pathname) {
    var normalized = normalizePath(pathname);
    var keys = Object.keys(MEDICARE_PAGE_REGISTRY);
    for (var i = 0; i < keys.length; i += 1) {
      if (MEDICARE_PAGE_REGISTRY[keys[i]].path === normalized) {
        return { page_key: keys[i], registered: MEDICARE_PAGE_REGISTRY[keys[i]] };
      }
    }
    return null;
  }

  function pageContext(pathname) {
    var match = registeredPageForPath(pathname);
    if (!match) return null;
    return {
      page_key: match.page_key,
      page_role: match.registered.page_role,
      content_cluster: MEDICARE_CONTENT_CLUSTER
    };
  }

  function canonicalSourceContext(values) {
    values = values || {};
    var pageKey = String(values.source_page_key || '');
    var ctaKey = String(values.source_cta_key || '');
    if (!hasOwn(MEDICARE_PAGE_REGISTRY, pageKey)) return null;
    var registered = MEDICARE_PAGE_REGISTRY[pageKey];
    if (!hasOwn(registered.cta_keys, ctaKey)) return null;
    return {
      schema_version: MEDICARE_ATTRIBUTION_SCHEMA_VERSION,
      source_page_key: pageKey,
      source_page_role: registered.page_role,
      source_cta_key: ctaKey,
      content_cluster: MEDICARE_CONTENT_CLUSTER,
      intent: 'medicare'
    };
  }

  function sourceContextFromSearch(search) {
    var qs = new URLSearchParams(String(search || ''));
    if (String(qs.get('intent') || '').toLowerCase() !== 'medicare') return null;
    return canonicalSourceContext({
      source_page_key: qs.get('source_page_key'),
      source_cta_key: qs.get('source_cta_key')
    });
  }

  function currentMedicareSourceContext() {
    var context = null;
    try {
      if (w.LHIMedicareAttribution && typeof w.LHIMedicareAttribution.sourceContext === 'function') {
        context = w.LHIMedicareAttribution.sourceContext(w.location.search || '');
      }
    } catch (e) {}
    return canonicalSourceContext(context || {}) || sourceContextFromSearch(w.location.search || '');
  }

  function medicareIntakeContext() {
    if (normalizePath(w.location.pathname) !== '/get-help/') return null;
    var qs = new URLSearchParams(String(w.location.search || ''));
    var source = currentMedicareSourceContext();
    if (!source && String(qs.get('intent') || '').toLowerCase() !== 'medicare') return null;
    return Object.assign({
      schema_version: MEDICARE_ATTRIBUTION_SCHEMA_VERSION,
      page_key: 'get_help',
      page_role: 'intake',
      content_cluster: MEDICARE_CONTENT_CLUSTER,
      intent: 'medicare'
    }, source || {});
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
    if (p.indexOf('/best-medicare-broker-lakeland') === 0) return 'local_seo_medicare';
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

  function approvedCampaignValue(value) {
    var text = String(value || '').trim().toLowerCase();
    if (!text || text.length > 80) return null;
    // Google Ads suffixes prefix {campaignid} so platform IDs remain
    // distinguishable from untrusted phone-like numeric values.
    if (/^cid_\d{8,20}$/.test(text)) return text;
    if (/@|(?:\d[\s().-]*){7,}/.test(text)) return null;
    return /^[a-z0-9][a-z0-9._~-]*$/.test(text) ? text : null;
  }

  function approvedCampaignTerm(value) {
    var text = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!text || text.length > 80) return null;
    if (/@|(?:\d[\s().-]*){7,}/.test(text)) return null;
    return /^[a-z0-9][a-z0-9 ._~+\-]*$/.test(text) ? text : null;
  }

  function approvedAttributionValue(name, value) {
    return name === 'utm_term' ? approvedCampaignTerm(value) : approvedCampaignValue(value);
  }

  function getAttribution() {
    var qs = new URLSearchParams(w.location.search);
    var rawStored = {};
    try { rawStored = JSON.parse(cookie('lhi_attr') || '{}'); } catch (e) {}
    var stored = {};
    var fresh = {};
    ATTRIBUTION_FIELDS.forEach(function (k) {
      var previous = approvedAttributionValue(k, rawStored[k]);
      var incoming = approvedAttributionValue(k, qs.get(k));
      if (previous) stored[k] = previous;
      if (incoming) fresh[k] = incoming;
    });
    if (Object.keys(fresh).length) {
      stored = Object.assign({}, stored, fresh);
      cookie('lhi_attr', JSON.stringify(stored), 30);
    } else if (JSON.stringify(rawStored) !== JSON.stringify(stored)) {
      cookie('lhi_attr', JSON.stringify(stored), 30);
    }
    return stored;
  }

  function approvedAnalyticsToken(value, maxLength) {
    var text = String(value || '').trim().toLowerCase();
    if (!text || text.length > (maxLength || 80)) return null;
    if (/@|(?:\d[\s().-]*){7,}/.test(text)) return null;
    return /^[a-z0-9][a-z0-9._-]*$/.test(text) ? text : null;
  }

  function approvedEventID(value) {
    var text = String(value || '').trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) return text;
    if (/^lhi(?:_measurement)?_[a-z0-9_-]{8,140}$/i.test(text)) return text;
    return null;
  }

  function safeProps(props) {
    var out = {};
    var tokenKeys = {
      content_name: 100,
      step: 40,
      page_type: 50,
      source_page_type: 50
    };
    Object.keys(tokenKeys).forEach(function (key) {
      var approved = approvedAnalyticsToken(props && props[key], tokenKeys[key]);
      if (approved) out[key] = approved;
    });

    var eventID = approvedEventID(props && props.event_id);
    if (eventID) out.event_id = eventID;

    var sourcePath = cleanAnalyticsPath(props && props.source_page_path);
    if (sourcePath) out.source_page_path = sourcePath;

    var source = canonicalSourceContext(props || {});
    if (source) Object.assign(out, source);

    var pageKey = String(props && props.page_key || '');
    var registeredPage = hasOwn(MEDICARE_PAGE_REGISTRY, pageKey) ? MEDICARE_PAGE_REGISTRY[pageKey] : null;
    if (registeredPage) {
      out.schema_version = MEDICARE_ATTRIBUTION_SCHEMA_VERSION;
      out.page_key = pageKey;
      out.page_role = registeredPage.page_role;
      out.content_cluster = MEDICARE_CONTENT_CLUSTER;
      out.intent = 'medicare';
      var pageCta = String(props && props.cta_key || '');
      if (hasOwn(registeredPage.cta_keys, pageCta)) out.cta_key = pageCta;
    } else if (pageKey === 'get_help' && String(props && props.page_role || '') === 'intake') {
      out.schema_version = MEDICARE_ATTRIBUTION_SCHEMA_VERSION;
      out.page_key = 'get_help';
      out.page_role = 'intake';
      out.content_cluster = MEDICARE_CONTENT_CLUSTER;
      out.intent = 'medicare';
    }

    if (String(props && props.acceptance_status || '') === 'forms_accepted') {
      out.acceptance_status = 'forms_accepted';
    }
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
      LeadReceiptView: 'lead_receipt_view',
      MedicareIntakeStart: 'medicare_intake_start'
    };
    var ga4Name = directGA4Events[name];
    if (!ga4Name) return;

    var params = Object.assign({}, props.event_params || (name === 'MedicareIntakeStart' ? props : {}));
    delete params.event_params;
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
    if (apiResult && apiResult.ok === true && apiResult.forms === true) {
      props.acceptance_status = 'forms_accepted';
    }

    var intake = medicareIntakeContext();
    if (intake) {
      Object.assign(props, {
        schema_version: MEDICARE_ATTRIBUTION_SCHEMA_VERSION,
        page_key: 'get_help',
        page_role: 'intake',
        content_cluster: MEDICARE_CONTENT_CLUSTER,
        intent: 'medicare'
      });
    }
    var serverSource = canonicalSourceContext(apiResult || {});
    if (serverSource) Object.assign(props, serverSource);

    return props;
  }

  function formPayload(f, fd, content) {
    var payload = {
      content_name: content,
      source_url: cleanAnalyticsPath(w.location.pathname) || '/'
    };
    fd.forEach(function (v, k) {
      payload[k] = v;
    });
    return payload;
  }

  function sitelinkField(form, name) {
    return form && form.elements ? form.elements[name] : null;
  }

  function setSitelinkField(form, name, value) {
    var input = sitelinkField(form, name);
    if (input) input.value = value || '';
  }

  function ensureAttributionField(form, name) {
    var input = sitelinkField(form, name);
    if (input || !form || typeof form.appendChild !== 'function') return input;
    input = d.createElement('input');
    input.type = 'hidden';
    input.name = name;
    form.appendChild(input);
    return input;
  }

  function setAttributionField(form, name, value) {
    var input = ensureAttributionField(form, name);
    if (input) input.value = value || '';
  }

  function initializeFormAttribution(form) {
    var attribution = getAttribution();
    ATTRIBUTION_FIELDS.forEach(function (name) {
      setAttributionField(form, name, approvedAttributionValue(name, attribution[name]));
    });
  }

  function sitelinkReferralClass() {
    if (!d.referrer) return 'direct';
    try {
      return new URL(d.referrer).origin === w.location.origin ? 'internal' : 'external';
    } catch (e) {
      return 'external';
    }
  }

  function initializeSitelinkAttribution(form) {
    initializeFormAttribution(form);
    setSitelinkField(form, 'source_page', String(w.location.pathname || '/').slice(0, 160));
    setSitelinkField(form, 'referral_page', sitelinkReferralClass());

    var startedAt = String(Date.now());
    setSitelinkField(form, 'started_at', startedAt);
    try {
      setSitelinkField(form, 'human_check', w.btoa(startedAt + ':lakeland-human'));
    } catch (e) {
      setSitelinkField(form, 'human_check', '');
    }
  }

  function showSitelinkStatus(form, message) {
    var status = form.querySelector('[data-sitelink-lead-status]');
    if (status) status.textContent = message || '';
  }

  function validateSitelinkContactPath(form) {
    var preferredField = sitelinkField(form, 'preferred_contact_method');
    var phoneField = sitelinkField(form, 'phone');
    var emailField = sitelinkField(form, 'email');
    var preferred = String(preferredField && preferredField.value || '').toLowerCase();
    var phone = String(phoneField && phoneField.value || '').trim();
    var email = String(emailField && emailField.value || '').trim();
    var needsPhone = preferred === 'phone call' || preferred === 'text message';

    setSitelinkField(form, 'consent_call', preferred === 'phone call' ? 'yes' : '');
    setSitelinkField(form, 'consent_sms', preferred === 'text message' ? 'yes' : '');
    setSitelinkField(form, 'consent_email', preferred === 'email' ? 'yes' : '');

    if (needsPhone && !phone) {
      showSitelinkStatus(form, 'Enter a phone number for the contact method you selected.');
      if (phoneField && typeof phoneField.focus === 'function') phoneField.focus();
      return false;
    }
    if (preferred === 'email' && !email) {
      showSitelinkStatus(form, 'Enter an email address for the contact method you selected.');
      if (emailField && typeof emailField.focus === 'function') emailField.focus();
      return false;
    }
    return true;
  }

  function wireSitelinkLeadForms() {
    d.querySelectorAll('form[data-sitelink-lead-form]').forEach(function (form) {
      if (form.__lhiSitelinkLeadWired) return;
      form.__lhiSitelinkLeadWired = true;
      initializeSitelinkAttribution(form);
      form.addEventListener('submit', function (event) {
        showSitelinkStatus(form, '');
        if (!form.checkValidity()) return;
        if (!validateSitelinkContactPath(form)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        showSitelinkStatus(form, 'Sending your request...');
        w.setTimeout(function () {
          if (d.contains(form)) showSitelinkStatus(form, 'If the page does not continue, review the form and try again.');
        }, 12000);
      }, { capture: true });
    });
  }

  function wireHeroZipForms() {
    d.querySelectorAll('form.hero-zip-form[action="/get-help/"]').forEach(function (form) {
      initializeFormAttribution(form);
      if (form.__lhiHeroAttributionWired) return;
      form.__lhiHeroAttributionWired = true;
      form.addEventListener('submit', function () {
        initializeFormAttribution(form);
      }, { capture: true });
    });
  }

  function clearPendingLeadMarker() {
    try { w.sessionStorage.removeItem('lhi_lead_submitted'); } catch (e) {}
  }

  var claimedLeadEventIDs = Object.create(null);

  function completedLeadMarkerHasEventID(eventID) {
    var keys = ['lhi_submission_completed', 'lhi_lead_submitted'];
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = w.sessionStorage.getItem(keys[i]);
        if (!raw) continue;
        var marker = JSON.parse(raw);
        if (marker && marker.kind === 'Lead' && marker.event_id === eventID) return true;
      } catch (e) {}
    }
    return false;
  }

  function claimAcceptedLeadEventID(eventID) {
    if (!approvedEventID(eventID)) return false;
    if (claimedLeadEventIDs[eventID] || completedLeadMarkerHasEventID(eventID)) return false;
    claimedLeadEventIDs[eventID] = true;
    return true;
  }

  function markCompletedSubmission(kind, eventID, props, pt) {
    var marker = {
      kind: kind,
      event_id: eventID,
      content_name: props.content_name || null,
      page_type: pt,
      page_path: cleanAnalyticsPath(w.location.pathname) || '/',
      schema_version: props.schema_version || null,
      page_key: props.page_key || null,
      page_role: props.page_role || null,
      source_page_key: props.source_page_key || null,
      source_page_role: props.source_page_role || null,
      source_cta_key: props.source_cta_key || null,
      content_cluster: props.content_cluster || null,
      intent: props.intent || null,
      acceptance_status: props.acceptance_status || null,
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
        return (typeof res.json === 'function' ? res.json().catch(function () { return null; }) : Promise.resolve(null)).then(function (body) {
          if (!body || body.ok !== true || body.forms !== true || !approvedEventID(body.event_id)) {
            var semanticError = new Error('lead api response was not a confirmed Forms acceptance');
            semanticError.status = 502;
            semanticError.noNativeFallback = true;
            throw semanticError;
          }
          if (typeof onDelivered === 'function') onDelivered(body);
          redirectAfterLead(f);
        });
      }
      var err = new Error('lead api ' + res.status);
      err.status = res.status;
      throw err;
    }).catch(function (err) {
      if (err && ((err.status >= 400 && err.status < 500) || err.noNativeFallback)) {
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
    var suppliedEventID = props.event_id ? String(props.event_id) : null;
    var eventID = suppliedEventID || makeEventID();
    if (props.event_id) delete props.event_id;

    getSession();
    getAttribution();

    // GTM owns the single GA4 and Google Ads Lead conversion tags. Emit its
    // shared custom event only after first-party delivery has succeeded.
    if (name === 'Lead') {
      if (props.acceptance_status !== 'forms_accepted' || !claimAcceptedLeadEventID(suppliedEventID)) return false;
      fireGA('Lead', Object.assign({}, props, {
        event_id: eventID,
        page_type: pt,
        original_event_name: 'Lead'
      }));
      markCompletedSubmission('Lead', eventID, props, pt);
      fireOpenAIAdsLead(eventID);
      return true;
    } else if (name === 'Subscriber') {
      fireGA(name, { page_type: pt, event_params: props });
      markCompletedSubmission('Subscriber', eventID, props, pt);
    } else if (name === 'MedicareIntakeStart') {
      fireGA(name, Object.assign({ page_type: pt }, props));
    } else {
      fireGA(name, { page_type: pt, event_params: props });
    }
    return true;
  }

  function pageView() {
    track('PageView', { page_type: pageType() });
  }

  function trackLeadReceiptView() {
    var marker = w.__LHI_THANKS_LEAD_MARKER;
    if (pageType() !== 'conversion' || !marker) return;
    var receiptProps = {
      content_name: 'lead_thank_you',
      step: 'complete',
      source_page_type: cleanAnalyticsToken(marker.page_type),
      source_page_path: cleanAnalyticsPath(marker.page_path)
    };
    ['schema_version', 'page_key', 'page_role', 'source_page_key', 'source_page_role', 'source_cta_key', 'content_cluster', 'intent', 'acceptance_status'].forEach(function (key) {
      if (marker[key] != null) receiptProps[key] = marker[key];
    });
    track('LeadReceiptView', receiptProps);
  }

  // Auto-wire form submissions -------------------------------------------
  function wireForms() {
    d.querySelectorAll('form[data-funnel-track], form[data-funnel-step]').forEach(function (f) {
      initializeFormAttribution(f);
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
        var intakeContext = medicareIntakeContext();
        if (intakeContext) {
          track('MedicareIntakeStart', Object.assign({ content_name: 'get_help_medicare', step: 'start' }, intakeContext));
        }
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
          // A non-API/native submit has no verifiable Forms receipt. Preserve
          // delivery behavior, but never emit the canonical Lead conversion.
          return;
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
      pageContext: pageContext,
      cleanAnalyticsToken: cleanAnalyticsToken,
      approvedCampaignValue: approvedCampaignValue,
      approvedCampaignTerm: approvedCampaignTerm,
      approvedAttributionValue: approvedAttributionValue,
      getAttribution: getAttribution,
      initializeFormAttribution: initializeFormAttribution,
      wireHeroZipForms: wireHeroZipForms,
      canonicalSourceContext: canonicalSourceContext,
      medicareIntakeContext: medicareIntakeContext,
      safeProps: safeProps,
      OPENAI_ADS_CONFIG_PATH: OPENAI_ADS_CONFIG_PATH,
      OPENAI_ADS_SDK_SRC: OPENAI_ADS_SDK_SRC
    };
  }

  // Give GTM time to initialize (analytics.js loads on interaction/idle/timeout)
  function boot() {
    getAttribution(); // persist UTMs on first hit
    wireHeroZipForms();
    wireSitelinkLeadForms();
    wireForms();
    trackLeadReceiptView();
    setTimeout(pageView, 300);
    // Observe DOM for late-rendered forms (React/etc.)
    if (w.MutationObserver) {
      new MutationObserver(function () {
        wireHeroZipForms();
        wireSitelinkLeadForms();
        wireForms();
      }).observe(d.body, { childList: true, subtree: true });
    }
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window, document);
