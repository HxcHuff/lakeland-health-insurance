(function () {
  'use strict';

  function $(root, selector) {
    return root.querySelector(selector);
  }

  function $all(root, selector) {
    return Array.prototype.slice.call(root.querySelectorAll(selector));
  }

  function setHidden(form, name, value) {
    var input = form.querySelector('[name="' + name + '"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }
    input.value = value == null ? '' : String(value);
  }

  function track(name, props) {
    if (window.LHI && typeof window.LHI.track === 'function') {
      window.LHI.track(name, props || {});
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name }, props || {}));
  }

  function initForm(form) {
    var steps = $all(form, '.funnel-step');
    if (!steps.length) return;

    var state = {};
    var current = 0;
    var started = false;
    var progress = $(form, '.intent-progress-bar');
    var errorBox = $(form, '[data-error-summary]');
    var startedAt = String(Date.now());

    setHidden(form, 'started_at', startedAt);
    try { setHidden(form, 'human_check', btoa(startedAt + ':lakeland-human')); } catch (e) {}
    setHidden(form, 'source_page', window.location.pathname + window.location.search);
    setHidden(form, 'referral_page', document.referrer || '');

    function formName() {
      return form.getAttribute('data-funnel-name') || form.getAttribute('name') || 'intent_funnel';
    }

    function safeProps(extra) {
      return Object.assign({
        content_name: formName(),
        intent: form.getAttribute('data-intent') || '',
        step_index: current + 1
      }, extra || {});
    }

    function showError(message) {
      if (!errorBox) return;
      errorBox.textContent = message || '';
      errorBox.hidden = !message;
      if (message) errorBox.focus();
    }

    function syncSummary() {
      var parts = [];
      Object.keys(state).forEach(function (key) {
        if (key.indexOf('contact_') === 0) return;
        if (state[key]) parts.push(key + ': ' + state[key]);
        setHidden(form, key, state[key]);
      });
      setHidden(form, 'intent_answer_summary', parts.join(' | '));
    }

    function render() {
      steps.forEach(function (step, index) {
        step.hidden = index !== current;
      });
      if (progress) {
        progress.style.width = Math.round(((current + 1) / steps.length) * 100) + '%';
      }
      showError('');
      var active = steps[current];
      var first = active && active.querySelector('button, input, select, textarea');
      if (first && document.activeElement !== document.body) first.focus();
    }

    function startIfNeeded() {
      if (started) return;
      started = true;
      track('FunnelStart', safeProps());
    }

    function validateStep(step) {
      var required = $all(step, '[data-required="true"], input[required], select[required], textarea[required]');
      for (var i = 0; i < required.length; i++) {
        var el = required[i];
        if (el.type === 'checkbox' && !el.checked) return 'Please confirm the required consent before continuing.';
        if (!String(el.value || '').trim()) return 'Please complete the required field before continuing.';
        if (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)) return 'Please enter a valid email address.';
        if (el.name === 'phone' && String(el.value).replace(/\D/g, '').length < 10) return 'Please enter a reachable phone number.';
        if ((el.name === 'zip' || el.name === 'zip_code') && !/^\d{5}$/.test(el.value)) return 'Please enter a 5-digit ZIP code.';
      }
      return '';
    }

    form.addEventListener('click', function (event) {
      var choice = event.target.closest('[data-choice]');
      if (choice && form.contains(choice)) {
        startIfNeeded();
        var field = choice.getAttribute('data-field');
        var value = choice.getAttribute('data-value') || choice.textContent.trim();
        if (field) {
          state[field] = value;
          $all(form, '[data-choice][data-field="' + field + '"]').forEach(function (btn) {
            btn.setAttribute('aria-pressed', btn === choice ? 'true' : 'false');
          });
          syncSummary();
          track('FunnelStep', safeProps({ step_field: field, step_value: value }));
        }
      }

      var next = event.target.closest('[data-next]');
      if (next && form.contains(next)) {
        event.preventDefault();
        startIfNeeded();
        var step = steps[current];
        var err = validateStep(step);
        if (err) {
          showError(err);
          return;
        }
        $all(step, 'input, select, textarea').forEach(function (el) {
          if (!el.name || el.type === 'hidden') return;
          if (el.type === 'checkbox') state[el.name] = el.checked ? 'yes' : '';
          else state[el.name] = el.value;
        });
        syncSummary();
        track('FunnelStep', safeProps({ step_state: 'complete' }));
        current = Math.min(current + 1, steps.length - 1);
        render();
      }

      var back = event.target.closest('[data-back]');
      if (back && form.contains(back)) {
        event.preventDefault();
        current = Math.max(current - 1, 0);
        render();
      }
    });

    form.addEventListener('submit', function (event) {
      var err = validateStep(steps[current]);
      if (err) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showError(err);
        return;
      }
      $all(form, 'input, select, textarea').forEach(function (el) {
        if (!el.name || el.type === 'hidden') return;
        if (el.type === 'checkbox') state[el.name] = el.checked ? 'yes' : '';
        else state[el.name] = el.value;
      });
      syncSummary();
    }, true);

    render();
  }

  document.addEventListener('DOMContentLoaded', function () {
    $all(document, 'form[data-intent-form]').forEach(initForm);
  });
})();
