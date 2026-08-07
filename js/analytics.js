/* Deferred analytics: GTM + Google Ads loaded after page interactive */
/* Google tags only fire on production host. Netlify deploy previews, branch
   deploys, and localhost are explicitly excluded to keep reporting clean. */
(function(){
  var loaded=false;
  var lastPhoneCanonicalAt = 0;

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

  /* Load the first-party event bus immediately. It safely queues events in
     dataLayer before third-party Google libraries arrive, so a fast first
     click is still measured without making GTM compete with page rendering. */
  function loadFunnelBus() {
    if (window.__LHI_FUNNEL_LOADING || window.LHI) return;
    window.__LHI_FUNNEL_LOADING = true;
    var funnelScript = document.createElement('script');
    funnelScript.async = true;
    funnelScript.src = '/js/funnel.js?v=20260807-first-party-v2';
    document.head.appendChild(funnelScript);
  }

  loadFunnelBus();

  function pushDataLayerEvent(name, params) {
    window.dataLayer.push(Object.assign({ event: name }, params || {}));
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
    var link = event.target && event.target.closest ? event.target.closest('a[href^="tel:"]') : null;
    if (!link) return;
    var label = link.getAttribute('data-analytics-label') ||
      link.getAttribute('aria-label') ||
      (link.textContent || '').trim() ||
      'phone_link';
    trackPhoneClick(label);
  }, { capture: true });

  function init(){
    if(loaded)return;loaded=true;

    if (!IS_PROD) {
      /* Skip Google tags entirely on non-prod hosts. The first-party event bus
         is already available for preview QA without contaminating reporting. */
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
  /* Defer third-party Google tags until after LCP/FCP so external JS isn't
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
