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
  var CLICK_ID_FIELDS = ['gclid', 'gbraid', 'wbraid', 'gad_campaignid'];
  var CLICK_ID_STORAGE_FIELDS = CLICK_ID_FIELDS.concat(CLICK_ID_FIELDS.map(function (field) {
    return 'first_' + field;
  }));
  var ATTRIBUTION_COOKIE_DAYS = 30;
  var CLICK_ATTRIBUTION_COOKIE_DAYS = 90;
  var MEDICARE_PAGE_REGISTRY = {
    medicare: {
      path: '/medicare/',
      page_role: 'hub',
      cta_keys: {
        start_review_hero: true,
        request_review_process: true,
        start_review_final: true,
        csnp_section: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    coverage_center: {
      path: '/coverage-center/',
      page_role: 'hub',
      cta_keys: {
        plan_review_medicare_lane: true
      }
    },
    learning: {
      path: '/learning/',
      page_role: 'education',
      cta_keys: {
        request_review_medicare: true,
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
        star_ratings_faq: true,
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
    city_of_lakeland_retiree_medicare_spouse_premium: {
      path: '/blog/city-of-lakeland-retiree-medicare-spouse-premium.html/',
      page_role: 'education',
      cta_keys: {
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
    working_past_65_medicare_lakeland_fl: {
      path: '/working-past-65-medicare-lakeland-fl/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_mid: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    retiring_and_medicare_lakeland_fl: {
      path: '/retiring-and-medicare-lakeland-fl/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_mid: true,
        request_review_final: true,
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
    },
    'medicare-2027-check': {
      path: '/medicare-2027-check/',
      page_role: 'campaign',
      cta_keys: {
        start_review_hero: true,
        request_review_hero: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    medicare_2027_check: {
      path: '/medicare-2027-check/',
      page_role: 'campaign',
      cta_keys: {
        start_review_hero: true,
        request_review_hero: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    orlando_health_watson_clinic_insurance_2026: {
      path: '/blog/orlando-health-watson-clinic-insurance-2026.html/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_mid: true,
        request_review_final: true,
        provider_check_alert: true,
        provider_check_body: true,
        provider_check_bottom: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    orlando_health_watson_clinic_2027_plan: {
      path: '/blog/orlando-health-watson-clinic-2027-plan.html/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_mid: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    watson_clinic_humana_2027: {
      path: '/blog/watson-clinic-humana-2027.html/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    switch_to_medigap_plan_g_non_renewal: {
      path: '/blog/switch-to-medigap-plan-g-non-renewal.html/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    baycare_medicare_advantage_plans_2027_polk: {
      path: '/blog/baycare-medicare-advantage-plans-2027-polk-county.html/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    lakeland_regional_unitedhealthcare_2027: {
      path: '/local-health-insurance-answers/lakeland-regional-unitedhealthcare-2027/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    watson_clinic_insurance_network_help: {
      path: '/local-health-insurance-answers/watson-clinic-insurance-network-help/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_mid: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    medicare_plan_help_lakeland: {
      path: '/local-health-insurance-answers/medicare-plan-help-lakeland/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_mid: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    medicare_advantage_lakeland_2026: {
      path: '/blog/medicare-advantage-lakeland-2026.html/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    orlando_health_polk_county_expansion_2026: {
      path: '/blog/orlando-health-polk-county-expansion-2026.html/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    medicare_part_b_giveback_polk_county: {
      path: '/blog/medicare-part-b-giveback-polk-county.html/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    medicare_advantage_plan_ending_what_now: {
      path: '/blog/medicare-advantage-plan-ending-what-now.html/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    medicare_extra_help_savings_programs_polk_county: {
      path: '/blog/medicare-extra-help-savings-programs-polk-county.html/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    medicare_improvement_fund_90_rebate_florida: {
      path: '/blog/medicare-improvement-fund-90-rebate-florida.html/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_mid: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    medigap_plan_g_vs_plan_n: {
      path: '/blog/medigap-plan-g-vs-plan-n.html/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    medicare_part_d_lakeland_fl: {
      path: '/medicare-part-d-lakeland-fl/',
      page_role: 'education',
      cta_keys: {
        request_review_hero: true,
        exceptions_aep: true,
        request_review_mid: true,
        request_review_final: true,
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

  function landingSearch() {
    try {
      if (w.LHILandingQuery && w.LHILandingQuery.search != null) {
        return String(w.LHILandingQuery.search || '');
      }
    } catch (e) {}
    try {
      if (w.sessionStorage && typeof w.sessionStorage.getItem === 'function') {
        var stored = JSON.parse(w.sessionStorage.getItem('lhi_landing_query') || 'null');
        if (stored && stored.search != null && stored.pathname === String(w.location.pathname || '/')) {
          return String(stored.search || '');
        }
      }
    } catch (e) {}
    return String(w.location.search || '');
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
    var search = landingSearch();
    var context = null;
    try {
      if (w.LHIMedicareAttribution && typeof w.LHIMedicareAttribution.sourceContext === 'function') {
        context = w.LHIMedicareAttribution.sourceContext(search);
      }
    } catch (e) {}
    return canonicalSourceContext(context || {}) || sourceContextFromSearch(search);
  }

  function medicareIntakeContext() {
    if (normalizePath(w.location.pathname) !== '/get-help/') return null;
    var qs = new URLSearchParams(landingSearch());
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
    if (p.indexOf('/medicare-2027-check') === 0) return 'medicare-2027-check';
    if (p.indexOf('/aca-2027-check') === 0) return 'aca-2027-check';
    if (p.indexOf('/lp/gap') === 0) return 'lp_gap';
    if (p.indexOf('/carriers/') === 0) return 'carrier_lp';
    if (p.indexOf('/blog/') === 0) return 'blog';
    if (p.indexOf('/aca-subsidy-estimator') === 0) return 'estimator';
    if (p.indexOf('/get-help') === 0) return 'get_help';
    if (p.indexOf('/health-protector-guard') === 0) return 'guard_lp';
    if (p.indexOf('/aca-health-insurance-agent-polk') === 0) return 'local_seo_aca';
    if (p.indexOf('/aca-health-insurance-lakeland') === 0) return 'local_seo_aca';
    if (p.indexOf('/best-medicare-broker-lakeland') === 0) return 'local_seo_medicare';
    if (p.indexOf('/medicare-broker-lakeland') === 0) return 'local_seo_medicare';
    if (p.indexOf('/health-insurance-broker-lakeland') === 0) return 'local_seo_broker';
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

  var UTM_VALUE_MAX_LENGTH = 64;

  function approvedCampaignValue(value) {
    var text = String(value || '').trim().toLowerCase();
    if (!text) return null;
    // Google Ads suffixes prefix {campaignid} so platform IDs remain
    // distinguishable from untrusted phone-like numeric values.
    if (/^cid_\d{8,20}$/.test(text)) {
      return text.length <= UTM_VALUE_MAX_LENGTH ? text : text.slice(0, UTM_VALUE_MAX_LENGTH);
    }
    if (/@|(?:\d[\s().-]*){7,}/.test(text)) return null;
    text = text.replace(/[^a-z0-9_-]/g, '').slice(0, UTM_VALUE_MAX_LENGTH);
    return text || null;
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

  function approvedClickID(value) {
    var text = String(value || '').trim();
    if (!text || text.length > 512) return null;
    return /^[a-z0-9._~-]+$/i.test(text) ? text : null;
  }

  function approvedGoogleCampaignID(value) {
    var text = String(value || '').trim();
    return /^\d{1,20}$/.test(text) ? text : null;
  }

  function approvedClickAttributionValue(name, value) {
    return String(name || '').indexOf('gad_campaignid') !== -1
      ? approvedGoogleCampaignID(value)
      : approvedClickID(value);
  }

  function persistAttribution(stored) {
    var days = CLICK_ID_STORAGE_FIELDS.some(function (field) { return stored[field]; })
      ? CLICK_ATTRIBUTION_COOKIE_DAYS
      : ATTRIBUTION_COOKIE_DAYS;
    cookie('lhi_attr', JSON.stringify(stored), days);
  }

  function getAttribution() {
    var qs = new URLSearchParams(landingSearch());
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
    CLICK_ID_FIELDS.forEach(function (k) {
      var previous = approvedClickAttributionValue(k, rawStored[k]);
      var incoming = approvedClickAttributionValue(k, qs.get(k));
      var previousFirst = approvedClickAttributionValue(k, rawStored['first_' + k]);
      if (previous) stored[k] = previous;
      if (previousFirst) stored['first_' + k] = previousFirst;
      if (incoming) {
        fresh[k] = incoming;
        stored[k] = incoming;
        if (!stored['first_' + k]) stored['first_' + k] = incoming;
      } else if (stored[k] && !stored['first_' + k]) {
        stored['first_' + k] = stored[k];
      }
    });
    if (Object.keys(fresh).length) {
      stored = Object.assign({}, stored, fresh);
      persistAttribution(stored);
    } else if (JSON.stringify(rawStored) !== JSON.stringify(stored)) {
      persistAttribution(stored);
    }
    return stored;
  }

  function isLeadClickAttributionForm(form) {
    if (!form || typeof form.getAttribute !== 'function') return false;
    if (form.getAttribute('data-funnel-event') === 'Lead') return true;
    return Boolean(form.hasAttribute && form.hasAttribute('data-sitelink-lead-form'));
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
    if (!input) return;
    if (String(input.type || '').toLowerCase() === 'checkbox') {
      input.value = 'yes';
      input.checked = Boolean(value);
      return;
    }
    input.value = value || '';
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

  function readAbVariantForForms() {
    if (w.LHIAbVariant && typeof w.LHIAbVariant.getVariant === 'function') {
      return w.LHIAbVariant.getVariant();
    }
    try {
      var match = d.cookie.match(/(?:^|; )lhi_ab_variant=([^;]*)/);
      if (!match) return 'control';
      var text = decodeURIComponent(match[1]).trim().toLowerCase();
      if (text === 'home-hero-primary-b') return text;
    } catch (e) {}
    return 'control';
  }

  function applyLeadFirstTouchToForm(form) {
    if (w.LHILeadFirstTouch && typeof w.LHILeadFirstTouch.applyToForm === 'function') {
      w.LHILeadFirstTouch.applyToForm(form);
    }
  }

  function initializeFormAttribution(form) {
    var attribution = getAttribution();
    ATTRIBUTION_FIELDS.forEach(function (name) {
      setAttributionField(form, name, approvedAttributionValue(name, attribution[name]));
    });
    setAttributionField(form, 'ab_variant', readAbVariantForForms());
    if (!isLeadClickAttributionForm(form)) return;
    CLICK_ID_STORAGE_FIELDS.forEach(function (name) {
      setAttributionField(form, name, approvedClickAttributionValue(name, attribution[name]));
    });
    applyLeadFirstTouchToForm(form);
  }

  function ensureLeadSpamGuard(form) {
    if (!form || typeof form.setAttribute !== 'function') return;
    if (!form.getAttribute('data-netlify-honeypot')) {
      form.setAttribute('data-netlify-honeypot', 'bot-field');
    }
    if (!form.querySelector('input[name="bot-field"]')) {
      var honeypotWrap = d.createElement('div');
      honeypotWrap.hidden = true;
      honeypotWrap.setAttribute('aria-hidden', 'true');
      var label = d.createElement('label');
      var input = d.createElement('input');
      input.name = 'bot-field';
      input.tabIndex = -1;
      input.autocomplete = 'off';
      label.appendChild(d.createTextNode('Do not fill this out '));
      label.appendChild(input);
      honeypotWrap.appendChild(label);
      form.insertBefore(honeypotWrap, form.firstChild);
    }
    var startedInput = form.elements && form.elements.started_at;
    if (startedInput && String(startedInput.value || '').trim()) return;
    var navOffset = w.performance && typeof w.performance.now === 'function'
      ? Math.max(0, Math.round(w.performance.now()))
      : 0;
    var startedAt = String(Date.now() - navOffset);
    setAttributionField(form, 'started_at', startedAt);
    try {
      setAttributionField(form, 'human_check', w.btoa(startedAt + ':lakeland-human'));
    } catch (e) {
      setAttributionField(form, 'human_check', '');
    }
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

    var navOffset = w.performance && typeof w.performance.now === 'function'
      ? Math.max(0, Math.round(w.performance.now()))
      : 0;
    var startedAt = String(Date.now() - navOffset);
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

  var SITELINK_COVERAGE_MAP = {
    marketplace: {
      inquiry_type: 'ACA Marketplace',
      normalized_intent: 'aca',
      line_of_business: 'ACA Marketplace'
    },
    medicare: {
      inquiry_type: 'Medicare',
      normalized_intent: 'medicare',
      line_of_business: 'Medicare'
    }
  };
  var LICENSED_MEDICARE_STATES = {
    AL: true,
    AZ: true,
    FL: true,
    GA: true,
    IA: true,
    IN: true,
    KS: true,
    LA: true,
    MD: true,
    MI: true,
    MO: true,
    MS: true,
    NC: true,
    NE: true,
    NJ: true,
    OH: true,
    OK: true,
    SC: true,
    TN: true,
    TX: true,
    VA: true,
    WA: true,
    WV: true
  };

  function sitelinkCoverageStateFromQuery() {
    try {
      var code = String(new URLSearchParams(w.location.search || '').get('state') || '').trim().toUpperCase();
      return code.length === 2 ? code : '';
    } catch (e) {
      return '';
    }
  }

  function syncStandaloneMedicareScopeNote(form) {
    if (!form) return;
    var note = form.querySelector('#outOfStateMedicareNote');
    if (!note || form.hasAttribute('data-sitelink-coverage-choice')) return;
    var intentField = form.querySelector('input[name="normalized_intent"]');
    var intent = String(intentField && intentField.value || '').toLowerCase();
    if (intent && intent !== 'medicare') {
      note.hidden = true;
      return;
    }
    var coverageState = sitelinkCoverageStateFromQuery();
    note.hidden = Boolean(coverageState) && Object.prototype.hasOwnProperty.call(LICENSED_MEDICARE_STATES, coverageState);
  }

  function syncSitelinkCoverageChoice(form) {
    if (!form || !form.hasAttribute('data-sitelink-coverage-choice')) return;
    var selected = form.querySelector('input[name="coverage_choice"]:checked');
    var choice = String(selected && selected.value || '').toLowerCase();
    var map = selected && SITELINK_COVERAGE_MAP[choice];
    if (!map) return;
    setSitelinkField(form, 'inquiry_type', map.inquiry_type);
    setSitelinkField(form, 'normalized_intent', map.normalized_intent);
    setSitelinkField(form, 'line_of_business', map.line_of_business);
    var floridaMedicareNote = form.querySelector('[data-sitelink-medicare-florida-note]');
    if (floridaMedicareNote) {
      if (choice !== 'medicare') {
        floridaMedicareNote.hidden = true;
      } else {
        var coverageState = sitelinkCoverageStateFromQuery();
        floridaMedicareNote.hidden = Boolean(coverageState) && Object.prototype.hasOwnProperty.call(LICENSED_MEDICARE_STATES, coverageState);
      }
    }
  }

  function wireSitelinkCoverageChoice(form) {
    if (!form || form.__lhiSitelinkCoverageWired || !form.hasAttribute('data-sitelink-coverage-choice')) return;
    form.__lhiSitelinkCoverageWired = true;
    syncSitelinkCoverageChoice(form);
    form.querySelectorAll('input[name="coverage_choice"]').forEach(function (input) {
      input.addEventListener('change', function () {
        syncSitelinkCoverageChoice(form);
      });
    });
  }

  function usesSitelinkCheckboxConsent(form) {
    if (form.hasAttribute && form.hasAttribute('data-sitelink-v2-consent')) return true;
    return !sitelinkField(form, 'preferred_contact_method');
  }

  function validateSitelinkContactPath(form) {
    var phoneField = sitelinkField(form, 'phone');
    var phone = String(phoneField && phoneField.value || '').trim();
    if (usesSitelinkCheckboxConsent(form)) {
      var callField = sitelinkField(form, 'consent_call');
      var smsField = sitelinkField(form, 'consent_sms');
      var callChecked = Boolean(callField && callField.checked);
      var smsChecked = Boolean(smsField && smsField.checked);
      if (callField && typeof callField.setCustomValidity === 'function') callField.setCustomValidity('');
      if (smsField && typeof smsField.setCustomValidity === 'function') smsField.setCustomValidity('');
      setSitelinkField(form, 'consent_call', callChecked ? 'yes' : '');
      setSitelinkField(form, 'consent_sms', smsChecked ? 'yes' : '');
      setSitelinkField(form, 'consent_email', '');
      if (!phone) {
        showSitelinkStatus(form, 'Enter your phone number.');
        if (phoneField && typeof phoneField.focus === 'function') phoneField.focus();
        return false;
      }
      if (!callChecked && !smsChecked) {
        showSitelinkStatus(form, 'Select at least one contact channel you authorize.');
        if (callField && typeof callField.setCustomValidity === 'function') {
          callField.setCustomValidity('Select at least one contact channel you authorize.');
          if (typeof callField.reportValidity === 'function') {
            try { callField.reportValidity(); } catch (e) {}
          }
        }
        if (callField && typeof callField.focus === 'function') callField.focus();
        return false;
      }
      return true;
    }

    var preferredField = sitelinkField(form, 'preferred_contact_method');
    var emailField = sitelinkField(form, 'email');
    var preferred = String(preferredField && preferredField.value || '').toLowerCase();
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

  function showInlineSitelinkThankYou(form) {
    var panel = form.closest('#m27LeadPanel') || form.parentElement;
    var message = form.getAttribute('data-inline-thank-you-message') || 'Thanks — David will call you, usually same day.';
    if (!panel) return;
    panel.innerHTML = '<div class="m27-thanks" role="status" aria-live="polite"><h2>Request received</h2><p>' + message + ' Call or text <a href="tel:+18636403102">(863) 640-3102</a>.</p><p style="margin:0.85rem 0;"><a class="cta-button m27-submit-style" href="/book/" data-funnel-booking>Want an exact time? Pick a 15-min slot on David\u2019s calendar \u2192</a></p><p style="font-size:0.88rem;opacity:0.92;margin:0.5rem 0 0;">Tip: Save <strong>(863) 640-3102</strong> in your contacts now so your phone doesn\u2019t silence David\u2019s call.</p></div>';
    try {
      track('LeadReceiptView', {
        content_name: 'lead_thank_you',
        step: 'complete',
        source_page_type: pageType(),
        source_page_path: cleanAnalyticsPath(w.location.pathname) || '/'
      });
    } catch (e) {}
  }

  function zipToStateCode(rawZip) {
    var digits = String(rawZip || '').replace(/\D/g, '').slice(0, 5);
    if (digits.length !== 5) return '';
    var p = parseInt(digits.slice(0, 3), 10);
    if (p >= 320 && p <= 349) return 'FL';
    if (p >= 350 && p <= 369) return 'AL';
    if (p >= 850 && p <= 865) return 'AZ';
    if ((p >= 300 && p <= 319) || p === 398 || p === 399) return 'GA';
    if (p >= 500 && p <= 528) return 'IA';
    if (p >= 460 && p <= 479) return 'IN';
    if (p >= 660 && p <= 679) return 'KS';
    if (p >= 700 && p <= 714) return 'LA';
    if (p >= 206 && p <= 219) return 'MD';
    if (p >= 480 && p <= 499) return 'MI';
    if (p >= 630 && p <= 658) return 'MO';
    if (p >= 386 && p <= 397) return 'MS';
    if (p >= 270 && p <= 289) return 'NC';
    if (p >= 680 && p <= 693) return 'NE';
    if (p >= 70 && p <= 89) return 'NJ';
    if (p >= 430 && p <= 459) return 'OH';
    if (p >= 730 && p <= 749) return 'OK';
    if (p >= 290 && p <= 299) return 'SC';
    if (p >= 370 && p <= 385) return 'TN';
    if ((p >= 750 && p <= 799) || p === 885) return 'TX';
    if (p === 201 || (p >= 220 && p <= 246)) return 'VA';
    if (p >= 980 && p <= 994) return 'WA';
    if (p >= 247 && p <= 268) return 'WV';
    if (p >= 900 && p <= 961) return 'CA';
    if (p >= 100 && p <= 149) return 'NY';
    if (p >= 600 && p <= 629) return 'IL';
    if (p >= 10 && p <= 27) return 'MA';
    if (p >= 150 && p <= 196) return 'PA';
    if (p >= 800 && p <= 816) return 'CO';
    return '';
  }

  function syncFormZipStateFields(form, rawZip) {
    if (!form || typeof form.querySelector !== 'function') return '';
    var stateCode = zipToStateCode(rawZip);
    if (!stateCode) return '';
    setAttributionField(form, 'coverage_state', stateCode);
    setAttributionField(form, 'state', stateCode);
    return stateCode;
  }

  function applyStep1CoverageToForm(form, rawIntent) {
    if (!form || typeof form.querySelector !== 'function') return;
    var intent = String(rawIntent || '').trim().toLowerCase();
    var choiceRadio = form.querySelector('input[name="coverage_choice"][value="' + (intent === 'medicare' ? 'medicare' : 'marketplace') + '"]');
    if (choiceRadio) {
      choiceRadio.checked = true;
      syncSitelinkCoverageChoice(form);
    }
    var select = form.querySelector('select[name="coverage_status"]');
    if (select) {
      var candidates = intent === 'medicare'
        ? ['medicare_advantage', 'current_plan_review', 'turning_65', 'not_sure']
        : intent === 'lost-coverage'
          ? ['losing_coverage', 'individual_marketplace', 'not_sure']
          : intent === 'provider-check'
            ? ['current_plan_review', 'medicare_advantage', 'individual_marketplace', 'not_sure']
            : ['individual_marketplace', 'family_marketplace', 'self_employed', 'current_plan_review', 'not_sure'];
      for (var i = 0; i < candidates.length; i += 1) {
        var opt = select.querySelector('option[value="' + candidates[i] + '"]');
        if (opt) {
          select.value = candidates[i];
          break;
        }
      }
    }
  }

  function wireStep1MicroIntakes() {
    if (!d.querySelectorAll) return;
    d.querySelectorAll('[data-lhi-step1-intake]').forEach(function (box) {
      if (box.__lhiStep1Wired) return;
      box.__lhiStep1Wired = true;
      var zipInput = box.querySelector('[data-step1-zip]');
      var intentInput = box.querySelector('[data-step1-intent]');
      var continueBtn = box.querySelector('[data-step1-continue]');
      var errorEl = box.querySelector('[data-step1-error]');
      var targetSelector = box.getAttribute('data-step1-form') || '';

      function resolveStep2Form() {
        if (targetSelector) {
          var explicitForm = d.querySelector(targetSelector);
          if (explicitForm) return explicitForm;
        }
        return d.querySelector('form[data-lhi-site-lead-form], form[data-sitelink-lead-form]');
      }

      function markStarted() {
        var step2 = resolveStep2Form();
        if (typeof w.lhiTrackFormStart === 'function') {
          try { w.lhiTrackFormStart(step2 || box); } catch (e) {}
        }
      }

      function syncToStep2() {
        var step2 = resolveStep2Form();
        var cleanZip = zipInput ? String(zipInput.value || '').replace(/\D/g, '').slice(0, 5) : '';
        if (zipInput && zipInput.value !== cleanZip && /^\d+$/.test(String(zipInput.value || ''))) {
          zipInput.value = cleanZip;
        }
        if (errorEl && cleanZip.length === 5 && (!errorEl.classList || !errorEl.classList.contains('is-success'))) {
          errorEl.textContent = '';
        }
        if (!step2) return cleanZip;
        if (cleanZip.length === 5) {
          var step2Zip = step2.querySelector('input[name="zip_code"]');
          if (step2Zip) step2Zip.value = cleanZip;
          syncFormZipStateFields(step2, cleanZip);
        }
        if (intentInput) {
          applyStep1CoverageToForm(step2, intentInput.value);
        }
        return cleanZip;
      }

      if (zipInput) {
        ['focus', 'input', 'change'].forEach(function (evt) {
          zipInput.addEventListener(evt, function () {
            markStarted();
            syncToStep2();
          });
        });
        zipInput.addEventListener('keydown', function (ev) {
          if (ev && ev.key === 'Enter') {
            ev.preventDefault();
            if (continueBtn) continueBtn.click();
          }
        });
      }
      if (intentInput) {
        ['focus', 'change'].forEach(function (evt) {
          intentInput.addEventListener(evt, function () {
            markStarted();
            syncToStep2();
          });
        });
      }
      if (continueBtn) {
        continueBtn.addEventListener('click', function () {
          markStarted();
          var cleanZip = syncToStep2();
          if (!/^\d{5}$/.test(cleanZip)) {
            if (errorEl) {
              if (errorEl.classList) errorEl.classList.remove('is-success');
              errorEl.textContent = 'Enter a 5-digit ZIP code to continue.';
            }
            if (zipInput && typeof zipInput.focus === 'function') zipInput.focus();
            return;
          }
          if (errorEl) {
            if (errorEl.classList) errorEl.classList.remove('is-success');
            errorEl.textContent = '';
          }
          var selectedIntent = intentInput ? String(intentInput.value || 'not-sure').trim().toLowerCase() : 'not-sure';
          var stateCode = zipToStateCode(cleanZip) || 'FL';
          var step2 = resolveStep2Form();
          var forceGetHelp = box.getAttribute('data-step1-route') === 'get-help';
          var formName = step2 ? String(step2.getAttribute('name') || '') : '';
          var hasCoverageChoice = Boolean(step2 && step2.hasAttribute && step2.hasAttribute('data-sitelink-coverage-choice'));
          var fixedIntentInput = (!hasCoverageChoice && step2 && step2.querySelector)
            ? step2.querySelector('input[type="hidden"][name="normalized_intent"]')
            : null;
          var fixedIntent = fixedIntentInput ? String(fixedIntentInput.value || '').trim().toLowerCase() : '';
          var isMedicareOnlyForm = formName === 'site-medicare-lead' || fixedIntent === 'medicare';
          var isAcaOnlyForm = formName === 'site-aca-lead' || fixedIntent === 'aca';
          var laneMismatch = Boolean(
            (isMedicareOnlyForm && (selectedIntent === 'under-65' || selectedIntent === 'aca' || selectedIntent === 'lost-coverage')) ||
            (isAcaOnlyForm && selectedIntent === 'medicare')
          );

          if (!step2 || forceGetHelp || laneMismatch) {
            if (typeof w.lhiTrackPlanReviewCtaClick === 'function') {
              try { w.lhiTrackPlanReviewCtaClick('step1_continue_get_help'); } catch (e) {}
            }
            var params = new URLSearchParams();
            params.set('zip_code', cleanZip);
            params.set('intent', selectedIntent === 'aca' ? 'under-65' : selectedIntent);
            if (stateCode) params.set('state', stateCode);
            var pageKey = box.getAttribute('data-source-page-key') || (d.body && d.body.getAttribute('data-page-key')) || '';
            if (pageKey && selectedIntent === 'medicare') {
              params.set('source_page_key', pageKey);
              params.set('source_cta_key', 'request_review_hero');
            }
            w.location.href = '/get-help/?' + params.toString();
            return;
          }

          box.classList.add('is-step1-complete');
          if (errorEl) {
            if (errorEl.classList) errorEl.classList.add('is-success');
            errorEl.textContent = 'ZIP ' + cleanZip + ' saved. Enter your name and phone in Step 2.';
          }
          var card = step2.closest('.lhi-lead-hero__card') || step2;
          if (card && card.classList) card.classList.add('is-step2-active');
          var nameInput = step2.querySelector('input[name="full_name"]');
          if (nameInput) {
            if (typeof nameInput.scrollIntoView === 'function') {
              try { nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
            }
            if (typeof nameInput.focus === 'function') {
              try { nameInput.focus({ preventScroll: true }); } catch (e) { nameInput.focus(); }
            }
          }
        });
      }
    });
  }

  function syncLandingMedicareDisclosures() {
    var intake = w.LHIGetHelpIntake;
    if (!intake || typeof intake.syncGetHelpMedicareDisclosures !== 'function') return;
    if (!d.getElementById('medicareTpmoDisclaimer')) return;
    try {
      intake.syncGetHelpMedicareDisclosures(intake.resolveCoverageState(new URLSearchParams(w.location.search || '')));
    } catch (e) {}
  }

  function wireSitelinkLeadForms() {
    d.querySelectorAll('form[data-sitelink-lead-form]').forEach(function (form) {
      if (form.__lhiSitelinkLeadWired) return;
      form.__lhiSitelinkLeadWired = true;
      wireSitelinkCoverageChoice(form);
      syncStandaloneMedicareScopeNote(form);
      initializeSitelinkAttribution(form);
      ['consent_call', 'consent_sms'].forEach(function (fieldName) {
        var el = sitelinkField(form, fieldName);
        if (el && typeof el.addEventListener === 'function') {
          el.addEventListener('change', function () {
            var cField = sitelinkField(form, 'consent_call');
            var sField = sitelinkField(form, 'consent_sms');
            if (cField && typeof cField.setCustomValidity === 'function') cField.setCustomValidity('');
            if (sField && typeof sField.setCustomValidity === 'function') sField.setCustomValidity('');
            showSitelinkStatus(form, '');
          });
        }
      });
      form.addEventListener('submit', function (event) {
        showSitelinkStatus(form, '');
        syncSitelinkCoverageChoice(form);
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
    if (f.hasAttribute && f.hasAttribute('data-sitelink-inline-thank-you')) {
      showInlineSitelinkThankYou(f);
      return;
    }
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
          if (body && body.ok === true && body.silent_spam_drop === true) {
            redirectAfterLead(f);
            return;
          }
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
        var startedEl = f.elements && f.elements.started_at;
        var startedVal = startedEl && String(startedEl.value || '').trim();
        if (startedVal) {
          try {
            setAttributionField(f, 'human_check', w.btoa(startedVal + ':lakeland-human'));
          } catch (e) {
            setAttributionField(f, 'human_check', '');
          }
        } else {
          ensureLeadSpamGuard(f);
        }
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
    /* First-party dataLayer diagnostic only. GTM does not map this custom
       PageView event to GA4 page_view; /js/analytics.js owns that hit. */
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
      ensureLeadSpamGuard(f);
      if (f.__lhiWired) return;
      f.__lhiWired = true;
      f.__lhiFormStarted = false;
      var name = f.getAttribute('data-funnel-event') || 'Lead';
      var step = f.getAttribute('data-funnel-step') || 'submit';
      var content = f.getAttribute('data-funnel-name') || (pageType() + '_' + step);

      function trackFormStart() {
        if (f.__lhiFormStarted) return;
        f.__lhiFormStarted = true;
        if (name === 'Lead' && typeof w.lhiTrackFormStart === 'function') {
          try { w.lhiTrackFormStart(f); } catch (e) {}
        }
        track('StartLead', { content_name: content, step: 'start' });
        var intakeContext = medicareIntakeContext();
        if (intakeContext) {
          track('MedicareIntakeStart', Object.assign({ content_name: 'get_help_medicare', step: 'start' }, intakeContext));
        }
      }

      if (typeof f.querySelector === 'function') {
        var zipEl = f.querySelector('input[name="zip_code"]');
        if (zipEl && !zipEl.__lhiZipStateWired) {
          zipEl.__lhiZipStateWired = true;
          ['input', 'change'].forEach(function (evt) {
            zipEl.addEventListener(evt, function () {
              syncFormZipStateFields(f, zipEl.value);
            });
          });
        }
      }

      ['focusin', 'input', 'change'].forEach(function (type) {
        f.addEventListener(type, trackFormStart, { capture: true });
      });

      f.addEventListener('submit', function (e) {
        initializeFormAttribution(f);
        if (typeof f.querySelector === 'function') {
          var currentZipEl = f.querySelector('input[name="zip_code"]');
          if (currentZipEl && String(currentZipEl.value || '').trim()) {
            syncFormZipStateFields(f, currentZipEl.value);
          }
        }
        var fd = new FormData(f);
        trackFormStart();

        if ((name === 'Lead' || name === 'Subscriber') && !f.hasAttribute('data-funnel-api-opt-out')) {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          submitLeadViaApi(f, formPayload(f, fd, content), function (apiResult) {
            if (name === 'Lead') {
              track(name, safeLeadPropsFromForm(f, fd, content, step, apiResult));
              if (apiResult && apiResult.event_id &&
                  typeof w.lhiEmitVerifiedLeadConversions === 'function') {
                try {
                  w.lhiEmitVerifiedLeadConversions(apiResult.event_id, {
                    form_id: f.id || (typeof f.getAttribute === 'function' && f.getAttribute('name')) || content
                  });
                } catch (e) {}
              }
              if (apiResult && apiResult.form_submit_complete_event_id &&
                  typeof w.lhiTrackMetaFormSubmitComplete === 'function') {
                try {
                  w.lhiTrackMetaFormSubmitComplete(apiResult.form_submit_complete_event_id);
                } catch (e) {}
              }
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
        if (typeof w.lhiTrackMetaMessageStart === 'function') {
          try { w.lhiTrackMetaMessageStart(); } catch (e) {}
        }
      });
    });
  }

  // Boot ------------------------------------------------------------------
  w.LHI = { track: track, pageType: pageType, session: getSession, getAttribution: getAttribution };

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
      approvedClickID: approvedClickID,
      approvedGoogleCampaignID: approvedGoogleCampaignID,
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

  function whenLeadFirstTouchReady(cb) {
    if (typeof cb !== 'function') return;
    if (w.LHILeadFirstTouch) {
      cb();
      return;
    }
    if (typeof w.__LHI_whenLeadFirstTouchReady === 'function') {
      w.__LHI_whenLeadFirstTouchReady(cb);
      return;
    }
    cb();
  }

  // Give GTM time to initialize (analytics.js loads on interaction/idle/timeout)
  function boot() {
    getAttribution(); // persist UTMs on first hit
    wireHeroZipForms();
    wireStep1MicroIntakes();
    wireSitelinkLeadForms();
    wireForms();
    syncLandingMedicareDisclosures();
    trackLeadReceiptView();
    setTimeout(pageView, 300);
    if (w.addEventListener) {
      w.addEventListener('load', syncLandingMedicareDisclosures, { once: true });
    }
    // Observe DOM for late-rendered forms (React/etc.)
    if (w.MutationObserver) {
      new MutationObserver(function () {
        wireHeroZipForms();
        wireStep1MicroIntakes();
        wireSitelinkLeadForms();
        wireForms();
      }).observe(d.body, { childList: true, subtree: true });
    }
  }

  function start() {
    whenLeadFirstTouchReady(boot);
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window, document);
