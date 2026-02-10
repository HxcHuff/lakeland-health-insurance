(function () {
  function addDisclosureStrip() {
    var footer = document.querySelector('footer');
    if (!footer || footer.querySelector('.compliance-strip')) return;

    var strip = document.createElement('div');
    strip.className = 'compliance-strip';
    strip.style.marginTop = '1rem';
    strip.style.padding = '0.75rem 1rem';
    strip.style.borderRadius = '10px';
    strip.style.background = 'rgba(255,255,255,0.08)';
    strip.style.border = '1px solid rgba(255,255,255,0.15)';
    strip.style.fontSize = '0.78rem';
    strip.style.lineHeight = '1.5';
    strip.style.opacity = '0.95';

    strip.innerHTML = [
      '<p>Not affiliated with the U.S. government or the federal Marketplace.</p>',
      '<p>We do not offer every plan available in your area.</p>',
      '<p>By providing my phone/email, I consent to be contacted (call/text/email) regarding insurance options. Msg & data rates may apply.</p>'
    ].join('');

    var footerBottom = footer.querySelector('.footer-bottom') || footer.querySelector('.container') || footer;
    footerBottom.appendChild(strip);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addDisclosureStrip);
  } else {
    addDisclosureStrip();
  }
})();
