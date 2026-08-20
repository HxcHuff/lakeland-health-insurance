/* Google Ads website-call replacement starts eagerly; general GTM/GA4
   analytics remain deferred until after page interactive. */
/* Google tags only fire on production host. Netlify deploy previews, branch
   deploys, and localhost are explicitly excluded to keep reporting clean. */
(function(){
  var loaded=false;
  var funnelRequested=false;
  var websiteCallTrackingInitialized=false;
  var googleTagScriptRequested=false;
  var cachedGoogleForwardingNumber=null;
  var lastPhoneCanonicalAt = 0;
  var BUSINESS_PHONE_E164 = '+18636403102';
  var BUSINESS_PHONE_HREF = 'tel:' + BUSINESS_PHONE_E164;
  var MEDICARE_ATTRIBUTION_SCHEMA_VERSION = 'medicare-attribution.v1';
  var MEDICARE_CONTENT_CLUSTER = 'lakeland_medicare_broker';
  var MEDICARE_PAGE_REGISTRY = {
    '/medicare/': {
      page_key: 'medicare',
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
    '/blog/aep-2026-polk-county-checklist.html/': {
      page_key: 'aep_2026_polk_county_checklist',
      page_role: 'education',
      cta_keys: {
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    '/blog/medicare-supplement-cost-lakeland.html/': {
      page_key: 'medicare_supplement_cost_lakeland',
      page_role: 'education',
      cta_keys: {
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    '/blog/medicare-vs-aca-central-florida-age-65.html/': {
      page_key: 'medicare_vs_aca_central_florida_age_65',
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
    '/blog/turning-65-medicare-checklist-florida.html/': {
      page_key: 'turning_65_medicare_checklist_florida',
      page_role: 'education',
      cta_keys: {
        request_review_nav: true,
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    '/blog/when-can-i-switch-medicare-plans-florida.html/': {
      page_key: 'when_can_i_switch_medicare_plans_florida',
      page_role: 'education',
      cta_keys: {
        request_review_final: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    '/medicare/east-polk/': {
      page_key: 'medicare_east_polk',
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
    '/moving-florida-medicare/': {
      page_key: 'moving_florida_medicare',
      page_role: 'education',
      cta_keys: {
        request_move_review: true,
        request_related_review: true,
        menu_get_help: true,
        header_talk_to_david: true,
        footer_start_plan_review: true
      }
    },
    '/best-medicare-broker-lakeland-fl/': {
      page_key: 'best_medicare_broker_lakeland_fl',
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
    '/medicare-broker-lakeland-fl/': {
      page_key: 'medicare_broker_lakeland_fl',
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

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };

  /* ---- Production-host gate -------------------------------------------- */
  var host = (typeof location !== 'undefined' && location.hostname || '').toLowerCase();
  var PROD_HOSTS = ['lakelandhealthinsurance.com', 'www.lakelandhealthinsurance.com'];
  var IS_PROD = PROD_HOSTS.indexOf(host) !== -1;

  /* Session-bounded QA override. ?analytics_test=1 enables Google tags for the
     current tab only; ?analytics_test=0 clears the override. Never persist the
     override across browser sessions, because that contaminates reporting. */
  var IS_ANALYTICS_DEBUG = false;
  try {
    var qsForce = /[?&]analytics_test=1\b/.test(location.search);
    var qsClear = /[?&]analytics_test=0\b/.test(location.search);
    if (qsClear) sessionStorage.removeItem('lhi_analytics_test');
    if (qsForce) sessionStorage.setItem('lhi_analytics_test', '1');
    IS_ANALYTICS_DEBUG = !qsClear && (qsForce || sessionStorage.getItem('lhi_analytics_test') === '1');
    if (IS_ANALYTICS_DEBUG) IS_PROD = true;
  } catch (e) {}

  if (window.console && console.info) {
    console.info('[LHI analytics] Google analytics gate:', IS_PROD ? 'ENABLED' : 'SKIPPED (non-prod host)');
  }

  /* Expose for other scripts (funnel.js) */
  window.__LHI_IS_PROD = IS_PROD;
  window.__LHI_ANALYTICS_DEBUG = IS_ANALYTICS_DEBUG;

  function pushDataLayerEvent(name, params) {
    window.dataLayer.push(Object.assign({ event: name }, params || {}));
  }

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

  function medicarePageContext(pathname) {
    var normalized = normalizePath(pathname);
    if (!hasOwn(MEDICARE_PAGE_REGISTRY, normalized)) return null;
    var registered = MEDICARE_PAGE_REGISTRY[normalized];
    return {
      schema_version: MEDICARE_ATTRIBUTION_SCHEMA_VERSION,
      page_key: registered.page_key,
      page_role: registered.page_role,
      content_cluster: MEDICARE_CONTENT_CLUSTER,
      intent: 'medicare'
    };
  }

  function registryForPageKey(pageKey) {
    var paths = Object.keys(MEDICARE_PAGE_REGISTRY);
    for (var i = 0; i < paths.length; i += 1) {
      var registered = MEDICARE_PAGE_REGISTRY[paths[i]];
      if (registered.page_key === pageKey) return registered;
    }
    return null;
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

  function medicareSourceContext(search) {
    var qs = new URLSearchParams(String(search || ''));
    if (String(qs.get('intent') || '').toLowerCase() !== 'medicare') return null;
    var pageKey = String(qs.get('source_page_key') || '');
    var ctaKey = String(qs.get('source_cta_key') || '');
    var registered = registryForPageKey(pageKey);
    if (!registered || !hasOwn(registered.cta_keys, ctaKey)) return null;
    return {
      schema_version: MEDICARE_ATTRIBUTION_SCHEMA_VERSION,
      source_page_key: registered.page_key,
      source_page_role: registered.page_role,
      source_cta_key: ctaKey,
      content_cluster: MEDICARE_CONTENT_CLUSTER,
      intent: 'medicare'
    };
  }

  function makeMeasurementEventId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return 'lhi_measurement_' + window.crypto.randomUUID();
      }
    } catch (e) {}
    return 'lhi_measurement_' + Date.now() + '_' + Math.random().toString(36).slice(2, 12);
  }

  function ctaKeyForLink(link, context) {
    if (!link || !context) return null;
    var registered = registryForPageKey(context.page_key);
    if (!registered) return null;
    var url = safeLinkUrl(link);
    if (!url || url.origin !== window.location.origin) return null;
    var targetPath = normalizePath(url.pathname);
    var explicit = String(link.getAttribute('data-medicare-cta') || '');
    if (explicit) {
      if (!hasOwn(registered.cta_keys, explicit)) return null;
      if (targetPath === '/get-help/' || targetPath === '/best-medicare-broker-lakeland-fl/' || targetPath === '/medicare-broker-lakeland-fl/') {
        return explicit;
      }
      return null;
    }
    if (targetPath !== '/get-help/') return null;
    if (link.closest && link.closest('.cta-group')) return 'header_talk_to_david';
    if (link.closest && link.closest('.dropdown-menu')) return 'menu_get_help';
    if (link.closest && link.closest('footer')) return 'footer_start_plan_review';
    return null;
  }

  function safeLinkUrl(link) {
    if (!link || !link.getAttribute) return null;
    try {
      return new URL(link.getAttribute('href') || '', window.location.href);
    } catch (e) {
      return null;
    }
  }

  function storePendingMedicareSource(context, ctaKey) {
    try {
      sessionStorage.setItem('lhi_medicare_source', JSON.stringify({
        source_page_key: context.page_key,
        source_page_role: context.page_role,
        source_cta_key: ctaKey,
        content_cluster: MEDICARE_CONTENT_CLUSTER,
        target_path: '/get-help/',
        recorded_at: Date.now()
      }));
    } catch (e) {}
  }

  function prepareMedicareGetHelpLink(link, context, ctaKey) {
    var url = safeLinkUrl(link);
    if (!url || url.origin !== window.location.origin || normalizePath(url.pathname) !== '/get-help/') return url;
    url.searchParams.set('intent', 'medicare');
    url.searchParams.set('source_page_key', context.page_key);
    url.searchParams.set('source_cta_key', ctaKey);
    var current = new URLSearchParams(window.location.search || '');
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (key) {
      var approved = key === 'utm_term'
        ? approvedCampaignTerm(current.get(key))
        : approvedCampaignValue(current.get(key));
      if (approved) url.searchParams.set(key, approved);
    });
    link.setAttribute('href', url.pathname + '?' + url.searchParams.toString());
    storePendingMedicareSource(context, ctaKey);
    return url;
  }

  function emitMedicareEvent(eventName, params) {
    var payload = Object.assign({ event_id: makeMeasurementEventId() }, params || {});
    pushDataLayerEvent(eventName, payload);
    var ga4Name = eventName === 'MedicareContentView' ? 'medicare_content_view' : 'medicare_cta_click';
    try { window.gtag('event', ga4Name, Object.assign({ transport_type: 'beacon' }, payload)); } catch (e) {}
  }

  function handleMedicarePointer(event, shouldTrack) {
    var context = medicarePageContext(window.location.pathname);
    if (!context || !event.target || !event.target.closest) return;
    var link = event.target.closest('a');
    if (!link) return;
    var ctaKey = ctaKeyForLink(link, context);
    if (!ctaKey) return;
    prepareMedicareGetHelpLink(link, context, ctaKey);
    if (!shouldTrack) return;
    emitMedicareEvent('MedicareCtaClick', Object.assign({}, context, { cta_key: ctaKey }));
  }

  function loadFunnelBus() {
    if (funnelRequested || window.LHI) return;
    funnelRequested = true;
    var funnel = document.createElement('script');
    funnel.async = true;
    funnel.src = '/js/funnel.js?v=20260820-google-ads-attribution';
    document.head.appendChild(funnel);
  }

  window.LHIMedicareAttribution = {
    pageContext: medicarePageContext,
    sourceContext: medicareSourceContext,
    approvedCampaignValue: approvedCampaignValue,
    approvedCampaignTerm: approvedCampaignTerm
  };

  var initialMedicareContext = medicarePageContext(window.location.pathname);
  if (initialMedicareContext) {
    emitMedicareEvent('MedicareContentView', initialMedicareContext);
  }

  /* Target pages and their intake need the first-party event bus immediately
     so a fast first CTA/form interaction cannot outrun attribution wiring.
     All other pages keep the existing deferred loading behavior. */
  var initialPath = normalizePath(window.location.pathname);
  if (initialMedicareContext || initialPath === '/' || initialPath === '/get-help/' || initialPath.indexOf('/lp/') === 0) {
    loadFunnelBus();
  }

  function approvedFormattedForwardingNumber(value) {
    var text = String(value || '').trim().replace(/\s+/g, ' ');
    if (!text || text.length > 32 || !/^[+()\d .-]+$/.test(text)) return null;
    var digits = text.replace(/\D/g, '');
    return /^\d{10}$/.test(digits) || /^1\d{10}$/.test(digits) ? text : null;
  }

  function approvedMobileForwardingNumber(value) {
    var compact = String(value || '').trim().replace(/[\s().-]/g, '');
    if (/^\+1\d{10}$/.test(compact)) return compact;
    if (/^1\d{10}$/.test(compact)) return '+' + compact;
    if (/^\d{10}$/.test(compact)) return '+1' + compact;
    return null;
  }

  function escapedPattern(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function businessPhonePattern() {
    return /(?:\+?1[\s.-]*)?\(?863\)?[\s.-]*640[\s.-]*3102/g;
  }

  function replacePhoneTextNodes(root, formattedNumber, previousNumber) {
    var pattern = previousNumber
      ? new RegExp(escapedPattern(previousNumber), 'g')
      : businessPhonePattern();
    var replaced = false;

    function visit(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        var current = String(node.nodeValue || '');
        var next = current.replace(pattern, formattedNumber);
        if (next !== current) {
          node.nodeValue = next;
          replaced = true;
        }
        return;
      }
      var children = node.childNodes || [];
      for (var i = 0; i < children.length; i += 1) visit(children[i]);
    }

    visit(root);
    return replaced;
  }

  function updateWebsiteCallLink(link, formattedNumber, mobileNumber) {
    if (!link || typeof link.setAttribute !== 'function') return false;

    if (!hasOwn(link, '__lhiPhoneAnalyticsLabel')) {
      link.__lhiPhoneAnalyticsLabel = link.getAttribute('data-analytics-label') ||
        link.getAttribute('aria-label') ||
        String(link.textContent || '').trim() ||
        'phone_link';
    }
    if (!hasOwn(link, '__lhiOriginalPhoneAriaLabel')) {
      link.__lhiOriginalPhoneAriaLabel = link.getAttribute('aria-label') || '';
    }

    if (link.__lhiForwardingFormattedNumber === formattedNumber &&
        link.getAttribute('href') === 'tel:' + mobileNumber) {
      return false;
    }

    var previousNumber = String(link.__lhiForwardingFormattedNumber || '');
    var replaced = replacePhoneTextNodes(link, formattedNumber, previousNumber);
    if (!replaced && document.createElement && typeof link.appendChild === 'function') {
      var suffix = link.querySelector && link.querySelector('[data-lhi-forwarding-number]');
      if (!suffix) {
        suffix = document.createElement('span');
        suffix.setAttribute('data-lhi-forwarding-number', '');
        suffix.className = 'lhi-forwarding-number';
        link.appendChild(suffix);
      }
      var visibleText = String(link.textContent || '').trim();
      suffix.textContent = (!visibleText || /[:\u2013\u2014-]\s*$/.test(visibleText) ? '' : ': ') + formattedNumber;
    }

    var originalAriaLabel = String(link.__lhiOriginalPhoneAriaLabel || '');
    if (originalAriaLabel) {
      var updatedAriaLabel = originalAriaLabel.replace(businessPhonePattern(), formattedNumber);
      if (updatedAriaLabel === originalAriaLabel) updatedAriaLabel += ', ' + formattedNumber;
      link.setAttribute('aria-label', updatedAriaLabel);
    }

    link.setAttribute('data-lhi-business-phone', BUSINESS_PHONE_E164);
    link.setAttribute('href', 'tel:' + mobileNumber);
    link.__lhiForwardingFormattedNumber = formattedNumber;
    return true;
  }

  function applyGoogleForwardingNumber(formattedNumber, mobileNumber) {
    var approvedFormatted = approvedFormattedForwardingNumber(formattedNumber);
    var approvedMobile = approvedMobileForwardingNumber(mobileNumber);
    if (!approvedFormatted || !approvedMobile || !document.querySelectorAll) return 0;

    cachedGoogleForwardingNumber = {
      formatted: approvedFormatted,
      mobile: approvedMobile
    };

    var updated = 0;
    document.querySelectorAll(websiteCallLinkSelector()).forEach(function (link) {
      if (updateWebsiteCallLink(link, approvedFormatted, approvedMobile)) updated += 1;
    });
    return updated;
  }

  function websiteCallLinkSelector() {
    return 'a[href="' + BUSINESS_PHONE_HREF + '"], a[data-lhi-business-phone="' + BUSINESS_PHONE_E164 + '"]';
  }

  function ensureGoogleTagScript(destinationId) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    if (googleTagScriptRequested) return false;

    googleTagScriptRequested = true;
    var googleTag = document.createElement('script');
    googleTag.async = true;
    googleTag.src = 'https://www.googletagmanager.com/gtag/js?id=' + destinationId;
    document.head.appendChild(googleTag);
    window.gtag('js', new Date());
    return true;
  }

  function initializeWebsiteCallTracking(matchingLinks) {
    if (websiteCallTrackingInitialized || !IS_PROD) return;
    if (!matchingLinks || !matchingLinks.length) return;
    websiteCallTrackingInitialized = true;

    /* Begin forwarding-number retrieval as soon as analytics.js evaluates so
       the first tel: interaction does not wait for window.load or deferred
       GTM/GA4 initialization. This is the only eagerly loaded Google tag. */
    ensureGoogleTagScript('AW-300112445');
    window.gtag('config', 'AW-300112445', { send_page_view: false });
    window.gtag('config', 'AW-300112445/MVhNCILUi-IaEL20jY8B', {
      phone_conversion_number: '(863) 640-3102',
      phone_conversion_callback: applyGoogleForwardingNumber
    });
  }

  function refreshWebsiteCallTracking() {
    if (!IS_PROD || !document.querySelectorAll) return false;
    var matchingLinks = document.querySelectorAll(websiteCallLinkSelector());
    if (!matchingLinks.length) return false;

    initializeWebsiteCallTracking(matchingLinks);
    if (cachedGoogleForwardingNumber) {
      applyGoogleForwardingNumber(
        cachedGoogleForwardingNumber.formatted,
        cachedGoogleForwardingNumber.mobile
      );
    }
    return true;
  }

  if (window.__LHI_TEST === true) {
    window.LHIWebsiteCallTracking = {
      applyGoogleForwardingNumber: applyGoogleForwardingNumber,
      approvedFormattedForwardingNumber: approvedFormattedForwardingNumber,
      approvedMobileForwardingNumber: approvedMobileForwardingNumber
    };
  }

  /* Preserve the eager path for static phone links. A zero-delay retry after
     DOMContentLoaded runs after every listener in that dispatch, including the
     shared template listener that inserts the canonical header/footer links. */
  refreshWebsiteCallTracking();
  if (IS_PROD && document.readyState !== 'complete' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(refreshWebsiteCallTracking, 0);
    }, { once: true });
  }

  function trackPhoneClick(label, legacyName) {
    var params = {
      event_category: 'engagement',
      event_label: label || 'phone_link',
      transport_type: 'beacon'
    };
    var now = Date.now();

    if (now - lastPhoneCanonicalAt > 500) {
      pushDataLayerEvent('PhoneCallClick', params);
      pushDataLayerEvent('phone_call_click', params);
      lastPhoneCanonicalAt = now;
    }

    if (legacyName) {
      pushDataLayerEvent(legacyName, params);
    }
  }

  window.lhiTrackPhoneClick = trackPhoneClick;
  window.trackPhoneCall = window.trackPhoneCall || function (label) {
    trackPhoneClick(label || 'click_to_call_button', 'phone_call');
  };

  document.addEventListener('click', function (event) {
    handleMedicarePointer(event, true);
    var link = event.target && event.target.closest ? event.target.closest('a[href^="tel:"]') : null;
    if (!link) return;
    var label = link.__lhiPhoneAnalyticsLabel ||
      link.getAttribute('data-analytics-label') ||
      link.getAttribute('aria-label') ||
      (link.textContent || '').trim() ||
      'phone_link';
    trackPhoneClick(label);
  }, { capture: true });

  document.addEventListener('pointerdown', function (event) {
    handleMedicarePointer(event, false);
  }, { capture: true });

  function init(){
    if(loaded)return;loaded=true;

    loadFunnelBus();

    if (!IS_PROD) {
      /* Skip Google tags entirely on non-prod hosts. The first-party funnel
         bus remains locally testable. */
      return;
    }

    /* Google Tag Manager */
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});
    var g=document.createElement('script');
    g.async=true;
    g.src='https://www.googletagmanager.com/gtm.js?id=GTM-W6MZ7XT6';
    document.head.appendChild(g);
    /* No-phone pages request gtag.js here; website-call pages reuse the eager
       AW request. In both paths the shared loader restores the queue first. */
    ensureGoogleTagScript('G-W45RMKHXV0');
    window.gtag('config', 'G-W45RMKHXV0', {
      send_page_view: false,
      debug_mode: IS_ANALYTICS_DEBUG
    });
  }
  /* Defer general GTM/GA4 initialization until after LCP/FCP so it does not
     fight with the hero render. Website-call replacement already started.
     General analytics initializes on:
       - first user interaction (click / scroll / keydown / touchstart)
       - OR requestIdleCallback (browser idle, typically <1s after LCP)
       - OR a 2.5s hard timeout fallback for non-interactive bounces
     Whichever comes first. Once init() runs it short-circuits via `loaded`. */
  function scheduleInit() {
    var fired = false;
    function fire(){ if(fired) return; fired = true; init(); cleanup(); }

    var events = ['pointerdown','keydown','touchstart','scroll'];
    function cleanup(){
      events.forEach(function(ev){
        window.removeEventListener(ev, fire, { passive: true, capture: true });
      });
    }
    events.forEach(function(ev){
      window.addEventListener(ev, fire, { passive: true, capture: true, once: true });
    });

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(fire, { timeout: 2500 });
    } else {
      setTimeout(fire, 2500);
    }
  }

  if (document.readyState === 'complete') {
    scheduleInit();
  } else {
    window.addEventListener('load', scheduleInit, { once: true });
  }

  /* Google Ads "Insurance reality check" conversion wrapper. Defined globally
     so any reality-check CTA can use onclick="gtag_report_conversion(this.href)"
     for tel: / external links, or gtag_report_conversion() (no arg) inside JS
     event handlers. No-ops gracefully on non-prod (gtag is undefined there). */
  window.gtag_report_conversion = function (url) {
    var callback = function () {
      if (typeof url !== 'undefined') {
        window.location = url;
      }
    };
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        'send_to': 'AW-300112445/a0DbCJLr--EaEL20jY8B',
        'event_callback': callback
      });
    } else if (typeof url !== 'undefined') {
      window.location = url;
    }
    return false;
  };
})();
