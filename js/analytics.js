/* Deferred analytics: GTM + Facebook Pixel loaded after page interactive */
/* Pixel + GTM only fire on production host. Netlify deploy previews, branch
   deploys, and localhost are explicitly excluded to keep Events Manager clean. */
(function(){
  var loaded=false;

  /* ---- Production-host gate -------------------------------------------- */
  var host = (typeof location !== 'undefined' && location.hostname || '').toLowerCase();
  var PROD_HOSTS = ['lakelandhealthinsurance.com', 'www.lakelandhealthinsurance.com'];
  var IS_PROD = PROD_HOSTS.indexOf(host) !== -1;

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
    /* Facebook Pixel */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init','1822900971216472');
    fbq('track','PageView');
    /* Funnel event bus — unifies pixel + GA + Supabase */
    var f=document.createElement('script');
    f.async=true;
    f.src='/js/funnel.js';
    document.head.appendChild(f);
  }
  /* Load on first user interaction or after 3.5s, whichever comes first */
  var events=['mouseover','touchstart','scroll','keydown'];
  function onInteract(){
    events.forEach(function(e){document.removeEventListener(e,onInteract,{passive:true})});
    init();
  }
  events.forEach(function(e){document.addEventListener(e,onInteract,{passive:true})});
  setTimeout(init,3500);
})();
