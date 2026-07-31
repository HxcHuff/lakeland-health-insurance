(function () {
  'use strict';

  var form = document.getElementById('coverageRouter');
  var result = document.getElementById('routerResult');
  if (!form || !result) return;

  function link(href, label, external) {
    var attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return '<a class="btn secondary" href="' + href + '"' + attrs + '>' + label + '</a>';
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var zip = String(form.router_zip.value || '').trim();
    var coverage = String(form.router_coverage.value || '');

    if (!/^\d{5}$/.test(zip) || !coverage) {
      result.innerHTML = '<strong>Check the form.</strong> Enter a five-digit ZIP code and choose a coverage type.';
      result.hidden = false;
      result.focus({ preventScroll: true });
      return;
    }

    var prefix = Number(zip.slice(0, 3));
    if (prefix < 320 || prefix > 349) {
      result.innerHTML = '<strong>This router is limited to Florida.</strong><p>Use an official destination while licensing and product availability are verified.</p><div class="cta-row">' +
        link('https://www.healthcare.gov/', 'HealthCare.gov', true) +
        link('https://www.medicare.gov/', 'Medicare.gov', true) +
        '</div>';
      result.hidden = false;
      result.focus({ preventScroll: true });
      return;
    }

    if (coverage === 'aca') {
      result.innerHTML = '<strong>Florida ACA pathway</strong><p>Review eligibility and timing first. The self-service link opens a third-party enrollment platform.</p><div class="cta-row">' +
        link('/aca-health-insurance-lakeland-fl/', 'Review Florida ACA guidance', false) +
        link('/get-help/?intent=aca', 'Ask David for help', false) +
        link('https://www.healthsherpa.com/?_agent_id=david-huff-ngdu8q', 'Open self-service ACA quote', true) +
        '</div>';
    } else if (coverage === 'medicare') {
      result.innerHTML = '<strong>Florida Medicare pathway</strong><p>Confirm the enrollment period, providers, prescriptions, pharmacy, and exact plan year before making a change.</p><div class="cta-row">' +
        link('/medicare/', 'Review Medicare guidance', false) +
        link('/get-help/?intent=medicare', 'Ask David for help', false) +
        link('https://www.medicare.gov/plan-compare/', 'Medicare.gov Plan Compare', true) +
        '</div>';
    } else {
      result.innerHTML = '<strong>Florida licensed review pathway</strong><p>Availability, underwriting, exclusions, and benefits must be confirmed before any external application.</p><div class="cta-row">' +
        link('/plans/', 'Review coverage paths', false) +
        link('/get-help/', 'Ask David for help', false) +
        '</div>';
    }
    result.hidden = false;
    result.focus({ preventScroll: true });
  });
})();
