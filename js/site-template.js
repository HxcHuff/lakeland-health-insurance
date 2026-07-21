(function () {
  const phone = '863-640-3102';
  const phoneDisplay = '(863) 640-3102';
  const phoneHref = 'tel:+18636403102';
  const messengerHref = 'https://m.me/2330958066941437';

  const navLinks = [
    ['/', 'Home'],
    ['/plans/', 'Health Plans'],
    ['/carriers/', 'Carriers'],
    ['/medicare/', 'Medicare'],
    ['/blog/', 'Blog'],
    ['/about/', 'About'],
    ['/learning/', 'Learn'],
    ['/get-help/', 'Get Help']
  ];

  const menuLinks = [
    ['/', 'Home'],
    ['/plans/', 'Health Plans'],
    ['/carriers/', 'Carriers'],
    ['/get-help/', 'Get Help'],
    ['/blog/', 'Blog'],
    ['/about/', 'About'],
    ['/learning/', 'Learn'],
    ['/calendly-book.html', 'Book a Call'],
    [phoneHref, 'Call Now']
  ];

  function createHeader() {
    const header = document.createElement('header');
    header.innerHTML = `
      <nav class="container">
        <div class="logo-container">
          <a class="brand-name" href="/">
            Lakeland Health Insurance
            <span class="license-tag">Licensed FL Broker #W371813</span>
          </a>
          <button class="menu-button" type="button" aria-label="Toggle navigation menu" aria-expanded="false">
            <div class="ellipses" aria-hidden="true">
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
          </button>
          <div class="dropdown-menu" id="dropdownMenu">
            ${menuLinks.map(([href, label]) => `<div class="menu-item"><a href="${href}">${label}</a></div>`).join('')}
          </div>
        </div>
        <ul class="nav-links">
          ${navLinks.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('')}
        </ul>
        <div class="cta-group">
          <a href="/get-help/" class="cta-button">Talk to David</a>
        </div>
      </nav>`;
    return header;
  }

  function createComplianceBanner() {
    const banner = document.createElement('div');
    const bannerFocus = document.querySelector('meta[name="lhi-banner-focus"]')?.getAttribute('content');
    banner.className = 'compliance-banner';
    if (bannerFocus === 'medicare') {
      banner.innerHTML = `<strong>Medicare questions?</strong> Call <a href="${phoneHref}">${phoneDisplay}</a> or <a href="/lp/medicare/">start a Medicare review</a>. FL Broker License #W371813`;
    } else {
      banner.innerHTML = `<strong>Insurance questions?</strong> Call <a href="${phoneHref}">${phoneDisplay}</a> or <a href="/get-help/">start a free plan review</a>. FL Broker License #W371813`;
    }
    return banner;
  }

  function createFooter() {
    const footer = document.createElement('footer');
    footer.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div class="footer-column">
            <h3>Contact David</h3>
            <ul>
              <li><a href="${phoneHref}"><span aria-hidden="true">&#128222;</span> ${phoneDisplay}</a></li>
              <li><a href="mailto:dhuff@healthmarkets.com"><span aria-hidden="true">&#128231;</span> dhuff@healthmarkets.com</a></li>
              <li><a href="${messengerHref}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">&#128172;</span> David the Insurance Dude</a></li>
              <li><span aria-hidden="true">&#128205;</span> Central Florida Headquarters</li>
              <li><span aria-hidden="true">&#9200;</span> Mon-Fri 8AM-8PM EST</li>
              <li><span aria-hidden="true">&#9200;</span> Sat 9AM-5PM EST</li>
            </ul>
          </div>
          <div class="footer-column">
            <h3>Service Areas</h3>
            <ul>
              <li>Florida Residents</li>
              <li>Coverage Across the Nation</li>
              <li>Small Business Groups</li>
              <li>Individual & Family Plans</li>
              <li>Medicare Specialists</li>
            </ul>
          </div>
          <div class="footer-column">
            <h3>Quick Links</h3>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/plans/">Insurance Plans</a></li>
              <li><a href="/health-protector-guard/">Health Protector Guard</a></li>
              <li><a href="https://www.healthsherpa.com/?_agent_id=david-huff-ngdu8q" target="_blank" rel="noopener noreferrer">Self-Service ACA Quote</a></li>
              <li><a href="/blog/">Blog</a></li>
              <li><a href="/our-approach.html">Our Approach</a></li>
              <li><a href="/blog/florida-insurance-guide.html">Florida Health Insurance Guide</a></li>
              <li><a href="/get-help/">Start Free Plan Review</a></li>
              <li><a href="/privacy-policy.html">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <p>&copy; <span data-current-year></span> Lakeland Health Insurance. Licensed insurance agency serving families and businesses across the nation.</p>
          <p>FL License #W371813 | NPN 18213932 | Serving most of the United States with honest insurance advice</p>
          <p style="margin-top: 1rem;"><a href="https://www.facebook.com/HealthMarkets.David.Huff" target="_blank" rel="noopener noreferrer">Powered by David the Insurance Dude</a></p>
        </div>
      </div>`;
    return footer;
  }

  function createFloatingActions() {
    const wrapper = document.createDocumentFragment();
    const messenger = document.createElement('a');
    messenger.href = messengerHref;
    messenger.className = 'messenger-button';
    messenger.target = '_blank';
    messenger.rel = 'noopener noreferrer';
    messenger.setAttribute('aria-label', 'Message David on Messenger');
    messenger.innerHTML = `
      <span class="messenger-icon" aria-hidden="true">&#128172;</span>
      <div style="display:flex;flex-direction:column;align-items:center;">
        <span>Message David</span>
        <span style="font-size:0.8rem;opacity:0.9;">Usually replies fast</span>
      </div>`;

    const call = document.createElement('a');
    call.href = phoneHref;
    call.className = 'click-to-call';
    call.innerHTML = `
      <span class="phone-icon" aria-hidden="true">&#128222;</span>
      <div style="display:flex;flex-direction:column;align-items:center;">
        <span>Call: ${phoneDisplay}</span>
        <span style="font-size:0.8rem;opacity:0.9;">David answers personally</span>
      </div>`;

    wrapper.append(messenger, call);
    return wrapper;
  }

  function removeOldFloatingActions() {
    document.querySelectorAll('.click-to-call, .messenger-button, .chat-widget-button').forEach((node) => node.remove());
  }

  function wireMenu() {
    const menu = document.getElementById('dropdownMenu');
    const button = document.querySelector('.menu-button');
    if (!menu || !button) return;

    button.addEventListener('click', function (event) {
      event.stopPropagation();
      const isOpen = menu.classList.toggle('show');
      button.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', function (event) {
      if (!menu.contains(event.target) && !button.contains(event.target)) {
        menu.classList.remove('show');
        button.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function normalizeTemplate() {
    document.querySelectorAll('.compliance-banner').forEach((node) => node.remove());
    const firstHeader = document.querySelector('header');
    if (firstHeader) {
      firstHeader.replaceWith(createHeader());
    } else {
      document.body.prepend(createHeader());
    }
    document.body.prepend(createComplianceBanner());

    const lastFooter = document.querySelector('footer');
    if (lastFooter) {
      lastFooter.replaceWith(createFooter());
    } else {
      document.body.append(createFooter());
    }

    removeOldFloatingActions();
    document.body.append(createFloatingActions());

    document.querySelectorAll('#current-year, [data-current-year]').forEach((node) => {
      node.textContent = new Date().getFullYear();
    });

    wireMenu();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalizeTemplate);
  } else {
    normalizeTemplate();
  }
})();
