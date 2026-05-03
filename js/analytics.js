/* Deferred analytics: GTM + Facebook Pixel loaded after page interactive */
/* Pixel + GTM only fire on production host. Netlify deploy previews, branch
   deploys, and localhost are explicitly excluded to keep Events Manager clean. */
(function(){
  var loaded=false;

  /* ---- Production-host gate -------------------------------------------- */
  var host = (typeof location !== 'undefined' && location.hostname || '').toLowerCase();
  var PROD_HOSTS = ['lakelandhealthinsurance.com', 'www.lakelandhealthinsurance.com'];
  var IS_PROD = PROD_HOSTS.indexOf(host) !== -1;

  /* QA override: ?fbq_test=1 on URL, or localStorage.lhi_fbq_test=1 once set,
     forces pixel + GTM to fire on previews/localhost. Lets us validate Test
     Events without polluting Events Manager from real-user prod traffic. */
  try {
    var qsForce = /[?&]fbq_test=1\b/.test(location.search);
    if (qsForce) localStorage.setItem('lhi_fbq_test', '1');
    if (qsForce || localStorage.getItem('lhi_fbq_test') === '1') IS_PROD = true;
  } catch (e) {}

  if (window.console && console.info) {
    console.info('[LHI analytics] pixel/GTM gate:', IS_PROD ? 'ENABLED' : 'SKIPPED (non-prod host)');
  }

  /* Expose for other scripts (funnel.js, page-level fbq calls) */
  window.__LHI_IS_PROD = IS_PROD;

  /* Stub fbq as a no-op on non-prod hosts so any inline fbq('track', ...)
     calls on page do not throw and do not fire. This also short-circuits the
     real pixel snippet if it ever loads (guarded by `if(f.fbq)return;`). */
  if (!IS_PROD && typeof window.fbq !== 'function') {
    var stub = function(){};
    stub.version = '2.0';
    stub.queue = [];
    stub.loaded = true;
    stub.disableAutoConfig = true;
    window.fbq = stub;
    window._fbq = stub;
  }

  function init(){
    if(loaded)return;loaded=true;

    if (!IS_PROD) {
      /* Skip GTM + FB Pixel entirely on non-prod hosts. Still load funnel.js
         so internal event bus / Supabase logging can continue for QA. */
      var fqa=document.createElement('script');
      fqa.async=true;
      fqa.src='/js/funnel.js';
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
    /* Facebook Pixel */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init','1480756087079484');
    /* Funnel event bus — unifies pixel + GA + Supabase */
    var f=document.createElement('script');
    f.async=true;
    f.src='/js/funnel.js';
    document.head.appendChild(f);
  }
  /* Defer pixel/GTM until after LCP/FCP so 376 KiB of third-party JS isn't
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
