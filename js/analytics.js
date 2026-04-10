/* Deferred analytics: GTM + Facebook Pixel loaded after page interactive */
(function(){
  var loaded=false;
  function init(){
    if(loaded)return;loaded=true;
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

    /* ── Auto: ViewContent on blog posts ── */
    if(document.body && document.body.classList.contains('blog-post')){
      fbq('track','ViewContent',{content_name:document.title});
    }

    /* ── Auto: Contact on phone number clicks ── */
    document.querySelectorAll('a[href^="tel:"]').forEach(function(el){
      el.addEventListener('click',function(){
        fbq('track','Contact');
      });
    });
  }
  /* Load on first user interaction or after 3.5s, whichever comes first */
  var events=['mouseover','touchstart','scroll','keydown'];
  function onInteract(){
    events.forEach(function(e){document.removeEventListener(e,onInteract,{passive:true})});
    init();
  }
  events.forEach(function(e){document.addEventListener(e,onInteract,{passive:true})});
  setTimeout(init,3500);

  /* ── Named Event Helpers ──
     Callable before init — they eagerly initialize the pixel so nothing
     is silently dropped. Once the fbq stub exists it queues internally
     until fbevents.js finishes downloading. */
  function ensurePixel(){ if(!loaded) init(); }

  window.fbLead=function(label,extra){
    ensurePixel();
    if(extra) fbq('track','Lead',{content_name:label||'general'},extra);
    else fbq('track','Lead',{content_name:label||'general'});
  };
  window.fbContact=function(){
    ensurePixel();
    fbq('track','Contact');
  };
  window.fbViewContent=function(label){
    ensurePixel();
    fbq('track','ViewContent',{content_name:label||'page'});
  };
})();
