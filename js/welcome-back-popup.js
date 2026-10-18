(function (w, d) {
  'use strict';

  if (w.__LHI_WELCOME_BACK_LOADED__) return;
  w.__LHI_WELCOME_BACK_LOADED__ = true;

  var VERSION = '20261018-welcome-back-v1';
  var STORAGE_KEY = 'lhi_returning_visitor_v1';
  var SUPPRESS_DAYS = 30;
  var VISIT_IDLE_MS = 30 * 60 * 1000;
  var SHOW_DELAY_MS = 20000;
  var CONSENT_VERSION = 'returning-visitor-feedback-2026-10-18-v1';
  var SOURCE_TAG = 'returning-visitor-feedback';
  var PHONE_DISPLAY = '(863) 640-3102';

  var CONSENT_HTML =
    'By checking this box, I give my prior express written consent for Lakeland Health Insurance (David Huff, licensed insurance agent) to contact me about my insurance request, including marketing calls and text messages, at the phone number I provided, which may be sent using an automated system for the selection or dialing of telephone numbers. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. See <a href="/sms-policy.html" target="_blank" rel="noopener noreferrer">SMS Terms</a> and <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.';

  var LEGAL_PATHS = [
    '/privacy-policy.html',
    '/privacy-policy/',
    '/terms-of-service.html',
    '/terms-of-service/',
    '/terms.html',
    '/terms/',
    '/data-deletion/',
    '/data-deletion/index.html',
    '/sms-policy.html',
    '/sms-policy/',
    '/sms-terms.html'
  ];

  var EXCLUDED_PREFIXES = [
    '/lp/',
    '/medicare-2027-check/',
    '/get-help/',
    '/thank-you/',
    '/thanks.html',
    '/book/'
  ];

  function normalizePath(pathname) {
    var path = String(pathname || '/').split(/[?#]/, 1)[0] || '/';
    if (path.length > 1 && path.charAt(path.length - 1) !== '/' && !/\.[a-z0-9]+$/i.test(path)) {
      path += '/';
    }
    return path;
  }

  function pathExcluded(pathname) {
    var path = normalizePath(pathname);
    var raw = String(pathname || '/').split(/[?#]/, 1)[0] || '/';
    if (LEGAL_PATHS.indexOf(raw) !== -1 || LEGAL_PATHS.indexOf(path) !== -1) return true;
    return EXCLUDED_PREFIXES.some(function (prefix) {
      return path.indexOf(prefix) === 0 || raw.indexOf(prefix) === 0;
    });
  }

  function isDeployPreviewHost() {
    var host = String(w.location && w.location.hostname || '').toLowerCase();
    return host.indexOf('netlify.app') !== -1 || host.indexOf('netlify.live') !== -1;
  }

  function forceShowRequested() {
    try {
      if (!isDeployPreviewHost()) return false;
      return /[?&]wb=1(?:&|$)/.test(String(w.location.search || ''));
    } catch (e) {
      return false;
    }
  }

  function readState() {
    try {
      var raw = w.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeState(state) {
    try {
      w.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function nowMs() {
    return Date.now();
  }

  function touchVisitState(forcePreview) {
    var state = readState() || {
      visitCount: 0,
      lastActivityMs: 0,
      suppressUntilMs: 0,
      shownThisVisit: false
    };
    var t = nowMs();
    if (state.suppressUntilMs && t < state.suppressUntilMs) {
      state.lastActivityMs = t;
      writeState(state);
      return state;
    }
    if (!state.lastActivityMs || t - state.lastActivityMs > VISIT_IDLE_MS) {
      state.visitCount = (Number(state.visitCount) || 0) + 1;
      state.shownThisVisit = false;
    }
    state.lastActivityMs = t;
    if (forcePreview) {
      state.visitCount = Math.max(Number(state.visitCount) || 0, 2);
      state.shownThisVisit = false;
      state.suppressUntilMs = 0;
    }
    writeState(state);
    return state;
  }

  function suppressThirtyDays() {
    var state = readState() || {};
    state.suppressUntilMs = nowMs() + SUPPRESS_DAYS * 24 * 60 * 60 * 1000;
    state.shownThisVisit = true;
    state.lastActivityMs = nowMs();
    writeState(state);
  }

  function markShownThisVisit() {
    var state = readState() || {};
    state.shownThisVisit = true;
    state.lastActivityMs = nowMs();
    writeState(state);
  }

  function shouldOfferPopup(state, forcePreview) {
    if (!state) return false;
    var t = nowMs();
    if (state.suppressUntilMs && t < state.suppressUntilMs) return false;
    if (state.shownThisVisit) return false;
    if (forcePreview) return true;
    return (Number(state.visitCount) || 0) >= 2;
  }

  function leadFormInteractionActive() {
    var active = d.activeElement;
    if (!active) return false;
    if (active.closest && active.closest('form[data-lhi-site-lead-form], form[data-funnel-track], .lhi-lead-hero__form')) {
      return true;
    }
    if (active.matches && active.matches('input, textarea, select, button') && active.closest('form')) {
      return true;
    }
    return false;
  }

  function analyticsConsentGranted() {
    try {
      return w.localStorage.getItem('lhi_meta_audience_consent') === 'granted';
    } catch (e) {
      return false;
    }
  }

  function trackPopupEvent(name) {
    if (!analyticsConsentGranted()) return;
    try {
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({
        event: name,
        popup_name: 'returning_visitor_feedback',
        page_path: normalizePath(w.location.pathname)
      });
    } catch (e) {}
    try {
      if (typeof w.gtag === 'function') {
        w.gtag('event', name, {
          popup_name: 'returning_visitor_feedback',
          page_path: normalizePath(w.location.pathname)
        });
      }
    } catch (e) {}
    try {
      if (typeof w.fbq === 'function') {
        w.fbq('trackCustom', name, {
          popup_name: 'returning_visitor_feedback'
        });
      }
    } catch (e) {}
  }

  function syncMobileOffset() {
    var offset = 0;
    if (d.body.classList.contains('has-floating-actions')) {
      var floating = d.querySelector('.floating-actions');
      if (floating) {
        offset = Math.ceil(floating.getBoundingClientRect().height) || 0;
      }
    }
    if (d.body.classList.contains('lhi-lead-sticky-active')) {
      offset = Math.max(offset, 72);
    }
    d.documentElement.style.setProperty('--lhi-wb-mobile-offset', offset + 'px');
  }

  function FocusTrap(root, onEscape) {
    this.root = root;
    this.onEscape = onEscape;
    this.previous = null;
  }

  FocusTrap.prototype.focusables = function () {
    return Array.prototype.slice.call(
      this.root.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(function (el) {
      return el.offsetParent !== null || el === d.activeElement;
    });
  };

  FocusTrap.prototype.handleKey = function (event) {
    if (!event || event.key === 'Escape') {
      if (typeof this.onEscape === 'function') this.onEscape();
      return;
    }
    if (event.key !== 'Tab') return;
    var items = this.focusables();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && d.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && d.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  FocusTrap.prototype.activate = function () {
    this.previous = d.activeElement;
    var items = this.focusables();
    if (items.length) items[0].focus();
    this.bound = this.handleKey.bind(this);
    d.addEventListener('keydown', this.bound, true);
  };

  FocusTrap.prototype.deactivate = function () {
    if (this.bound) d.removeEventListener('keydown', this.bound, true);
    if (this.previous && typeof this.previous.focus === 'function') {
      try { this.previous.focus(); } catch (e) {}
    }
  };

  function buildUi(host, state, visitCount) {
    host.innerHTML =
      '<button type="button" class="lhi-wb-popup-backdrop" data-lhi-wb-dismiss aria-label="Close dialog"></button>' +
      '<div class="lhi-wb-popup-panel" role="dialog" aria-modal="true" aria-labelledby="lhi-wb-popup-title">' +
        '<div class="lhi-wb-popup-view" data-lhi-wb-view="form">' +
          '<div class="lhi-wb-popup-header">' +
            '<h2 class="lhi-wb-popup-title" id="lhi-wb-popup-title">Welcome back!</h2>' +
            '<button type="button" class="lhi-wb-popup-close" data-lhi-wb-dismiss aria-label="Close">&times;</button>' +
          '</div>' +
          '<p class="lhi-wb-popup-intro">Thanks for coming back. I\'d love to hear what you\'re looking for, or how I can make this site more helpful.</p>' +
          '<form class="lhi-wb-popup-form" data-lhi-wb-form novalidate>' +
            '<div class="lhi-wb-popup-honeypot" aria-hidden="true"><label>Leave blank<input type="text" name="bot-field" tabindex="-1" autocomplete="off"></label></div>' +
            '<div class="lhi-wb-popup-field">' +
              '<label for="lhi-wb-brought-back">What brought you back?</label>' +
              '<textarea id="lhi-wb-brought-back" name="brought_back" required rows="3"></textarea>' +
            '</div>' +
            '<div class="lhi-wb-popup-field">' +
              '<label for="lhi-wb-help-with">Anything I can help with?</label>' +
              '<textarea id="lhi-wb-help-with" name="help_with" rows="2"></textarea>' +
            '</div>' +
            '<div class="lhi-wb-popup-field">' +
              '<label for="lhi-wb-name">Name <span style="font-weight:400">(optional)</span></label>' +
              '<input id="lhi-wb-name" type="text" name="name" autocomplete="name">' +
            '</div>' +
            '<div class="lhi-wb-popup-field">' +
              '<label for="lhi-wb-phone">Phone <span style="font-weight:400">(optional)</span></label>' +
              '<input id="lhi-wb-phone" type="tel" name="phone" autocomplete="tel" inputmode="tel">' +
            '</div>' +
            '<div class="lhi-wb-popup-field" data-lhi-wb-consent-wrap hidden>' +
              '<label class="lhi-wb-popup-consent">' +
                '<input type="checkbox" name="consent" value="yes">' +
                '<span>' + CONSENT_HTML + '</span>' +
              '</label>' +
            '</div>' +
            '<p class="lhi-wb-popup-status" data-lhi-wb-status role="status" aria-live="polite"></p>' +
            '<div class="lhi-wb-popup-actions">' +
              '<button type="submit" class="lhi-wb-popup-submit">Send</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
        '<div class="lhi-wb-popup-view lhi-wb-popup-thanks" data-lhi-wb-view="thanks" hidden>' +
          '<div class="lhi-wb-popup-header">' +
            '<h2 class="lhi-wb-popup-title" id="lhi-wb-thanks-title">Thanks!</h2>' +
            '<button type="button" class="lhi-wb-popup-close" data-lhi-wb-dismiss aria-label="Close">&times;</button>' +
          '</div>' +
          '<p>Thanks! David reads every note.</p>' +
          '<div class="lhi-wb-popup-signoff">' +
            '<strong>David Huff</strong>' +
            '<span>' + PHONE_DISPLAY + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    var panel = host.querySelector('.lhi-wb-popup-panel');
    var trap = new FocusTrap(panel, function () {
      closePopup(host, trap, true);
    });

    host.querySelectorAll('[data-lhi-wb-dismiss]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closePopup(host, trap, true);
      });
    });

    var phoneInput = host.querySelector('#lhi-wb-phone');
    var consentWrap = host.querySelector('[data-lhi-wb-consent-wrap]');
    function syncConsentVisibility() {
      var hasPhone = String(phoneInput && phoneInput.value || '').trim().length > 0;
      if (consentWrap) consentWrap.hidden = !hasPhone;
    }
    if (phoneInput) {
      phoneInput.addEventListener('input', syncConsentVisibility);
      syncConsentVisibility();
    }

    var form = host.querySelector('[data-lhi-wb-form]');
    var startedAt = nowMs();
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submitFeedback(form, host, trap, visitCount, startedAt);
    });

    host.__lhiTrap = trap;
    return trap;
  }

  function setStatus(form, message) {
    var node = form && form.querySelector('[data-lhi-wb-status]');
    if (node) node.textContent = message || '';
  }

  function closePopup(host, trap, suppress) {
    if (!host) return;
    host.classList.remove('is-open');
    if (trap) trap.deactivate();
    if (suppress) suppressThirtyDays();
    w.setTimeout(function () {
      if (host.parentNode) host.parentNode.removeChild(host);
    }, 280);
  }

  function showThanks(host) {
    var formView = host.querySelector('[data-lhi-wb-view="form"]');
    var thanksView = host.querySelector('[data-lhi-wb-view="thanks"]');
    if (formView) formView.hidden = true;
    if (thanksView) {
      thanksView.hidden = false;
      var btn = thanksView.querySelector('.lhi-wb-popup-close');
      if (btn && typeof btn.focus === 'function') btn.focus();
    }
  }

  function humanCheckValue(startedAt) {
    try {
      return w.btoa(String(startedAt) + ':lakeland-human');
    } catch (e) {
      return '';
    }
  }

  function submitFeedback(form, host, trap, visitCount, startedAt) {
    var broughtBack = String(form.elements.brought_back && form.elements.brought_back.value || '').trim();
    if (!broughtBack) {
      setStatus(form, 'Please share what brought you back.');
      if (form.elements.brought_back) form.elements.brought_back.focus();
      return;
    }
    var phone = String(form.elements.phone && form.elements.phone.value || '').trim();
    var consentChecked = form.elements.consent && form.elements.consent.checked;
    if (phone && !consentChecked) {
      setStatus(form, 'Please check the consent box to submit with a phone number.');
      return;
    }
    var bot = String(form.elements['bot-field'] && form.elements['bot-field'].value || '').trim();
    if (bot) {
      closePopup(host, trap, true);
      return;
    }

    var submitBtn = form.querySelector('.lhi-wb-popup-submit');
    if (submitBtn) submitBtn.disabled = true;
    setStatus(form, 'Sending…');

    var payload = {
      'form-name': 'returning-visitor-feedback',
      brought_back: broughtBack,
      help_with: String(form.elements.help_with && form.elements.help_with.value || '').trim(),
      name: String(form.elements.name && form.elements.name.value || '').trim(),
      phone: phone,
      consent: consentChecked ? 'yes' : '',
      source_tag: SOURCE_TAG,
      visit_count: String(visitCount || ''),
      source_page: normalizePath(w.location.pathname),
      source_url: normalizePath(w.location.pathname),
      started_at: String(startedAt),
      human_check: humanCheckValue(startedAt),
      consent_text_version: CONSENT_VERSION
    };

    w.fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return (typeof res.json === 'function' ? res.json().catch(function () { return null; }) : Promise.resolve(null))
        .then(function (body) {
          if (res.ok && body && body.ok === true) {
            trackPopupEvent('popup_submit');
            suppressThirtyDays();
            showThanks(host);
            if (submitBtn) submitBtn.disabled = false;
            return;
          }
          throw new Error('submit_failed');
        });
    }).catch(function () {
      if (submitBtn) submitBtn.disabled = false;
      setStatus(form, 'Something went wrong. Please try again in a moment.');
    });
  }

  function openPopup(state) {
    if (d.getElementById('lhi-wb-popup-host')) return;
    if (leadFormInteractionActive()) return;

    syncMobileOffset();
    var host = d.createElement('div');
    host.id = 'lhi-wb-popup-host';
    host.className = 'lhi-wb-popup-host';
    d.body.appendChild(host);

    var visitCount = Number(state && state.visitCount) || 0;
    var trap = buildUi(host, state, visitCount);
    markShownThisVisit();
    trackPopupEvent('popup_shown');

    w.requestAnimationFrame(function () {
      host.classList.add('is-open');
      trap.activate();
    });
  }

  function scheduleShow(state, forcePreview) {
    if (!shouldOfferPopup(state, forcePreview)) return;
    var timer = w.setTimeout(function () {
      if (leadFormInteractionActive()) return;
      if (!shouldOfferPopup(readState(), forcePreview)) return;
      openPopup(readState());
    }, forcePreview ? 800 : SHOW_DELAY_MS);
    w.addEventListener('beforeunload', function () {
      w.clearTimeout(timer);
    }, { once: true });
  }

  function initWelcomeBackPopup() {
    if (pathExcluded(w.location.pathname)) return;

    var forcePreview = forceShowRequested();
    var state = touchVisitState(forcePreview);

    d.addEventListener('focusin', function () {
      /* defer while user is in a lead form */
    }, true);

    w.addEventListener('resize', syncMobileOffset, { passive: true });
    w.addEventListener('orientationchange', syncMobileOffset, { passive: true });

    scheduleShow(state, forcePreview);
  }

  function startIdle() {
    if (pathExcluded(w.location.pathname)) return;
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(initWelcomeBackPopup, { timeout: 4000 });
    } else {
      w.setTimeout(initWelcomeBackPopup, 1200);
    }
  }

  w.LHIWelcomeBackPopup = {
    STORAGE_KEY: STORAGE_KEY,
    normalizePath: normalizePath,
    pathExcluded: pathExcluded,
    touchVisitState: touchVisitState,
    shouldOfferPopup: shouldOfferPopup,
    forceShowRequested: forceShowRequested,
    init: initWelcomeBackPopup,
    forceOpenForQA: function () {
      if (pathExcluded(w.location.pathname)) return false;
      var state = touchVisitState(true);
      openPopup(state);
      return true;
    }
  };

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', startIdle);
  } else {
    startIdle();
  }
})(window, document);
