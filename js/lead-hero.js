(function (w, d) {
  'use strict';

  if (w.__LHI_LEAD_HERO_LOADED__) return;
  w.__LHI_LEAD_HERO_LOADED__ = true;

  var STICKY_CLASS = 'lhi-lead-sticky';
  var BODY_ACTIVE = 'lhi-lead-sticky-active';
  var BODY_FORM_IN_VIEW = 'lhi-lead-form-in-view';
  var SCROLL_EXTRA_DEFAULT = 32;
  var SCROLL_EXTRA_SEASONAL = 68;
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

  function leadScrollTarget() {
    return (
      d.querySelector('.lhi-lead-hero__intro .lhi-lead-hero__title') ||
      d.querySelector('.lhi-lead-hero__intro') ||
      d.getElementById('lhi-lead-hero') ||
      d.getElementById('lhi-site-lead-form')
    );
  }

  function leadScrollOffsetPx() {
    var headerHeight = parseFloat(w.getComputedStyle(d.documentElement).getPropertyValue('--lhi-site-header-height')) || 88;
    var extra = d.body.classList.contains('has-seasonal-banner') ? SCROLL_EXTRA_SEASONAL : SCROLL_EXTRA_DEFAULT;
    return headerHeight + extra;
  }

  function scrollToLeadTarget(target) {
    if (!target) return;
    var top = target.getBoundingClientRect().top + w.pageYOffset - leadScrollOffsetPx();
    w.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function setLeadFormInView(inView) {
    d.body.classList.toggle(BODY_FORM_IN_VIEW, Boolean(inView));
  }

  function usesShellSiblingLeadForm() {
    return Boolean(
      d.querySelector(
        '.lhi-hero-shell > .lhi-hero-grid-lead, .lhi-hero-shell .hero-grid > .lhi-hero-grid-lead, .lhi-hero-shell .answer-grid > .lhi-hero-grid-lead'
      )
    );
  }

  function ensureStickyBar() {
    if (usesShellSiblingLeadForm() && !d.body.classList.contains('home-page')) return null;
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
        scrollToLeadTarget(leadScrollTarget());
      });
    }
    return bar;
  }

  function syncStickyVisibility(bar) {
    if (!bar || leadSubmitted() || d.body.classList.contains(BODY_FORM_IN_VIEW)) {
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

  function applyLeadFormVisibility(bar, visible) {
    setLeadFormInView(visible);
    if (visible || leadSubmitted()) {
      if (bar) bar.classList.remove('is-visible');
      d.body.classList.remove(BODY_ACTIVE);
      return;
    }
    syncStickyVisibility(bar);
  }

  function wireStickyObserver(bar) {
    if (!bar || !('IntersectionObserver' in w)) return;
    var heroForm = d.getElementById('lhi-site-lead-form');
    if (!heroForm) heroForm = d.querySelector('.lhi-lead-hero__card');
    if (!heroForm) return;
    var observer = new w.IntersectionObserver(function (entries) {
      var visible = entries.some(function (entry) {
        return entry.isIntersecting && entry.intersectionRatio >= 0.08;
      });
      applyLeadFormVisibility(bar, visible);
    }, {
      root: null,
      rootMargin: '0px 0px -12% 0px',
      threshold: [0, 0.08, 0.2, 0.5]
    });
    observer.observe(heroForm);
  }

  function suppressBlogFloatingCall() {
    var floating = d.querySelector('.lhi-floating-call[data-floating-call]');
    if (floating && d.querySelector('.lhi-lead-hero')) floating.remove();
  }

  function normHeroText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function heroTextPrefix(value) {
    return normHeroText(value).toLowerCase().slice(0, 40);
  }

  function isMetaLike(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.matches('.meta, .blog-meta, .byline, .last-reviewed, p.last-reviewed')) return true;
    if (el.classList && (el.classList.contains('meta') || el.classList.contains('blog-meta'))) return true;
    return false;
  }

  function ledePrefixFromBlock(ledeBlock) {
    if (!ledeBlock) return '';
    var lede = ledeBlock.querySelector('.lhi-hero-lede, p.lhi-hero-lede');
    return lede ? heroTextPrefix(lede.textContent) : '';
  }

  function removeIfDuplicateOfLede(el, ledePrefix) {
    if (!ledePrefix || ledePrefix.length < 20) return false;
    if (!el || el.nodeType !== 1) return false;
    if (isMetaLike(el)) return false;
    var prefix = heroTextPrefix(el.textContent);
    if (!prefix || prefix.length < 20) return false;
    if (prefix === ledePrefix) {
      el.remove();
      return true;
    }
    return false;
  }

  function consolidateBlogHeroCopy() {
    if (!d.body.classList.contains('blog-post') && !d.body.classList.contains('blog-index-page')) return;
    d.querySelectorAll('.lhi-hero-shell').forEach(function (shell) {
      var ledeBlock = shell.querySelector('.lhi-hero-lede-block');
      if (!ledeBlock) return;
      var ledePrefix = ledePrefixFromBlock(ledeBlock);
      var deferredBlocks = shell.querySelectorAll('.lhi-hero-deferred-block');
      deferredBlocks.forEach(function (def) {
        var movable = Array.prototype.slice.call(def.children);
        movable.forEach(function (el) {
          if (removeIfDuplicateOfLede(el, ledePrefix)) return;
          if (el.nodeType === 1 && isMetaLike(el)) {
            ledeBlock.appendChild(el);
            return;
          }
          if (el.nodeType === 1 && el.classList && el.classList.contains('last-reviewed')) {
            ledeBlock.appendChild(el);
            return;
          }
          if (el.nodeType === 1 && el.tagName === 'DIV' && isMetaLike(el.firstElementChild)) {
            ledeBlock.appendChild(el);
            return;
          }
          if (el.nodeType === 1 && (el.tagName === 'P' || el.tagName === 'H2' || el.tagName === 'H3')) {
            el.remove();
            return;
          }
          if (el.nodeType === 1) {
            el.remove();
          }
        });
        if (!normHeroText(def.textContent) && !def.querySelector('*')) def.remove();
        else if (!normHeroText(def.textContent)) def.remove();
      });
    });
  }

  w.LHIConsolidateBlogHeroCopy = consolidateBlogHeroCopy;

  function init() {
    consolidateBlogHeroCopy();
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
