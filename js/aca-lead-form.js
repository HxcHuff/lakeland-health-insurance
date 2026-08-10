(function () {
  'use strict';

  function init() {
    var form = document.getElementById('aca-lead-form');
    if (!form || form.dataset.enhanced === 'true') return;

    var phoneField = form.querySelector('[data-contact-field="phone"]');
    var emailField = form.querySelector('[data-contact-field="email"]');
    var phoneInput = form.elements.phone;
    var emailInput = form.elements.email;
    var callConsent = form.querySelector('[data-channel-consent="call"]');
    var smsConsent = form.querySelector('[data-channel-consent="sms"]');
    var emailConsent = form.querySelector('[data-channel-consent="email"]');
    var steps = Array.prototype.slice.call(form.querySelectorAll('[data-form-step]'));
    var progress = document.getElementById('aca-form-progress');
    var progressText = progress ? progress.firstElementChild : null;
    var status = document.getElementById('aca-form-status');
    var stepCount = steps.length;
    var currentStep = 1;

    form.dataset.enhanced = 'true';
    form.classList.add('is-enhanced');

    function setHidden(name, value) {
      var field = form.elements[name];
      if (field) field.value = value || '';
    }

    function selectedMethod() {
      var selected = form.querySelector('input[name="preferred_contact_method"]:checked');
      return selected ? selected.value : 'Phone call';
    }

    function setConsentControl(container, input, active) {
      if (container) container.hidden = !active;
      if (!input) return;
      input.required = active;
      input.disabled = !active;
      if (!active) input.checked = false;
    }

    function setChannelState() {
      var method = selectedMethod();
      var useCall = method === 'Phone call';
      var useText = method === 'Text message';
      var useEmail = method === 'Email';

      if (phoneField) phoneField.hidden = useEmail;
      if (emailField) emailField.hidden = !useEmail;
      if (phoneInput) {
        phoneInput.required = !useEmail;
        phoneInput.disabled = useEmail;
      }
      if (emailInput) {
        emailInput.required = useEmail;
        emailInput.disabled = !useEmail;
      }

      setConsentControl(callConsent, form.elements.consent_call, useCall);
      setConsentControl(smsConsent, form.elements.consent_sms, useText);
      setConsentControl(emailConsent, form.elements.consent_email, useEmail);
      captureConsentState();
    }

    function captureConsentState() {
      setHidden('consent_recorded_at', new Date().toISOString());
      setHidden('consent_request_state', form.elements.consent_request && form.elements.consent_request.checked ? 'granted' : 'not_granted');
      setHidden('consent_call_state', form.elements.consent_call && form.elements.consent_call.checked ? 'granted' : 'not_granted');
      setHidden('consent_sms_state', form.elements.consent_sms && form.elements.consent_sms.checked ? 'granted' : 'not_granted');
      setHidden('consent_email_state', form.elements.consent_email && form.elements.consent_email.checked ? 'granted' : 'not_granted');
    }

    function stepNode(stepNumber) {
      return form.querySelector('[data-form-step="' + stepNumber + '"]');
    }

    function stepName(stepNumber) {
      var step = stepNode(stepNumber);
      return step ? (step.getAttribute('data-step-name') || 'step_' + stepNumber) : 'step_' + stepNumber;
    }

    function emitStepDiagnostic(stepNumber) {
      if (!window.LHI || typeof window.LHI.track !== 'function') return;
      window.LHI.track('LeadStep', {
        step_number: stepNumber,
        step_name: stepName(stepNumber)
      });
    }

    function validateStep(stepNumber) {
      var step = stepNode(stepNumber);
      if (!step) return false;
      var fields = Array.prototype.slice.call(step.querySelectorAll('input, select, textarea'));
      for (var i = 0; i < fields.length; i += 1) {
        if (fields[i].disabled || !fields[i].required) continue;
        if (!fields[i].checkValidity()) {
          fields[i].reportValidity();
          return false;
        }
      }
      return true;
    }

    function showStep(stepNumber, shouldFocus) {
      currentStep = Math.max(1, Math.min(stepCount, stepNumber));
      steps.forEach(function (step) {
        step.hidden = Number(step.getAttribute('data-form-step')) !== currentStep;
      });

      if (progressText) progressText.textContent = 'Step ' + currentStep + ' of ' + stepCount;
      if (progress) progress.setAttribute('aria-valuenow', String(currentStep));
      form.style.setProperty('--lp-progress', ((currentStep / stepCount) * 100) + '%');
      emitStepDiagnostic(currentStep);

      if (!shouldFocus) return;
      var activeStep = stepNode(currentStep);
      var focusTarget = activeStep && activeStep.querySelector('input:not([type="hidden"]), select, button');
      if (!focusTarget) return;
      try {
        focusTarget.focus({ preventScroll: true });
      } catch (error) {
        focusTarget.focus();
      }
    }

    function moveForward() {
      if (!validateStep(currentStep)) return;
      showStep(currentStep + 1, true);
    }

    var params = new URLSearchParams(window.location.search);
    [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'gclid',
      'gbraid',
      'wbraid',
      'gad_source',
      'gad_campaignid'
    ].forEach(function (name) {
      setHidden(name, String(params.get(name) || '').slice(0, 250));
    });

    var startedAt = String(Date.now());
    setHidden('started_at', startedAt);
    try {
      setHidden('human_check', btoa(startedAt + ':lakeland-human'));
    } catch (error) {}

    form.querySelectorAll('input[name="preferred_contact_method"]').forEach(function (radio) {
      radio.addEventListener('change', setChannelState);
    });

    form.querySelectorAll('input[type="checkbox"][name^="consent_"]').forEach(function (checkbox) {
      checkbox.addEventListener('change', captureConsentState);
    });

    form.querySelectorAll('[data-form-next]').forEach(function (button) {
      button.addEventListener('click', moveForward);
    });

    form.querySelectorAll('[data-form-back]').forEach(function (button) {
      button.addEventListener('click', function () {
        showStep(currentStep - 1, true);
      });
    });

    form.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || currentStep >= stepCount || event.target.tagName !== 'INPUT') return;
      if (event.target.type === 'radio' || event.target.type === 'checkbox') return;
      event.preventDefault();
      moveForward();
    });

    form.addEventListener('submit', function () {
      if (!form.checkValidity()) return;
      captureConsentState();
      if (status) status.textContent = 'Sending your request…';
    }, { capture: true });

    setChannelState();
    showStep(1, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
