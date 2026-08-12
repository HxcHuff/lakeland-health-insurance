(function () {
  const profileUrl = 'https://www.bbb.org/us/fl/lakeland/profile/health-insurance/lakeland-health-insurance-0733-235981531/#sealclick';
  function ensureStyles() {
    if (document.getElementById('lhi-bbb-seal-styles')) return;

    const style = document.createElement('style');
    style.id = 'lhi-bbb-seal-styles';
    style.textContent = `
      .bbb-footer-trust {
        align-items: center;
        display: flex;
        gap: 1rem;
        justify-content: center;
        margin: 0 0 2rem;
        padding: 1.25rem 0;
        text-align: left;
      }

      .footer-grid + .bbb-footer-trust {
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding-top: 2rem;
      }

      .bbb-footer-trust a#bbblink {
        background: #fff;
        border: 2px solid #005a78;
        border-radius: 8px;
        color: #005a78;
        display: inline-flex;
        flex: 0 0 auto;
        font-size: 0.82rem;
        font-weight: 700;
        line-height: 1.25;
        margin: 0;
        max-width: 150px;
        min-height: 72px;
        padding: 0.75rem;
        text-align: center;
        text-decoration: none;
        align-items: center;
      }

      .bbb-footer-trust a#bbblink:hover,
      .bbb-footer-trust a#bbblink:focus-visible {
        background: #e8f6fa;
        text-decoration: underline;
      }

      .bbb-footer-copy {
        color: inherit;
        line-height: 1.45;
        max-width: 520px;
      }

      .bbb-footer-copy strong,
      .bbb-footer-copy span {
        display: block;
      }

      .bbb-footer-copy strong {
        font-size: 0.95rem;
      }

      .bbb-footer-copy span {
        font-size: 0.86rem;
        opacity: 0.72;
      }

      @media (max-width: 560px) {
        .bbb-footer-trust {
          flex-direction: column;
          text-align: center;
        }
      }
    `;
    document.head.append(style);
  }

  function createSealBlock() {
    const wrapper = document.createElement('div');
    wrapper.className = 'bbb-footer-trust';

    const link = document.createElement('a');
    link.href = profileUrl;
    link.id = 'bbblink';
    link.target = '_blank';
    link.rel = 'nofollow noopener noreferrer';
    link.setAttribute('aria-label', 'View Lakeland Health Insurance BBB Business Profile');

    link.textContent = 'View current BBB business profile';

    const copy = document.createElement('div');
    copy.className = 'bbb-footer-copy';
    copy.innerHTML = `
      <strong>Review the current BBB business profile</strong>
      <span>Accreditation, rating, and profile details can change outside this site.</span>
    `;

    wrapper.append(link, copy);
    return wrapper;
  }

  function mount() {
    if (document.getElementById('bbblink')) return;

    const footer = document.querySelector('footer');
    if (!footer) return;

    ensureStyles();
    const sealBlock = createSealBlock();
    const footerBottom = footer.querySelector('.footer-bottom');

    if (footerBottom && footerBottom.parentNode) {
      footerBottom.parentNode.insertBefore(sealBlock, footerBottom);
    } else {
      footer.append(sealBlock);
    }
  }

  window.LHIBbbSeal = { mount };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
