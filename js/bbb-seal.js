(function () {
  const profileUrl = 'https://www.bbb.org/us/fl/lakeland/profile/health-insurance/lakeland-health-insurance-0733-235981531/#sealclick';
  const sealImageUrl = 'https://seal-centralflorida.bbb.org/logo/ruvtbul/bbb-235981531.png';

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
        color: #005A78;
        display: block;
        flex: 0 0 auto;
        margin: 0;
        overflow: hidden;
        padding: 0;
        position: relative;
        text-align: center;
        text-decoration: none;
      }

      .bbb-footer-trust a#bbblink.ruvtbul {
        height: 144px;
        width: 80px;
      }

      .bbb-footer-trust a#bbblink img {
        border: 0;
        left: 0;
        margin-left: 0;
        max-width: 200%;
        position: absolute;
        top: 0;
      }

      .bbb-footer-trust a#bbblink.ruvtbul:hover img {
        margin-left: -80px;
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
    link.className = 'ruvtbul';
    link.target = '_blank';
    link.rel = 'nofollow noopener noreferrer';
    link.setAttribute('aria-label', 'View Lakeland Health Insurance BBB Business Profile');

    const img = document.createElement('img');
    img.src = sealImageUrl;
    img.alt = 'Lakeland Health Insurance BBB Business Review';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.style.border = '0';
    link.append(img);

    const copy = document.createElement('div');
    copy.className = 'bbb-footer-copy';
    copy.innerHTML = `
      <strong>BBB Accredited Business with an A- rating</strong>
      <span>Active Florida LLC since 2021. BBB Accredited since May 26, 2026.</span>
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
