/*
 * Lakeland Health Insurance — Funnel Event Bus
 * Single source of truth for pixel + GA4 + Supabase event tracking.
 *
 * Fires simultaneously to:
 *   - Meta Pixel (1822900971216472)
 *   - Google Tag Manager (GTM-W6MZ7XT6)
 *   - Supabase funnel_events table (via publishable key)
 *
 * Usage:
 *   window.LHI.track('Lead', { content_name: 'lp_aca_lead_form' });
 *   window.LHI.identify({ zip: '33801', line: 'ACA' });
 *
 * Page-type inference (for GA4 / Supabase segmentation):
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

  var SUPABASE_URL = 'https://cdlrpthlmvyksfljlfik.supabase.co';
  var SUPABASE_ANON = 'sb_publishable_4iawXiwpNvk04SziN4Bs5w_ECZ7qRPl';
  var TABLE = 'funnel_events';

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
    if (p.indexOf('/dudes-corner') === 0) return 'dudes_corner';
    if (p.indexOf('/aca-health-insurance-lakeland') === 0) return 'local_seo_aca';
    if (p.indexOf('/medicare-broker-lakeland') === 0) return 'local_seo_medicare';
    if (p.indexOf('/life-insurance-dime') === 0) return 'dime_method';
    if (p.indexOf('/lost-job-health-insurance') === 0) return 'lp_job_loss';
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
      if (days) {
        var dt = new Date();
        dt.setTime(dt.getTime() + days * 86400000);
        exp = '; expires=' + dt.toUTCString();
      }
      d.cookie = name + '=' + encodeURIComponent(val) + exp + '; path=/; SameSite=Lax';
      return val;
    }
    var match = d.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function getSession() {
    return cookie('lhi_sid') || cookie('lhi_sid', uuid(), 365);
  }

  function getAttribution() {
    var qs = new URLSearchParams(w.location.search);
    var stored = {};
    try { stored = JSON.parse(cookie('lhi_attr') || '{}'); } catch (e) {}
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
    var fresh = {};
    keys.forEach(function (k) { if (qs.get(k)) fresh[k] = qs.get(k); });
    if (Object.keys(fresh).length) {
      stored = Object.assign({}, stored, fresh, { first_seen: stored.first_seen || new Date().toISOString() });
      cookie('lhi_attr', JSON.stringify(stored), 90);
    }
    return stored;
  }

  // Transport -------------------------------------------------------------
  function sendSupabase(payload) {
    try {
      var url = SUPABASE_URL + '/rest/v1/' + TABLE;
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        // sendBeacon cannot set headers — fall back to fetch keepalive
      }
      fetch(url, {
        method: 'POST',
        mode: 'cors',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON,
          'Authorization': 'Bearer ' + SUPABASE_ANON,
          'Prefer': 'return=minimal'
        },
        body: body
      }).catch(function () { /* swallow */ });
    } catch (e) { /* swallow */ }
  }

  function fireMetaPixel(name, props) {
    if (typeof w.fbq !== 'function') return;
    /* Production-host gate — mirrors analytics.js. Prevents any pixel
       events on Netlify deploy previews, branch deploys, or localhost. */
    if (w.__LHI_IS_PROD === false) return;
    try { w.fbq('track', name, props || {}); } catch (e) {}
  }

  function fireGA(name, props) {
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push(Object.assign({ event: name }, props || {}));
  }

  // Public API ------------------------------------------------------------
  var identity = {};

  function identify(attrs) {
    identity = Object.assign({}, identity, attrs || {});
    try { cookie('lhi_id', JSON.stringify(identity), 365); } catch (e) {}
  }

  function track(name, props) {
    props = props || {};
    var pt = pageType();
    var payload = {
      event_name: name,
      page_type: pt,
      page_path: w.location.pathname,
      page_url: w.location.href,
      referrer: d.referrer || null,
      session_id: getSession(),
      attribution: getAttribution(),
      identity: identity,
      props: props,
      user_agent: navigator.userAgent,
      viewport_w: w.innerWidth,
      viewport_h: w.innerHeight,
      fired_at: new Date().toISOString()
    };

    // 1. Meta Pixel
    fireMetaPixel(name, Object.assign({ page_type: pt }, props));

    // 2. GTM / GA4 dataLayer
    fireGA(name, { page_type: pt, event_params: props });

    // 3. Supabase stream
    sendSupabase(payload);
  }

  function pageView() {
    // Wait for pixel to be ready — analytics.js already fires PageView automatically,
    // but we also want the enriched Supabase + page_type row.
    track('PageView', { page_type: pageType() });
  }

  // Auto-wire form submissions -------------------------------------------
  function wireForms() {
    d.querySelectorAll('form[data-funnel-track], form[data-funnel-step]').forEach(function (f) {
      if (f.__lhiWired) return;
      f.__lhiWired = true;
      f.addEventListener('submit', function () {
        var name = f.getAttribute('data-funnel-event') || 'Lead';
        var step = f.getAttribute('data-funnel-step') || 'submit';
        var content = f.getAttribute('data-funnel-name') || (pageType() + '_' + step);
        var fd = new FormData(f);
        var zip = fd.get('zip') || fd.get('ZIP') || null;
        var email = fd.get('email') || null;
        if (zip || email) identify({ zip: zip, email: email });
        track(name, { content_name: content, step: step });
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
  }

  // Boot ------------------------------------------------------------------
  w.LHI = { track: track, identify: identify, pageType: pageType, session: getSession };

  // Give pixel + GTM time to initialize (analytics.js loads on interaction/3.5s)
  function boot() {
    getAttribution(); // persist UTMs on first hit
    wireForms();
    // Fire enriched PageView once pixel exists, else after 4s
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (typeof w.fbq === 'function' || tries > 20) {
        clearInterval(t);
        pageView();
      }
    }, 300);
    // Observe DOM for late-rendered forms (React/etc.)
    if (w.MutationObserver) {
      new MutationObserver(wireForms).observe(d.body, { childList: true, subtree: true });
    }
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window, document);
