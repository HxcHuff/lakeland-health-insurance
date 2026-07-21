/* Deferred analytics: GTM + Google Ads loaded after page interactive */
/* Google tags only fire on production host. Netlify deploy previews, branch
   deploys, and localhost are explicitly excluded to keep reporting clean. */
(function(){
  var loaded=false;

  /* ---- Production-host gate -------------------------------------------- */
  var host = (typeof location !== 'undefined' && location.hostname || '').toLowerCase();
  var PROD_HOSTS = ['lakelandhealthinsurance.com', 'www.lakelandhealthinsurance.com'];
  var IS_PROD = PROD_HOSTS.indexOf(host) !== -1;

  /* QA override: ?analytics_test=1 on URL, or localStorage.lhi_analytics_test=1
     once set, forces Google tags to fire on previews/localhost for validation. */
  try {
    var qsForce = /[?&]analytics_test=1\b/.test(location.search);
    if (qsForce) localStorage.setItem('lhi_analytics_test', '1');
    if (qsForce || localStorage.getItem('lhi_analytics_test') === '1') IS_PROD = true;
  } catch (e) {}

  if (window.console && console.info) {
    console.info('[LHI analytics] Google analytics gate:', IS_PROD ? 'ENABLED' : 'SKIPPED (non-prod host)');
  }

  /* Expose for other scripts (funnel.js) */
  window.__LHI_IS_PROD = IS_PROD;

  function init(){
    if(loaded)return;loaded=true;

    if (!IS_PROD) {
      /* Skip Google tags entirely on non-prod hosts. Still load funnel.js
         so internal event bus / Supabase logging can continue for QA. */
      var fqa=document.createElement('script');
      fqa.async=true;
      fqa.src='/js/funnel.js?v=20260721-meta-removal';
      document.head.appendChild(fqa);
      return;
    }

    /* Google Tag Manager */
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});
    var g=document.createElement('script');
    g.async=true;
    g.src='https://www.googletagmanager.com/gtm.js?id=GTM-W6MZ7XT6';
    document.head.appendChild(g);
    /* Google Ads (gtag.js) — needed for AW-300112445 conversion events
       (e.g. "Insurance reality check" click conversion fired from
       calendly.event_scheduled). Coexists with GTM via shared dataLayer. */
    var ga=document.createElement('script');
    ga.async=true;
    ga.src='https://www.googletagmanager.com/gtag/js?id=AW-300112445';
    document.head.appendChild(ga);
    window.gtag=window.gtag||function(){dataLayer.push(arguments);};
    gtag('js', new Date());
    /* allow_enhanced_conversions=true permits gtag to read user_data set via
       gtag('set','user_data',{...}) and pass hashed PII alongside conversion
       events (Enhanced Conversions for Leads). Lifts Smart Bidding match
       rate. Must also be turned on per-conversion-action in Google Ads UI. */
    gtag('config', 'AW-300112445', { allow_enhanced_conversions: true });
    /* Funnel event bus — unifies GA + Supabase */
    var f=document.createElement('script');
    f.async=true;
    f.src='/js/funnel.js?v=20260721-meta-removal';
    document.head.appendChild(f);
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
