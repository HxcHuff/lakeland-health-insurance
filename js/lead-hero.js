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
    IA: true,
    IN: true,
    KS: true,
    LA: true,
    MD: true,
    MI: true,
    MO: true,
    MS: true,
    NC: true,
    NE: true,
    NJ: true,
    OH: true,
    OK: true,
    SC: true,
    TN: true,
    TX: true,
    VA: true,
    WA: true,
    WV: true
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

  function stampInitialLeadSpamGuard(form) {
    if (!form) return;
    var startedInput = form.querySelector('input[name="started_at"]');
    if (startedInput && !String(startedInput.value || '').trim()) {
      var navOffset = w.performance && typeof w.performance.now === 'function'
        ? Math.max(0, Math.round(w.performance.now()))
        : 0;
      var startedAt = String(Date.now() - navOffset);
      startedInput.value = startedAt;
      var humanInput = form.querySelector('input[name="human_check"]');
      if (humanInput && typeof w.btoa === 'function') {
        try {
          humanInput.value = w.btoa(startedAt + ':lakeland-human');
        } catch (e) {}
      }
    }
  }

  function ensureFunnelScriptLoaded() {
    if (w.LHI || d.querySelector('script[src*="/js/funnel.js"]')) return;
    var script = d.createElement('script');
    script.src = '/js/funnel.js?v=20261018-licensed-states-23-v1';
    script.defer = true;
    (d.head || d.documentElement).appendChild(script);
  }

  function defaultAutofilledCoverageStatus(form) {
    if (!form) return;
    var select = form.querySelector('select[name="coverage_status"]');
    if (!select || String(select.value || '').trim()) return;
    var nameInput = form.querySelector('input[name="full_name"]');
    var phoneInput = form.querySelector('input[name="phone"]');
    var zipInput = form.querySelector('input[name="zip_code"]');
    var hasContact = Boolean(
      (nameInput && String(nameInput.value || '').trim()) ||
      (phoneInput && String(phoneInput.value || '').trim()) ||
      (zipInput && String(zipInput.value || '').trim())
    );
    if (!hasContact) return;
    var preferredOrder = ['current_plan_review', 'not_sure', 'medicare_advantage', 'individual_marketplace'];
    for (var i = 0; i < preferredOrder.length; i += 1) {
      var candidate = preferredOrder[i];
      var opt = select.querySelector('option[value="' + candidate + '"]');
      if (opt) {
        select.value = candidate;
        return;
      }
    }
  }

  function wireSiteLeadForms() {
    d.querySelectorAll('form[data-lhi-site-lead-form]').forEach(function (form) {
      stampInitialLeadSpamGuard(form);
      if (form.__lhiSiteLeadWired) return;
      form.__lhiSiteLeadWired = true;
      form.addEventListener('focusin', ensureFunnelScriptLoaded, { capture: true, passive: true });
      form.addEventListener('pointerdown', ensureFunnelScriptLoaded, { capture: true, passive: true });
      var submitBtn = form.querySelector('.lhi-lead-hero__submit, button[type="submit"]');
      if (submitBtn) {
        submitBtn.addEventListener('click', function () {
          ensureFunnelScriptLoaded();
          defaultAutofilledCoverageStatus(form);
        }, { capture: true });
      }
      form.addEventListener('submit', function () {
        defaultAutofilledCoverageStatus(form);
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

  function isMedicareLeadSurface() {
    return Boolean(
      d.querySelector('.lhi-lead-hero[data-variant="medicare"]') ||
      d.querySelector('meta[name="lhi-chrome-intent"][content="medicare"]')
    );
  }

  function ensureStickyBar() {
    if (!d.querySelector('.lhi-lead-hero') || d.getElementById('lhi-lead-sticky-bar')) return null;
    var quoteLabel = isMedicareLeadSurface() ? 'Request review' : 'Get a quote';
    var bar = d.createElement('div');
    bar.id = 'lhi-lead-sticky-bar';
    bar.className = STICKY_CLASS;
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Quick contact');
    bar.innerHTML =
      '<a class="lhi-lead-sticky__call" href="' + PHONE_HREF + '" data-lhi-sticky-call>Call ' + PHONE_DISPLAY + '</a>' +
      '<a class="lhi-lead-sticky__quote" href="#lhi-site-lead-form" data-lhi-sticky-quote>' + quoteLabel + '</a>';
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
    if (!bar) return;
    var heroForm = d.getElementById('lhi-site-lead-form');
    if (!heroForm) heroForm = d.querySelector('.lhi-lead-hero__card');
    if (!heroForm) return;
    if (typeof heroForm.getBoundingClientRect === 'function') {
      var rect = heroForm.getBoundingClientRect();
      var vh = w.innerHeight || 844;
      if (rect.bottom > 64 && rect.top < vh) {
        setLeadFormInView(true);
      }
    }
    if (!('IntersectionObserver' in w)) return;
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
      shell.querySelectorAll('.lhi-hero-deferred-block').forEach(function (def) {
        Array.prototype.slice.call(def.children).forEach(function (el) {
          if (removeIfDuplicateOfLede(el, ledePrefix)) return;
          if (el.nodeType === 1 && isMetaLike(el)) {
            ledeBlock.appendChild(el);
          }
        });
        if (!normHeroText(def.textContent) && !def.querySelector('*')) {
          def.remove();
        }
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
