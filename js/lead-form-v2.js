/* Lead form v2 — site hero forms. Progressive enhancement: without JS all steps post natively. */
(function (w, d) {
  'use strict';
  var LICENSED_MEDICARE_STATES = { AL:1, AZ:1, FL:1, GA:1, KS:1, NC:1, SC:1, TN:1, TX:1 };
  // ZIP3 ranges for the nine licensed states only (USPS prefixes). Anything else = outside.
  var ZIP3 = [
    ['AL',350,369],['AZ',850,865],['FL',320,339],['FL',341,342],['FL',344,344],['FL',346,347],['FL',349,349],
    ['GA',300,319],['GA',398,399],['KS',660,679],['NC',270,289],['SC',290,299],['TN',370,385],
    ['TX',750,799],['TX',733,733],['TX',885,885]
  ];
  function stateForZip(zip) {
    if (!/^\d{5}$/.test(zip)) return '';
    var p = parseInt(zip.slice(0, 3), 10);
    for (var i = 0; i < ZIP3.length; i++) if (p >= ZIP3[i][1] && p <= ZIP3[i][2]) return ZIP3[i][0];
    return 'OTHER';
  }
  /* Site-mode routing: one form, existing Netlify form names. */
  var SITE_ROUTES = {
    'medicare': { form: 'site-medicare-lead', version: 'site-lead-v2-2026-11-v1', line: 'Medicare' },
    'under-65': { form: 'site-aca-lead', version: 'site-lead-v2-2026-11-v1', line: 'Individual and Family Coverage' },
    'supplemental': { form: 'site-aca-lead', version: 'site-lead-v2-2026-11-v1', line: 'Supplemental' },
    'current-client-review': { form: 'get-help', version: 'get-help-2026-07-30-v1', line: 'Existing client',
      inquiry: 'Existing client', subject: 'Current Client Request: Annual Plan Review' }
  };
  var PICKED_LABEL = { 'medicare': 'Medicare', 'under-65': 'Under 65 coverage', 'supplemental': 'Supplemental coverage', 'current-client-review': 'Existing client' };

  function $(root, sel) { return root.querySelector(sel); }
  function $$(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function setHidden(form, name, value) {
    var el = null;
    $$(form, 'input[type="hidden"]').forEach(function (h) { if (!el && h.name === name) el = h; });
    if (!el) { el = d.createElement('input'); el.type = 'hidden'; el.name = name; form.appendChild(el); }
    el.value = value == null ? '' : value;
  }
  function digits(v) { return String(v || '').replace(/\D/g, ''); }
  function phoneDigits(v) { var x = digits(v); if (x.length === 11 && x.charAt(0) === '1') x = x.slice(1); return x; }
  function formatPhone(v) {
    var x = phoneDigits(v).slice(0, 10);
    if (x.length < 4) return x;
    if (x.length < 7) return '(' + x.slice(0, 3) + ') ' + x.slice(3);
    return '(' + x.slice(0, 3) + ') ' + x.slice(3, 6) + '-' + x.slice(6);
  }

  function init(form) {
    if (form.__lf2) return; form.__lf2 = true;
    form.classList.add('lf2--js');
    var mode = form.getAttribute('data-lf2-mode') || 'site';
    var steps = $$(form, '[data-lf2-step]');
    var bar = $$(form, '.lf2__bar span');
    var label = $(form, '[data-lf2-progress-label]');
    var names = ['What you need', 'Your ZIP code', 'How to reach you'];
    var current = 1;

    function intent() {
      if (mode !== 'site') return form.getAttribute('data-lf2-intent') || '';
      var c = $(form, 'input[name="normalized_intent"]:checked');
      return c ? c.value : '';
    }
    function applyRoute() {
      if (mode !== 'site') return;
      var r = SITE_ROUTES[intent()]; if (!r) return;
      form.setAttribute('name', r.form);
      setHidden(form, 'form-name', r.form);
      setHidden(form, 'consent_text_version', r.version);
      setHidden(form, 'line_of_business', r.line);
      setHidden(form, 'inquiry_type', r.inquiry || '');
      setHidden(form, '_subject', r.subject || '');
    }
    function syncIntentUI() {
      var it = intent();
      $$(form, '[data-lf2-show]').forEach(function (el) {
        var list = el.getAttribute('data-lf2-show').split(' ');
        var on = list.indexOf(it) !== -1;
        el.hidden = !on;
        $$(el, 'input').forEach(function (i) { i.disabled = !on; });
      });
      var picked = $(form, '[data-lf2-picked]');
      if (picked) picked.textContent = PICKED_LABEL[it] || '';
      syncZipNotes();
    }
    function syncZipNotes() {
      var zipEl = form.elements.zip_code; var zip = zipEl ? digits(zipEl.value) : '';
      var st = stateForZip(zip);
      var out = intent() === 'medicare' && st && !LICENSED_MEDICARE_STATES[st];
      var note = $(form, '[data-lf2-medicare-note]');
      if (note) note.classList.toggle('lf2__note--quiet', !out);
      if (note) note.setAttribute('data-out-of-state', out ? 'true' : 'false');
    }
    function track(step) {
      try { if (w.LHI && typeof w.LHI.track === 'function') w.LHI.track('LeadStep', { content_name: form.getAttribute('data-funnel-name') || 'lead_form_v2', step: 'step_' + step, intent: intent() || null }); } catch (e) {}
    }
    function go(n, opts) {
      current = n; form.setAttribute('data-lf2-at', String(n));
      steps.forEach(function (s) { s.classList.toggle('is-active', +s.getAttribute('data-lf2-step') === n); });
      bar.forEach(function (b, i) { b.className = i + 1 < n ? 'is-done' : (i + 1 === n ? 'is-current' : ''); });
      if (label) label.innerHTML = '<strong>Step ' + n + ' of 3</strong><span>' + names[n - 1] + '</span>';
      if (!opts || !opts.silent) {
        var focusEl = $(form, '[data-lf2-step="' + n + '"] legend, [data-lf2-step="' + n + '"] .lf2__q');
        if (focusEl) { focusEl.setAttribute('tabindex', '-1'); try { focusEl.focus({ preventScroll: true }); } catch (e) {} }
        var r = form.getBoundingClientRect();
        var headerH = parseFloat(getComputedStyle(d.documentElement).getPropertyValue('--lhi-site-header-height')) || 72;
        var narrow = w.innerWidth < 901;
        if ((narrow && n > 1 && Math.abs(r.top - headerH - 8) > 4) || r.top < headerH || r.top > w.innerHeight * 0.6) w.scrollTo({ top: Math.max(0, r.top + w.pageYOffset - headerH - 8), behavior: 'auto' });
        track(n);
      }
    }
    // Inline validation via native constraint API (submit never fires while invalid,
    // so funnel.js's /api/lead submit handler only ever sees a valid form).
    function wrap(el) { return el.closest('.lf2__field, .lf2__group'); }
    function showErr(el, msg) {
      var w2 = wrap(el); if (!w2) return;
      w2.classList.toggle('is-invalid', !!msg);
      var e = $(w2, '.lf2__err'); if (e) e.textContent = msg || '';
      if (el.setAttribute) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    function checkField(el) {
      var v = String(el.value || '').trim(), msg = '';
      if (el.name === 'zip_code') { if (!/^\d{5}$/.test(digits(v))) msg = 'Enter your 5-digit ZIP code.'; }
      else if (el.name === 'full_name') { if (v.length < 2) msg = 'Enter your name.'; }
      else if (el.name === 'phone') { if (phoneDigits(v).length !== 10) msg = 'Enter a 10-digit phone number.'; }
      else if (el.name === 'email') {
        var emailChan = form.elements.consent_email && form.elements.consent_email.checked;
        if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = 'Check the email address.';
        else if (!v && emailChan) msg = 'Add an email address, or uncheck email below.';
      }
      el.setCustomValidity(msg); showErr(el, msg); return !msg;
    }
    function checkChannels() {
      var boxes = $$(form, 'input[data-lf2-channel]'); if (!boxes.length) return true;
      var any = boxes.some(function (b) { return b.checked; });
      var msg = any ? '' : 'Choose at least one way David may contact you.';
      boxes[0].setCustomValidity(msg); showErr(boxes[0], msg); return !msg;
    }
    function checkRadio(name, msg) {
      var radios = $$(form, 'input[name="' + name + '"]:not(:disabled)'); if (!radios.length) return true;
      var ok = radios.some(function (r) { return r.checked; });
      radios[0].setCustomValidity(ok ? '' : msg); showErr(radios[0], ok ? '' : msg); return ok;
    }
    function validateStep(n) {
      var ok = true;
      if (n === 1) ok = mode === 'site' ? checkRadio('normalized_intent', 'Choose one to continue.') : checkRadio(form.getAttribute('data-lf2-step1-name'), 'Choose one to continue.');
      if (n === 2) ok = checkField(form.elements.zip_code);
      if (n === 3) {
        ['full_name', 'phone', 'email'].forEach(function (k) { if (form.elements[k] && !checkField(form.elements[k])) ok = false; });
        if (!checkChannels()) ok = false;
        if (mode === 'lp-gap') ok = checkRadio('best_time_to_reach', 'Choose a time.') && ok;
      }
      if (!ok) { var bad = $(form, '[data-lf2-step="' + n + '"] [aria-invalid="true"]'); if (bad) bad.focus(); }
      return ok;
    }
    form.addEventListener('invalid', function (e) { e.preventDefault(); }, true);

    $$(form, '[data-lf2-next]').forEach(function (btn) {
      btn.addEventListener('click', function () { if (validateStep(current)) go(current + 1); });
    });
    $$(form, '[data-lf2-back]').forEach(function (btn) {
      btn.addEventListener('click', function () { go(current - 1); });
    });
    $$(form, '[data-lf2-change]').forEach(function (btn) {
      btn.addEventListener('click', function () { go(1); });
    });
    // Step 1 tiles: choosing one advances (keyboard users can also use Continue).
    var step1 = mode === 'site' ? 'normalized_intent' : form.getAttribute('data-lf2-step1-name');
    $$(form, 'input[name="' + step1 + '"]').forEach(function (r) {
      r.addEventListener('change', function () {
        applyRoute(); syncIntentUI(); syncConversionSuppression(); checkRadio(step1, '');
        if (r.__lf2Pointer) w.setTimeout(function () { go(2); }, 160);
      });
      r.closest('label').addEventListener('pointerup', function () { r.__lf2Pointer = true; w.setTimeout(function () { r.__lf2Pointer = false; }, 400); });
    });
    var zip = form.elements.zip_code;
    if (zip) {
      zip.addEventListener('input', function () { var v = digits(zip.value).slice(0, 5); if (zip.value !== v) zip.value = v; syncZipNotes(); if (zip.getAttribute('aria-invalid') === 'true') checkField(zip); });
      zip.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (validateStep(2)) go(3); } });
    }
    var phone = form.elements.phone;
    if (phone) phone.addEventListener('input', function () { var f = formatPhone(phone.value); if (f !== phone.value && phoneDigits(phone.value).length <= 10) phone.value = f; });
    ['full_name', 'phone', 'email'].forEach(function (k) {
      var el = form.elements[k]; if (!el) return;
      el.addEventListener('blur', function () { if (String(el.value).trim() || el.getAttribute('aria-invalid') === 'true') checkField(el); });
    });
    $$(form, 'input[data-lf2-channel]').forEach(function (b) {
      b.addEventListener('change', function () { checkChannels(); if (form.elements.email) checkField(form.elements.email); });
    });
    // Request acknowledgement rides on the submit button (native no-JS posts the
    // button's name/value). JS posts FormData without the submitter, so mirror it.
    var send = $(form, '[data-lf2-submit]');
    if (send) send.addEventListener('click', function (e) {
      if (!validateStep(3)) { e.preventDefault(); return; }
      if (send.name) setHidden(form, send.name, send.value);
    });
    function syncConversionSuppression() {
      var it = intent();
      if (mode === 'site' && it === 'current-client-review') form.setAttribute('data-lhi-suppress-lead-conversion', 'true');
      else form.removeAttribute('data-lhi-suppress-lead-conversion');
    }

    // Page preselect: <form data-lf2-preselect="medicare"> starts at step 2.
    var pre = form.getAttribute('data-lf2-preselect');
    if (mode === 'site' && pre) {
      var r = $(form, 'input[name="normalized_intent"][value="' + pre + '"]');
      if (r) r.checked = true;
    }
    applyRoute(); syncIntentUI(); syncConversionSuppression();
    go(mode === 'site' && pre ? 2 : (mode !== 'site' && form.getAttribute('data-lf2-skip1') ? 2 : 1), { silent: true });
    form.__lf2go = go;
  }
  function boot() { $$(d, 'form.lf2').forEach(init); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
  w.LHILeadFormV2 = { stateForZip: stateForZip, routes: SITE_ROUTES };
})(window, document);