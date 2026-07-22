// Shared floating actions for blog pages.
// Adds a phone CTA only when a page has not already defined one.
(function () {
  if (window.__LHI_BLOG_FLOATING_ACTIONS_LOADED__) return;
  window.__LHI_BLOG_FLOATING_ACTIONS_LOADED__ = true;

  function hasFloatingCall() {
    return document.querySelector('.click-to-call, .lhi-floating-call, [data-floating-call]') !== null;
  }

  function trackCall() {
    if (typeof window.trackPhoneCall === 'function') {
      try { window.trackPhoneCall(); } catch (e) {}
    }
    if (typeof window.gtag === 'function') {
      try {
        window.gtag('event', 'phone_call', {
          event_category: 'blog_floating_cta',
          event_label: 'call_david_now'
        });
      } catch (e) {}
    }
  }

  function addStyles() {
    if (document.getElementById('lhi-blog-floating-actions-style')) return;
    var style = document.createElement('style');
    style.id = 'lhi-blog-floating-actions-style';
    style.textContent =
      '.lhi-floating-call{position:fixed;bottom:20px;right:20px;z-index:1500;background:linear-gradient(135deg,#16A34A,#059669);color:#fff;padding:15px 20px;border-radius:999px;text-decoration:none;font-weight:700;font-size:1rem;box-shadow:0 8px 25px rgba(22,163,74,.4);display:flex;align-items:center;gap:8px;transition:all .3s ease;font-family:DM Sans,-apple-system,BlinkMacSystemFont,sans-serif}' +
      '.lhi-floating-call:hover{transform:translateY(-3px);box-shadow:0 12px 35px rgba(22,163,74,.55)}' +
      '@media(max-width:768px){.lhi-floating-call{bottom:15px;right:15px;padding:12px 15px;font-size:.9rem}}';
    document.head.appendChild(style);
  }

  function addCallButton() {
    if (hasFloatingCall()) return;
    addStyles();

    var link = document.createElement('a');
    link.href = 'tel:+18636403102';
    link.className = 'lhi-floating-call';
    link.setAttribute('data-floating-call', 'true');
    link.setAttribute('aria-label', 'Call David now at 863-640-3102');
    link.innerHTML = '<span aria-hidden="true">&#128222;</span><span>Call David Now</span>';
    link.addEventListener('click', trackCall);
    document.body.appendChild(link);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addCallButton);
  } else {
    addCallButton();
  }
})();
