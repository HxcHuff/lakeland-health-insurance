/* Deferred analytics: GTM + Google Ads loaded after page interactive */
/* Google tags only fire on production host. Netlify deploy previews, branch
   deploys, and localhost are explicitly excluded to keep reporting clean. */
(function(){
  var loaded=false;
  var funnelRequested=false;
  var lastPhoneCanonicalAt = 0;
  var MEDICARE_ATTRIBUTION_SCHEMA_VERSION = 'medicare-attribution.v1';
  var MEDICARE_CONTENT_CLUSTER = 'lakeland_medicare_broker';
  var MEDICARE_PAGE_REGISTRY = {
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

  function medicarePageContext(pathname) {
    var registered = MEDICARE_PAGE_REGISTRY[normalizePath(pathname)];
    if (!registered) return null;
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
    if (/@|(?:\d[\s().-]*){7,}/.test(text)) return null;
    return /^[a-z0-9][a-z0-9._~-]*$/.test(text) ? text : null;
  }

  function medicareSourceContext(search) {
    var qs = new URLSearchParams(String(search || ''));
    if (String(qs.get('intent') || '').toLowerCase() !== 'medicare') return null;
    var pageKey = String(qs.get('source_page_key') || '');
    var ctaKey = String(qs.get('source_cta_key') || '');
    var registered = registryForPageKey(pageKey);
    if (!registered || !registered.cta_keys[ctaKey]) return null;
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
      if (!registered.cta_keys[explicit]) return null;
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
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (key) {
      var approved = approvedCampaignValue(current.get(key));
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
    funnel.src = '/js/funnel.js?v=20260814-medicare-attribution';
    document.head.appendChild(funnel);
  }

  window.LHIMedicareAttribution = {
    pageContext: medicarePageContext,
    sourceContext: medicareSourceContext,
    approvedCampaignValue: approvedCampaignValue
  };

  var initialMedicareContext = medicarePageContext(window.location.pathname);
  if (initialMedicareContext) {
    emitMedicareEvent('MedicareContentView', initialMedicareContext);
  }

  /* Target pages and their intake need the first-party event bus immediately
     so a fast first CTA/form interaction cannot outrun attribution wiring.
     All other pages keep the existing deferred loading behavior. */
  if (initialMedicareContext || normalizePath(window.location.pathname) === '/get-help/') {
    loadFunnelBus();
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
    var label = link.getAttribute('data-analytics-label') ||
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
    /* Google Ads / GA4 (gtag.js) — needed for AW-300112445 conversion events
       (e.g. "Insurance reality check" click conversion fired from
       calendly.event_scheduled) and direct secondary funnel events. Coexists
       with GTM via shared dataLayer. */
    var ga=document.createElement('script');
    ga.async=true;
    ga.src='https://www.googletagmanager.com/gtag/js?id=G-W45RMKHXV0';
    document.head.appendChild(ga);
    window.gtag=window.gtag||function(){dataLayer.push(arguments);};
    gtag('js', new Date());
    gtag('config', 'G-W45RMKHXV0', {
      send_page_view: false,
      debug_mode: IS_ANALYTICS_DEBUG
    });
    /* Configure Google Ads without enhanced-conversion user data. The site
       emits only a conversion ID, value, and currency after first-party
       delivery; names, contact details, ZIPs, and form answers stay out. */
    gtag('config', 'AW-300112445', { send_page_view: false });
  }
  /* Defer Google tags until after LCP/FCP so third-party JS isn't
     fighting with the hero render. We still fire fast enough to capture bounce
     traffic from paid ads:
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
