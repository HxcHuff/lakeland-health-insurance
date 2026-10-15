(function (w, d) {
  'use strict';

  if (w.__LHI_LEAD_HERO_LOADED__) return;
  w.__LHI_LEAD_HERO_LOADED__ = true;

  var STICKY_CLASS = 'lhi-lead-sticky';
  var BODY_ACTIVE = 'lhi-lead-sticky-active';
  var PHONE_DISPLAY = '(863) 640-3102';
  var PHONE_HREF = 'tel:+18636403102';
  var LICENSED_MEDICARE_STATES = {
    AL: true,
    AZ: true,
    FL: true,
    GA: true,
    KS: true,
    NC: true,
    SC: true,
    TN: true,
    TX: true
  };

  function medicareCoverageStateFromQuery() {
    try {
      var code = String(new URLSearchParams(w.location.search || '').get('state') || '').trim().toUpperCase();
      return code.length === 2 ? code : '';
    } catch (e) {
      return '';
    }
  }

  function isOutOfStateMedicareCoverageState(code) {
    if (!code) return false;
    return !Object.prototype.hasOwnProperty.call(LICENSED_MEDICARE_STATES, code);
  }

  function syncMedicareScopeNotes() {
    var state = medicareCoverageStateFromQuery();
    var show = isOutOfStateMedicareCoverageState(state);
    d.querySelectorAll('#outOfStateMedicareNote').forEach(function (note) {
      note.hidden = !show;
    });
  }

  function showLeadStatus(form, message) {
    var status = form.querySelector('[data-lhi-lead-status]');
    if (status) status.textContent = message || '';
  }

  function wireSiteLeadForms() {
    d.querySelectorAll('form[data-lhi-site-lead-form]').forEach(function (form) {
      if (form.__lhiSiteLeadWired) return;
      form.__lhiSiteLeadWired = true;
      form.addEventListener('submit', function () {
        showLeadStatus(form, 'Sending your request…');
        w.setTimeout(function () {
          if (d.contains(form)) {
            showLeadStatus(form, 'If the page does not continue, review the form and try again.');
          }
        }, 12000);
      }, { capture: true });
    });
  }

  function leadSubmitted() {
    try {
      return Boolean(w.sessionStorage.getItem('lhi_lead_submitted') || w.sessionStorage.getItem('lhi_submission_completed'));
    } catch (e) {
      return false;
    }
  }

  function ensureStickyBar() {
    if (!d.querySelector('.lhi-lead-hero') || d.getElementById('lhi-lead-sticky-bar')) return null;
    var bar = d.createElement('div');
    bar.id = 'lhi-lead-sticky-bar';
    bar.className = STICKY_CLASS;
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Quick contact');
    bar.innerHTML =
      '<a class="lhi-lead-sticky__call" href="' + PHONE_HREF + '" data-lhi-sticky-call>Call ' + PHONE_DISPLAY + '</a>' +
      '<a class="lhi-lead-sticky__quote" href="#lhi-site-lead-form" data-lhi-sticky-quote>Get a quote</a>';
    d.body.appendChild(bar);

    var call = bar.querySelector('[data-lhi-sticky-call]');
    if (call) {
      call.addEventListener('click', function () {
        if (typeof w.lhiTrackPhoneClick === 'function') {
          try { w.lhiTrackPhoneClick('lead_sticky_call', 'phone_call'); } catch (e) {}
        }
      });
    }
    var quote = bar.querySelector('[data-lhi-sticky-quote]');
    if (quote) {
      quote.addEventListener('click', function (event) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        var target = d.getElementById('lhi-site-lead-form') || d.getElementById('lhi-lead-hero');
        if (target && typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
    return bar;
  }

  function syncStickyVisibility(bar) {
    if (!bar || leadSubmitted()) {
      if (bar) bar.classList.remove('is-visible');
      d.body.classList.remove(BODY_ACTIVE);
      return;
    }
    if (w.matchMedia('(min-width: 901px)').matches) {
      bar.classList.remove('is-visible');
      d.body.classList.remove(BODY_ACTIVE);
      return;
    }
    bar.classList.add('is-visible');
    d.body.classList.add(BODY_ACTIVE);
  }

  function wireStickyObserver(bar) {
    if (!bar || !('IntersectionObserver' in w)) return;
    var heroForm = d.getElementById('lhi-site-lead-form') || d.querySelector('.lhi-lead-hero__card');
    if (!heroForm) return;
    var observer = new w.IntersectionObserver(function (entries) {
      var visible = entries.some(function (entry) { return entry.isIntersecting && entry.intersectionRatio > 0.2; });
      if (visible || leadSubmitted()) {
        bar.classList.remove('is-visible');
        d.body.classList.remove(BODY_ACTIVE);
      } else {
        syncStickyVisibility(bar);
      }
    }, { threshold: [0, 0.2, 0.5] });
    observer.observe(heroForm);
  }

  function suppressBlogFloatingCall() {
    var floating = d.querySelector('.lhi-floating-call[data-floating-call]');
    if (floating && d.querySelector('.lhi-lead-hero')) floating.remove();
  }

  function init() {
    wireSiteLeadForms();
    syncMedicareScopeNotes();
    var bar = ensureStickyBar();
    syncStickyVisibility(bar);
    wireStickyObserver(bar);
    suppressBlogFloatingCall();
    w.addEventListener('resize', function () { syncStickyVisibility(bar); });
    w.addEventListener('storage', function () { syncStickyVisibility(bar); });
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
