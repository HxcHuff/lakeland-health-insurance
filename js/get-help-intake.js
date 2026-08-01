(function () {
  'use strict';

  var INTENTS = {
    'under-65': {
      label: 'Individual and Family Coverage',
      content: 'get_help_under_65',
      subject: 'New Lead: Individual and Family Coverage Review',
      line: 'Individual and Family Coverage',
      intro: 'Review individual and family coverage around your current coverage, timing, household information, doctors, prescriptions, and available paths.',
      optional: ['who', 'coverage_end', 'employer_coverage', 'providers', 'prescriptions', 'household_size', 'income', 'referral', 'notes']
    },
    'aca': {
      label: 'ACA / Marketplace',
      content: 'get_help_aca',
      subject: 'New Lead: ACA Marketplace Help',
      line: 'ACA',
      intro: 'Get ACA Marketplace guidance around timing, household size, income estimate, doctors, and next steps.',
      optional: ['who', 'coverage_end', 'providers', 'prescriptions', 'household_size', 'income', 'referral', 'notes']
    },
    'medicare': {
      label: 'Medicare',
      content: 'get_help_medicare',
      subject: 'New Lead: Medicare Review',
      line: 'Medicare',
      intro: 'Get Medicare review help without being routed into an ACA pathway.',
      optional: ['medicare_timing', 'current_plan', 'providers', 'prescriptions', 'referral', 'notes']
    },
    'lost-coverage': {
      label: 'Losing coverage / COBRA',
      content: 'get_help_lost_coverage',
      subject: 'New Lead: Losing Coverage or COBRA Review',
      line: 'ACA',
      intro: 'Review coverage-loss timing, COBRA status, and possible Special Enrollment Period next steps.',
      optional: ['coverage_end', 'cobra_status', 'cobra_premium', 'household_size', 'income', 'providers', 'prescriptions', 'notes']
    },
    'turning-26': {
      label: 'Turning 26',
      content: 'get_help_turning_26',
      subject: 'New Lead: Turning 26 Coverage Review',
      line: 'ACA',
      intro: 'Review coverage timing, employer coverage, student status, ZIP code, income, and household questions without tax advice.',
      optional: ['coverage_end', 'employer_coverage', 'student_status', 'tax_dependency', 'household_size', 'income', 'notes']
    },
    'self-employed': {
      label: 'Self-employed coverage',
      content: 'get_help_self_employed',
      subject: 'New Lead: Self-Employed Coverage Review',
      line: 'ACA',
      intro: 'Compare coverage paths for business owners, contractors, freelancers, and gig workers.',
      optional: ['business_type', 'household_size', 'income', 'providers', 'prescriptions', 'notes']
    },
    'retiring-before-65': {
      label: 'Retiring before 65',
      content: 'get_help_retiring_before_65',
      subject: 'New Lead: Retiring Before 65 Coverage Review',
      line: 'ACA',
      intro: 'Review the transition from employer coverage before Medicare eligibility around timing, household information, doctors, prescriptions, and expected costs.',
      optional: ['coverage_end', 'employer_coverage', 'household_size', 'income', 'providers', 'prescriptions', 'notes']
    },
    'coverage-gap': {
      label: 'Short-term or coverage gap',
      content: 'get_help_coverage_gap',
      subject: 'New Lead: Coverage Gap Review',
      line: 'Coverage gap',
      intro: 'Review short-term, ACA, and supplemental paths accurately for a temporary coverage gap.',
      optional: ['coverage_end', 'primary_concern', 'providers', 'prescriptions', 'notes']
    },
    'supplemental': {
      label: 'Supplemental coverage',
      content: 'get_help_supplemental',
      subject: 'New Lead: Supplemental Coverage Review',
      line: 'Supplemental',
      intro: 'Review supplemental coverage questions alongside your major-medical situation.',
      optional: ['current_plan', 'primary_concern', 'notes']
    },
    'dental-vision': {
      label: 'Dental and vision',
      content: 'get_help_dental_vision',
      subject: 'New Lead: Dental and Vision Review',
      line: 'Dental and vision',
      intro: 'Review dental and vision options based on timing, ZIP code, and current coverage.',
      optional: ['primary_concern', 'notes']
    },
    'current-client-review': {
      label: 'Current-client plan review',
      content: 'get_help_current_client_review',
      subject: 'Current Client Request: Annual Plan Review',
      line: 'Existing client',
      intro: 'Send a service-first review request for renewal, plan-use, household, doctor, prescription, billing, or ID-card issues.',
      optional: ['current_plan', 'coverage_type', 'review_reason', 'providers', 'prescriptions', 'household_changes', 'income_changes', 'upcoming_procedures', 'billing_issue', 'keep_current', 'notes']
    },
    'provider-check': {
      label: 'Provider or prescription check',
      content: 'get_help_provider_check',
      subject: 'New Lead: Provider or Prescription Check',
      line: 'Provider review',
      intro: 'Request a provider, facility, or prescription review. Directories and contracts can change, so final confirmation may require carrier or provider verification.',
      optional: ['provider_name', 'provider_location', 'prescription_name', 'current_plan', 'coverage_type', 'plan_year', 'notes']
    },
    'prescription-check': {
      label: 'Prescription check',
      content: 'get_help_prescription_check',
      subject: 'New Lead: Prescription Coverage Check',
      line: 'Prescription review',
      intro: 'Request a prescription-focused review without sending medication details to advertising platforms.',
      optional: ['prescription_name', 'current_plan', 'coverage_type', 'plan_year', 'notes']
    },
    'employer-referral': {
      label: 'Employer or referral partner',
      content: 'get_help_employer_referral',
      subject: 'Professional Referral: Employee Coverage Transition',
      line: 'Employer referral',
      intro: 'Coordinate a privacy-conscious coverage handoff for employees losing employer-sponsored coverage.',
      optional: ['organization', 'contact_person', 'affected_count', 'coverage_end', 'coordination_method', 'handoff_instructions', 'notes']
    },
    'post-enrollment-review': {
      label: 'Post-enrollment service',
      content: 'get_help_post_enrollment_review',
      subject: 'Client Service Request: Post-Enrollment Review',
      line: 'Existing client',
      intro: 'Ask for help with ID cards, first premium, effective dates, provider confirmation, prescription issues, Marketplace documents, or plan-use questions.',
      optional: ['current_plan', 'service_reason', 'effective_date', 'billing_issue', 'providers', 'prescriptions', 'notes']
    },
    'not-sure': {
      label: 'Not sure',
      content: 'get_help_default',
      subject: 'New Lead: Get Help Request',
      line: 'General',
      intro: 'Start with your need and timing. David can route you to the right coverage path.',
      optional: ['who', 'primary_concern', 'referral', 'notes']
    }
  };

  var DEFAULT_INTENT = 'not-sure';
  var INTENT_OPTIONS = ['under-65', 'aca', 'lost-coverage', 'self-employed', 'medicare', 'coverage-gap', 'supplemental', 'dental-vision', 'current-client-review', 'provider-check', 'not-sure'];
  var QUERY_ALIASES = {
    'individual-family': 'under-65',
    'under-65': 'under-65',
    'under65': 'under-65',
    'pre-medicare': 'under-65',
    'lost-coverage': 'lost-coverage',
    'losing-coverage': 'lost-coverage',
    'losing-medicaid': 'lost-coverage',
    'turning-26': 'turning-26',
    'self-employed': 'self-employed',
    'retiring-before-65': 'retiring-before-65',
    'early-retirement': 'retiring-before-65',
    'current-client-review': 'current-client-review',
    'provider-check': 'provider-check',
    'provider-prescription-check': 'provider-check',
    'prescription-check': 'prescription-check',
    'coverage-gap': 'coverage-gap',
    'employer-referral': 'employer-referral',
    'post-enrollment-review': 'post-enrollment-review',
    'local-answer': 'not-sure',
    'aca': 'aca',
    'medicare': 'medicare'
  };

  var OPTIONAL_FIELDS = {
    who: ['Who needs coverage?', 'text', 'Just me, spouse, children, family'],
    coverage_end: ['Coverage end date', 'date', ''],
    cobra_status: ['COBRA offer status', 'text', 'Offered, not offered, not sure'],
    cobra_premium: ['Estimated COBRA premium', 'text', 'Optional user-provided estimate'],
    providers: ['Doctors or facilities to keep', 'textarea', ''],
    prescriptions: ['Prescriptions to review', 'textarea', ''],
    primary_concern: ['Primary concern', 'text', 'Premium, deductible, network, timing, coverage gap'],
    household_size: ['Household size', 'number', ''],
    income: ['Estimated annual household income', 'text', 'For ACA-related inquiries only'],
    medicare_timing: ['Medicare timing', 'text', 'Turning 65, retiring, already enrolled, moving'],
    referral: ['Referral source', 'text', ''],
    current_plan: ['Current carrier or plan', 'text', ''],
    employer_coverage: ['Employer coverage availability', 'text', ''],
    student_status: ['Student status', 'text', ''],
    tax_dependency: ['Tax dependency question', 'text', 'Confirm tax-household questions with a tax professional'],
    business_type: ['Business type', 'text', 'Owner, contractor, freelancer, gig worker'],
    coverage_type: ['Coverage type', 'text', 'ACA, Medicare, group, short-term, supplemental'],
    review_reason: ['Review reason', 'text', 'Renewal, doctor change, Rx change, household change, billing, ID cards'],
    household_changes: ['Household changes', 'text', ''],
    income_changes: ['Income changes', 'text', ''],
    upcoming_procedures: ['Upcoming procedures', 'text', ''],
    billing_issue: ['Billing or ID-card issue', 'text', ''],
    keep_current: ['Plan preference', 'text', 'Keep my current plan unless a better fit is identified'],
    provider_name: ['Provider or facility name', 'text', ''],
    provider_location: ['Provider location if known', 'text', ''],
    prescription_name: ['Prescription name', 'text', ''],
    plan_year: ['Plan year', 'text', '2026, 2027, not sure'],
    organization: ['Employer or referring organization', 'text', ''],
    contact_person: ['Contact person', 'text', ''],
    affected_count: ['Approximate number of affected employees', 'number', ''],
    coordination_method: ['Preferred coordination method', 'text', ''],
    handoff_instructions: ['Optional employee resource or handoff instructions', 'textarea', ''],
    service_reason: ['Service reason', 'text', 'ID card, first premium, effective date, provider, Rx, documents'],
    effective_date: ['Effective date', 'date', ''],
    notes: ['Additional notes', 'textarea', '']
  };

  function byId(id) { return document.getElementById(id); }

  function normalizeIntent(raw) {
    var key = String(raw || '').trim().toLowerCase();
    return QUERY_ALIASES[key] || DEFAULT_INTENT;
  }

  function qsValue(qs, key) {
    var val = qs.get(key);
    return val ? String(val).slice(0, 120) : '';
  }

  function setValue(id, value) {
    var el = byId(id);
    if (el) el.value = value || '';
  }

  function renderIntentOptions(selectedIntent) {
    var holder = byId('intentOptions');
    if (!holder) return;
    holder.innerHTML = '';
    var options = INTENT_OPTIONS.slice();
    if (options.indexOf(selectedIntent) === -1 && INTENTS[selectedIntent]) options.unshift(selectedIntent);
    options.forEach(function (key) {
      var cfg = INTENTS[key];
      var label = document.createElement('label');
      label.className = 'choice';
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'inquiry_type';
      input.value = cfg.label;
      input.required = true;
      input.dataset.intent = key;
      if (key === selectedIntent) input.checked = true;
      input.addEventListener('change', function () { applyIntent(key); });
      var span = document.createElement('span');
      span.textContent = cfg.label;
      label.append(input, span);
      holder.appendChild(label);
    });
  }

  function renderOptionalFields(intentKey) {
    var holder = byId('optionalFields');
    if (!holder) return;
    holder.innerHTML = '';
    (INTENTS[intentKey].optional || []).forEach(function (fieldKey) {
      var spec = OPTIONAL_FIELDS[fieldKey];
      if (!spec) return;
      var wrap = document.createElement('div');
      wrap.className = spec[1] === 'textarea' ? 'field full' : 'field';
      var label = document.createElement('label');
      var id = 'optional_' + fieldKey;
      label.setAttribute('for', id);
      label.textContent = spec[0];
      var input = spec[1] === 'textarea' ? document.createElement('textarea') : document.createElement('input');
      input.id = id;
      input.name = fieldKey;
      if (spec[1] !== 'textarea') input.type = spec[1];
      if (spec[2]) input.placeholder = spec[2];
      wrap.append(label, input);
      holder.appendChild(wrap);
    });
  }

  function applyIntent(intentKey) {
    var cfg = INTENTS[intentKey] || INTENTS[DEFAULT_INTENT];
    setValue('normalizedIntentInput', intentKey);
    setValue('lineOfBusinessInput', cfg.line);
    setValue('contentNameInput', cfg.content);
    setValue('subjectInput', cfg.subject);
    var form = byId('leadForm');
    if (form) form.setAttribute('data-funnel-name', cfg.content);
    var copy = byId('intent-copy');
    if (copy) copy.textContent = cfg.intro;
    var eyebrow = byId('intent-eyebrow');
    if (eyebrow) eyebrow.textContent = cfg.label;
    renderOptionalFields(intentKey);
  }

  function currentStep() {
    var visible = document.querySelector('.form-step:not([hidden])');
    return visible ? Number(visible.getAttribute('data-step')) : 1;
  }

  function showStep(step) {
    document.querySelectorAll('.form-step').forEach(function (node) {
      node.hidden = Number(node.getAttribute('data-step')) !== step;
    });
    var progress = byId('progressText');
    if (progress) progress.textContent = 'Step ' + step + ' of 3';
    var title = document.querySelector('.form-step[data-step="' + step + '"] h2');
    if (title) title.focus && title.focus();
  }

  function showError(message) {
    var box = byId('errorSummary');
    if (!box) return;
    box.textContent = message;
    box.hidden = !message;
  }

  function validateStep(step) {
    showError('');
    if (step === 1 && !document.querySelector('input[name="inquiry_type"]:checked')) {
      showError('Choose what you need help with.');
      return false;
    }
    if (step === 2 && !document.querySelector('input[name="need_timing"]:checked')) {
      showError('Choose when you need this handled.');
      return false;
    }
    return true;
  }

  function initAttribution() {
    var qs = new URLSearchParams(window.location.search);
    setValue('sourcePageInput', window.location.pathname + window.location.search);
    setValue('referralPageInput', document.referrer || '');
    setValue('productInterestInput', qsValue(qs, 'product'));
    setValue('planInterestInput', qsValue(qs, 'plan'));
    setValue('utmSourceInput', qsValue(qs, 'utm_source'));
    setValue('utmMediumInput', qsValue(qs, 'utm_medium'));
    setValue('utmCampaignInput', qsValue(qs, 'utm_campaign'));
    setValue('utmContentInput', qsValue(qs, 'utm_content'));
    setValue('utmTermInput', qsValue(qs, 'utm_term'));
    setValue('gclidInput', qsValue(qs, 'gclid'));
    setValue('fbclidInput', qsValue(qs, 'fbclid'));
    var startedAt = String(Date.now());
    setValue('startedAtInput', startedAt);
    try { setValue('humanCheckInput', btoa(startedAt + ':lakeland-human')); } catch (e) {}
  }

  function initSubmitState() {
    var form = byId('leadForm');
    var status = byId('formStatus');
    var button = byId('submitButton');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      if (!form.checkValidity()) {
        showError('Complete the required contact fields and consent before sending.');
        return;
      }
      var preferred = String(form.preferred_contact_method && form.preferred_contact_method.value || '').toLowerCase();
      var hasPhone = Boolean(form.phone && String(form.phone.value || '').trim());
      var hasEmail = Boolean(form.email && String(form.email.value || '').trim());
      var callOk = Boolean(form.consent_call && form.consent_call.checked && hasPhone);
      var smsOk = Boolean(form.consent_sms && form.consent_sms.checked && hasPhone);
      var emailOk = Boolean(form.consent_email && form.consent_email.checked && hasEmail);
      var preferredOk =
        (preferred === 'phone call' && callOk) ||
        (preferred === 'text message' && smsOk) ||
        (preferred === 'email' && emailOk) ||
        (preferred === 'first available' && (callOk || smsOk || emailOk));

      if (!preferredOk) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showError('Authorize the preferred contact channel and provide the matching phone number or email address.');
        if (status) status.textContent = '';
        return;
      }
      setValue('consentRequestStateInput', form.consent_request && form.consent_request.checked ? 'granted' : 'not_granted');
      setValue('consentCallStateInput', form.consent_call && form.consent_call.checked ? 'granted' : 'not_granted');
      setValue('consentSmsStateInput', form.consent_sms && form.consent_sms.checked ? 'granted' : 'not_granted');
      setValue('consentEmailStateInput', form.consent_email && form.consent_email.checked ? 'granted' : 'not_granted');
      setValue('consentMarketingEmailStateInput', form.consent_marketing_email && form.consent_marketing_email.checked ? 'granted' : 'not_granted');
      setValue('consentRecordedAtInput', new Date().toISOString());
      if (status) status.textContent = 'Sending your request...';
      if (button) {
        button.disabled = true;
        button.textContent = 'Sending...';
      }
    }, { capture: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initAttribution();
    var selected = normalizeIntent(new URLSearchParams(window.location.search).get('intent'));
    var product = new URLSearchParams(window.location.search).get('product');
    if (product === 'medicare' || product === 'medicare-advantage') selected = 'medicare';
    renderIntentOptions(selected);
    applyIntent(selected);
    showStep(1);

    document.querySelectorAll('[data-next]').forEach(function (button) {
      button.addEventListener('click', function () {
        var step = currentStep();
        if (validateStep(step)) showStep(Math.min(3, step + 1));
      });
    });

    document.querySelectorAll('[data-prev]').forEach(function (button) {
      button.addEventListener('click', function () {
        showError('');
        showStep(Math.max(1, currentStep() - 1));
      });
    });

    initSubmitState();
  });

  window.LHIGetHelpIntake = {
    normalizeIntent: normalizeIntent,
    intents: INTENTS,
    optionalFields: OPTIONAL_FIELDS
  };
})();
