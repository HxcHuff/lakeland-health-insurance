(function () {
  const profileUrl =
    'https://www.bbb.org/us/fl/lakeland/profile/health-insurance/lakeland-health-insurance-0733-235981531/';

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
        text-align: center;
      }

      .footer-grid + .bbb-footer-trust {
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding-top: 2rem;
      }

      .bbb-footer-copy {
        color: inherit;
        line-height: 1.45;
        max-width: 520px;
      }

      .bbb-footer-copy span {
        display: block;
        font-size: 0.86rem;
        margin-top: 0.45rem;
        opacity: 0.72;
      }

      .bbb-footer-copy a.bbb-profile-link {
        color: var(--gold, #D4A843);
        display: inline-block;
        font-size: 0.95rem;
        font-weight: 700;
        text-decoration: none;
        transition: color 0.3s ease;
      }

      .bbb-footer-copy a.bbb-profile-link:hover,
      .bbb-footer-copy a.bbb-profile-link:focus-visible {
        color: var(--gold-soft, #F5ECD7);
        text-decoration: underline;
      }

      .bbb-footer-copy a.bbb-profile-link:focus-visible {
        outline: 2px solid var(--gold-soft, #F5ECD7);
        outline-offset: 3px;
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

    const copy = document.createElement('div');
    copy.className = 'bbb-footer-copy';
    copy.innerHTML = `
      <a class="bbb-profile-link" href="${profileUrl}" target="_blank" rel="nofollow noopener noreferrer">View the BBB business profile &rarr;</a>
      <span>Accreditation, rating, and profile details can change outside this site.</span>
    `;

    wrapper.append(copy);
    return wrapper;
  }

  function mount() {
    if (document.querySelector('.bbb-footer-trust')) return;

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
