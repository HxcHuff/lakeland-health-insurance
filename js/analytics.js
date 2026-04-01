/* Deferred analytics: GTM + Facebook Pixel loaded after page interactive */
(function(){
  var loaded=false;
  function init(){
    if(loaded)return;loaded=true;
    /* GTM / GA4 */
    var g=document.createElement('script');
    g.src='https://www.googletagmanager.com/gtag/js?id=G-W45RMKHXV0';
    g.async=true;
    document.head.appendChild(g);
    window.dataLayer=window.dataLayer||[];
    function gtag(){dataLayer.push(arguments)}
    window.gtag=gtag;
    gtag('js',new Date());
    gtag('config','G-W45RMKHXV0');
    /* Facebook Pixel */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init','1822900971216472');
    fbq('track','PageView');
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
