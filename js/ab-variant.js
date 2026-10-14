/*
 * Netlify branch split testing — homepage hero primary CTA (test 1).
 * Resolves one variant from nf_ab cookie and/or branch deploy hostname.
 * Default (control) leaves DOM unchanged. Persists lhi_ab_variant for leads/bookings.
 */
(function (w, d) {
  'use strict';

  var NF_AB_COOKIE = 'nf_ab';
  var PERSIST_COOKIE = 'lhi_ab_variant';
  var VARIANT_BRANCH = 'split-b';
  var ACTIVE_TEST = 'home-hero-primary-cta';
  var COOKIE_DAYS = 90;

  var VARIANTS = Object.freeze({
    control: Object.freeze({
      id: 'control',
      test: ACTIVE_TEST
    }),
    b: Object.freeze({
      id: 'home-hero-primary-b',
      test: ACTIVE_TEST,
      label: 'Talk with a licensed Florida health agent',
      href: 'tel:+18636403102',
      analyticsLabel: 'home_hero_ab_phone_primary'
    })
  });

  function readCookie(name) {
    var match = d.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function writeCookie(name, value, days) {
    var exp = '';
    var secure = w.location && w.location.protocol === 'https:' ? '; Secure' : '';
    if (days) {
      var dt = new Date();
      dt.setTime(dt.getTime() + days * 86400000);
      exp = '; expires=' + dt.toUTCString();
    }
    d.cookie = name + '=' + encodeURIComponent(value) + exp + '; path=/; SameSite=Lax' + secure;
  }

  function branchFromHostname() {
    var host = String(w.location && w.location.hostname || '').toLowerCase();
    var match = host.match(/^([a-z0-9][a-z0-9-]*)--/);
    return match ? match[1] : '';
  }

  function nfAbIndicatesVariantB(raw) {
    var text = String(raw || '').trim().toLowerCase();
    if (!text) return false;
    if (text === VARIANT_BRANCH) return true;
    return text.indexOf(VARIANT_BRANCH) !== -1;
  }

  function branchEnvIndicatesVariantB() {
    var branch = String(w.__LHI_NETLIFY_BRANCH || '').trim().toLowerCase();
    if (branch === VARIANT_BRANCH) return true;
    return branchFromHostname() === VARIANT_BRANCH;
  }

  function approvedVariantId(value) {
    var text = String(value || '').trim().toLowerCase();
    if (!text || text.length > 64) return null;
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(text)) return null;
    if (text === VARIANTS.control.id || text === VARIANTS.b.id) return text;
    return null;
  }

  function resolveVariantId() {
    if (nfAbIndicatesVariantB(readCookie(NF_AB_COOKIE)) || branchEnvIndicatesVariantB()) {
      return VARIANTS.b.id;
    }
    var persisted = approvedVariantId(readCookie(PERSIST_COOKIE));
    if (persisted === VARIANTS.b.id) return VARIANTS.b.id;
    return VARIANTS.control.id;
  }

  function persistVariant(id) {
    var approved = approvedVariantId(id) || VARIANTS.control.id;
    writeCookie(PERSIST_COOKIE, approved, COOKIE_DAYS);
    return approved;
  }

  function applyHomeHeroPrimary(variantId) {
    if (variantId !== VARIANTS.b.id) return;
    var cfg = VARIANTS.b;
    d.querySelectorAll('[data-lhi-ab-home-primary]').forEach(function (link) {
      if (!link || link.tagName !== 'A') return;
      link.textContent = cfg.label;
      link.setAttribute('href', cfg.href);
      link.setAttribute('data-analytics-label', cfg.analyticsLabel);
      link.classList.remove('secondary');
    });
  }

  function getVariant() {
    return persistVariant(resolveVariantId());
  }

  function boot() {
    var id = getVariant();
    applyHomeHeroPrimary(id);
  }

  w.LHIAbVariant = {
    getVariant: getVariant,
    getTest: function () { return ACTIVE_TEST; },
    applyHomeHeroPrimary: applyHomeHeroPrimary,
    VARIANTS: VARIANTS,
    VARIANT_BRANCH: VARIANT_BRANCH
  };

  if (w.__LHI_TEST === true) {
    w.LHIAbVariant._t = {
      nfAbIndicatesVariantB: nfAbIndicatesVariantB,
      branchFromHostname: branchFromHostname,
      branchEnvIndicatesVariantB: branchEnvIndicatesVariantB,
      approvedVariantId: approvedVariantId,
      resolveVariantId: resolveVariantId,
      readCookie: readCookie
    };
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window, document);
