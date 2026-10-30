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
    script.src = '/js/funnel.js?v=20261030-step1-cache-bust-v1';
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

  function zipToStateCode(rawZip) {
    var digits = String(rawZip || '').replace(/\D/g, '').slice(0, 5);
    if (digits.length !== 5) return '';
    var p = parseInt(digits.slice(0, 3), 10);
    if (p >= 320 && p <= 349) return 'FL';
    if (p >= 350 && p <= 369) return 'AL';
    if (p >= 850 && p <= 865) return 'AZ';
    if ((p >= 300 && p <= 319) || p === 398 || p === 399) return 'GA';
    if (p >= 500 && p <= 528) return 'IA';
    if (p >= 460 && p <= 479) return 'IN';
    if (p >= 660 && p <= 679) return 'KS';
    if (p >= 700 && p <= 714) return 'LA';
    if (p >= 206 && p <= 219) return 'MD';
    if (p >= 480 && p <= 499) return 'MI';
    if (p >= 630 && p <= 658) return 'MO';
    if (p >= 386 && p <= 397) return 'MS';
    if (p >= 270 && p <= 289) return 'NC';
    if (p >= 680 && p <= 693) return 'NE';
    if (p >= 70 && p <= 89) return 'NJ';
    if (p >= 430 && p <= 459) return 'OH';
    if (p >= 730 && p <= 749) return 'OK';
    if (p >= 290 && p <= 299) return 'SC';
    if (p >= 370 && p <= 385) return 'TN';
    if ((p >= 750 && p <= 799) || p === 885) return 'TX';
    if (p === 201 || (p >= 220 && p <= 246)) return 'VA';
    if (p >= 980 && p <= 994) return 'WA';
    if (p >= 247 && p <= 268) return 'WV';
    if (p >= 900 && p <= 961) return 'CA';
    if (p >= 100 && p <= 149) return 'NY';
    return '';
  }

  function ensureHiddenInput(form, name, value) {
    if (!form) return;
    var input = form.querySelector('input[name="' + name + '"]');
    if (!input) {
      input = d.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }
    input.value = value || '';
  }

  function syncStep1CoverageToLeadForm(form, rawIntent) {
    if (!form) return;
    var intent = String(rawIntent || '').trim().toLowerCase();
    var choiceRadio = form.querySelector('input[name="coverage_choice"][value="' + (intent === 'medicare' ? 'medicare' : 'marketplace') + '"]');
    if (choiceRadio) {
      choiceRadio.checked = true;
      try { choiceRadio.dispatchEvent(new w.Event('change', { bubbles: true })); } catch (e) {}
    }
    var select = form.querySelector('select[name="coverage_status"]');
    if (select) {
      var candidates = intent === 'medicare'
        ? ['medicare_advantage', 'current_plan_review', 'turning_65', 'not_sure']
        : intent === 'lost-coverage'
          ? ['losing_coverage', 'individual_marketplace', 'not_sure']
          : intent === 'provider-check'
            ? ['current_plan_review', 'medicare_advantage', 'individual_marketplace', 'not_sure']
            : ['individual_marketplace', 'family_marketplace', 'self_employed', 'current_plan_review', 'not_sure'];
      for (var i = 0; i < candidates.length; i += 1) {
        var opt = select.querySelector('option[value="' + candidates[i] + '"]');
        if (opt) {
          select.value = candidates[i];
          break;
        }
      }
    }
  }

  function wireHeroStep1MicroIntakes() {
    d.querySelectorAll('[data-lhi-step1-intake]').forEach(function (box) {
      if (box.__lhiStep1Wired) return;
      box.__lhiStep1Wired = true;
      var zipInput = box.querySelector('[data-step1-zip]');
      var intentInput = box.querySelector('[data-step1-intent]');
      var continueBtn = box.querySelector('[data-step1-continue]');
      var errorEl = box.querySelector('[data-step1-error]');
      var targetSelector = box.getAttribute('data-step1-form') || '';

      function resolveStep2Form() {
        if (targetSelector) {
          var explicitForm = d.querySelector(targetSelector);
          if (explicitForm) return explicitForm;
        }
        return d.querySelector('form[data-lhi-site-lead-form], form[data-sitelink-lead-form]');
      }

      function markStarted() {
        ensureFunnelScriptLoaded();
        var step2 = resolveStep2Form();
        if (typeof w.lhiTrackFormStart === 'function') {
          try { w.lhiTrackFormStart(step2 || box); } catch (e) {}
        }
      }

      function syncToStep2() {
        var step2 = resolveStep2Form();
        var cleanZip = zipInput ? String(zipInput.value || '').replace(/\D/g, '').slice(0, 5) : '';
        if (zipInput && zipInput.value !== cleanZip && /^\d+$/.test(String(zipInput.value || ''))) {
          zipInput.value = cleanZip;
        }
        if (errorEl && cleanZip.length === 5 && !errorEl.classList.contains('is-success')) {
          errorEl.textContent = '';
        }
        var stateCode = cleanZip.length === 5 ? zipToStateCode(cleanZip) : '';
        if (stateCode && isMedicareLeadSurface()) {
          var showOut = isOutOfStateMedicareCoverageState(stateCode);
          d.querySelectorAll('#outOfStateMedicareNote').forEach(function (note) {
            note.hidden = !showOut;
          });
        }
        if (!step2) return cleanZip;
        if (cleanZip.length === 5) {
          var step2Zip = step2.querySelector('input[name="zip_code"]');
          if (step2Zip) step2Zip.value = cleanZip;
          if (stateCode) {
            ensureHiddenInput(step2, 'coverage_state', stateCode);
            ensureHiddenInput(step2, 'state', stateCode);
          }
        }
        if (intentInput) {
          syncStep1CoverageToLeadForm(step2, intentInput.value);
        }
        return cleanZip;
      }

      if (zipInput) {
        ['focus', 'input', 'change'].forEach(function (evt) {
          zipInput.addEventListener(evt, function () {
            markStarted();
            syncToStep2();
          });
        });
        zipInput.addEventListener('keydown', function (ev) {
          if (ev && ev.key === 'Enter') {
            ev.preventDefault();
            if (continueBtn) continueBtn.click();
          }
        });
      }
      if (intentInput) {
        ['focus', 'change'].forEach(function (evt) {
          intentInput.addEventListener(evt, function () {
            markStarted();
            syncToStep2();
          });
        });
      }
      if (continueBtn) {
        continueBtn.addEventListener('click', function () {
          markStarted();
          var cleanZip = syncToStep2();
          if (!/^\d{5}$/.test(cleanZip)) {
            if (errorEl) {
              errorEl.classList.remove('is-success');
              errorEl.textContent = 'Enter a 5-digit ZIP code to continue.';
            }
            if (zipInput && typeof zipInput.focus === 'function') zipInput.focus();
            return;
          }
          if (errorEl) {
            errorEl.classList.remove('is-success');
            errorEl.textContent = '';
          }
          var selectedIntent = intentInput ? String(intentInput.value || 'not-sure').trim().toLowerCase() : 'not-sure';
          var stateCode = zipToStateCode(cleanZip) || 'FL';
          var step2 = resolveStep2Form();
          var forceGetHelp = box.getAttribute('data-step1-route') === 'get-help';
          var formName = step2 ? String(step2.getAttribute('name') || '') : '';
          var hasCoverageChoice = Boolean(step2 && step2.hasAttribute && step2.hasAttribute('data-sitelink-coverage-choice'));
          var fixedIntentInput = (!hasCoverageChoice && step2 && step2.querySelector)
            ? step2.querySelector('input[type="hidden"][name="normalized_intent"]')
            : null;
          var fixedIntent = fixedIntentInput ? String(fixedIntentInput.value || '').trim().toLowerCase() : '';
          var isMedicareOnlyForm = formName === 'site-medicare-lead' || fixedIntent === 'medicare';
          var isAcaOnlyForm = formName === 'site-aca-lead' || fixedIntent === 'aca';
          var laneMismatch = Boolean(
            (isMedicareOnlyForm && (selectedIntent === 'under-65' || selectedIntent === 'aca' || selectedIntent === 'lost-coverage')) ||
            (isAcaOnlyForm && selectedIntent === 'medicare')
          );

          if (!step2 || forceGetHelp || laneMismatch) {
            if (typeof w.lhiTrackPlanReviewCtaClick === 'function') {
              try { w.lhiTrackPlanReviewCtaClick('step1_continue_get_help'); } catch (e) {}
            }
            var params = new URLSearchParams();
            params.set('zip_code', cleanZip);
            params.set('intent', selectedIntent === 'aca' ? 'under-65' : selectedIntent);
            if (stateCode) params.set('state', stateCode);
            var pageKey = box.getAttribute('data-source-page-key') || (d.body && d.body.getAttribute('data-page-key')) || '';
            if (pageKey && selectedIntent === 'medicare') {
              params.set('source_page_key', pageKey);
              params.set('source_cta_key', 'request_review_hero');
            }
            w.location.href = '/get-help/?' + params.toString();
            return;
          }

          box.classList.add('is-step1-complete');
          if (errorEl) {
            errorEl.classList.add('is-success');
            errorEl.textContent = 'ZIP ' + cleanZip + ' saved. Enter your name and phone in Step 2.';
          }
          var card = step2.closest('.lhi-lead-hero__card') || step2;
          if (card && card.classList) card.classList.add('is-step2-active');
          var nameInput = step2.querySelector('input[name="full_name"]');
          if (nameInput) {
            scrollToLeadTarget(card);
            if (typeof nameInput.focus === 'function') {
              try { nameInput.focus({ preventScroll: true }); } catch (e) { nameInput.focus(); }
            }
          }
        });
      }
    });
  }

  function wireSiteLeadForms() {
    d.querySelectorAll('form[data-lhi-site-lead-form]').forEach(function (form) {
      stampInitialLeadSpamGuard(form);
      if (form.__lhiSiteLeadWired) return;
      form.__lhiSiteLeadWired = true;
      var zipEl = form.querySelector('input[name="zip_code"]');
      if (zipEl) {
        ['input', 'change'].forEach(function (evt) {
          zipEl.addEventListener(evt, function () {
            var code = zipToStateCode(zipEl.value);
            if (code) {
              ensureHiddenInput(form, 'coverage_state', code);
              ensureHiddenInput(form, 'state', code);
            }
          });
        });
      }
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
    var isMed = isMedicareLeadSurface();
    var quoteLabel = isMed ? 'Review form' : 'Get quote';
    var path = String(w.location && w.location.pathname || '').toLowerCase();
    var smsBody = 'Hi David, I have a question about health insurance in Lakeland.';
    if (path.indexOf('watson') !== -1 || path.indexOf('orlando') !== -1) {
      smsBody = 'Hi David, can you check if my Watson Clinic / Orlando Health doctors are in-network for 2027?';
    } else if (isMed) {
      smsBody = 'Hi David, can you check my doctors and 2027 Medicare plan options?';
    } else if (path.indexOf('aca') !== -1 || path.indexOf('marketplace') !== -1) {
      smsBody = 'Hi David, can you help me check 2027 Marketplace subsidy and plan options?';
    }
    var rawPhone = PHONE_HREF.replace('tel:', '');
    var smsHref = 'sms:' + rawPhone + '?body=' + encodeURIComponent(smsBody);

    var bar = d.createElement('div');
    bar.id = 'lhi-lead-sticky-bar';
    bar.className = STICKY_CLASS;
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Quick contact');
    bar.innerHTML =
      '<a class="lhi-lead-sticky__call" href="' + PHONE_HREF + '" data-lhi-sticky-call>Call David</a>' +
      '<a class="lhi-lead-sticky__sms" href="' + smsHref + '" data-lhi-sms-cta="sticky_bar_sms" data-analytics-label="sticky_bar_sms">Text David</a>' +
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
    wireHeroStep1MicroIntakes();
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
