(function () {
  const phone = '863-640-3102';
  const phoneDisplay = '(863) 640-3102';
  const phoneHref = 'tel:+18636403102';
  const messengerHref = 'https://m.me/2330958066941437';
  const tpmoDisclaimer = 'We do not offer every plan available in your area. Currently we represent 10 organizations which offer 73 products in your area. Please contact Medicare.gov or 1-800-MEDICARE to get information on all of your options.';
  const healthSherpaHref = 'https://www.healthsherpa.com/?_agent_id=david-huff-ngdu8q';
  const BANNER_STORAGE_KEY = 'lhi-seasonal-banner-2026-aep-v1';
  const BANNER_ID = 'lhi-seasonal-banner';
  const SEASONAL_BANNER_TIMEZONE = 'America/New_York';
  const SEASONAL_BANNER_START_MONTH = 10;
  const SEASONAL_BANNER_START_DAY = 1;
  const SEASONAL_BANNER_END_MONTH = 12;
  const SEASONAL_BANNER_END_DAY = 7;

  const MEDICARE_PATHS = [
    '/medicare/',
    '/medicare/east-polk/',
    '/medicare-broker-lakeland-fl/',
    '/moving-florida-medicare/',
    '/working-past-65-medicare-lakeland-fl/',
    '/local-health-insurance-answers/medicare-plan-help-lakeland/',
    '/lp/medicare/',
    '/blog/aep-',
    '/blog/medigap-',
    '/blog/florida-insurance-guide.html'
  ];

  const UNDER65_PATHS = [
    '/aca-health-insurance-lakeland-fl/',
    '/aca-health-insurance-agent-polk-county-fl/',
    '/aca-subsidy-estimator/',
    '/self-employed-health-insurance/',
    '/turning-26/',
    '/retiring-before-65-florida/',
    '/brandon-health-insurance/',
    '/clearwater-health-insurance/',
    '/davenport-health-insurance/',
    '/haines-city-health-insurance/',
    '/lake-alfred-health-insurance/',
    '/largo-health-insurance/',
    '/new-port-richey-health-insurance/',
    '/riverview-health-insurance/',
    '/st-petersburg-health-insurance/',
    '/tampa-health-insurance/',
    '/wesley-chapel-health-insurance/',
    '/winter-haven-health-insurance/'
  ];

  const LOSING_COVERAGE_PATHS = [
    '/losing-coverage/',
    '/losing-medicaid-florida/'
  ];

  function currentPathname() {
    try {
      return String(window.location.pathname || '/');
    } catch (error) {
      return '/';
    }
  }

  function rawPath(pathname) {
    return String(pathname || '/').split(/[?#]/, 1)[0] || '/';
  }

  function normalizePath(pathname) {
    var path = rawPath(pathname);
    if (!path) return '/';
    if (path.length > 1 && path.charAt(path.length - 1) !== '/') {
      if (!/\.[a-z0-9]+$/i.test(path)) path += '/';
    }
    return path;
  }

  function pathMatches(pathname, prefixes) {
    var path = normalizePath(pathname);
    var raw = rawPath(pathname);
    return prefixes.some(function (prefix) {
      var needle = String(prefix || '');
      if (!needle) return false;
      if (needle.charAt(needle.length - 1) === '-') {
        return raw.indexOf(needle) === 0 || path.indexOf(needle) === 0;
      }
      needle = normalizePath(needle);
      return path === needle || path.indexOf(needle) === 0;
    });
  }

  function pathLooksLikeMedicare(pathname) {
    var path = normalizePath(pathname);
    var raw = rawPath(pathname);
    if (pathMatches(path, MEDICARE_PATHS) || pathMatches(raw, MEDICARE_PATHS)) return true;
    if (/\/blog\/[^"'<>]*medicare/i.test(raw) || /\/blog\/[^"'<>]*medicare/i.test(path)) return true;
    if (/advantage/i.test(raw) && raw.indexOf('/advantage-guard') !== 0) return true;
    return false;
  }

  function readQueryIntent(search) {
    var raw = search;
    if (raw == null) {
      try {
        raw = window.location.search || '';
      } catch (error) {
        raw = '';
      }
    }
    var query = String(raw || '');
    if (query.charAt(0) === '?') query = query.slice(1);
    if (!query) return '';
    var pairs = query.split('&');
    for (var i = 0; i < pairs.length; i += 1) {
      var parts = pairs[i].split('=');
      var key = decodeURIComponent(parts[0] || '').trim().toLowerCase();
      if (key !== 'intent') continue;
      var value = decodeURIComponent((parts[1] || '').replace(/\+/g, ' ')).trim().toLowerCase();
      if (value === 'medicare' || value === 'under-65' || value === 'losing-coverage') return value;
    }
    return '';
  }

  function easternDateParts(date) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: SEASONAL_BANNER_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date || new Date());
    var out = {};
    for (var i = 0; i < parts.length; i += 1) {
      if (parts[i].type !== 'literal') out[parts[i].type] = parts[i].value;
    }
    return {
      year: Number(out.year),
      month: Number(out.month),
      day: Number(out.day)
    };
  }

  function isWithinSeasonalBannerWindow(now) {
    var parts = easternDateParts(now || new Date());
    var start = (SEASONAL_BANNER_START_MONTH * 100) + SEASONAL_BANNER_START_DAY;
    var end = (SEASONAL_BANNER_END_MONTH * 100) + SEASONAL_BANNER_END_DAY;
    var key = (parts.month * 100) + parts.day;
    return key >= start && key <= end;
  }

  function readIntentOverride(doc) {
    var root = doc || document;
    var meta = root.querySelector('meta[name="lhi-chrome-intent"]');
    if (meta && meta.getAttribute('content')) return String(meta.getAttribute('content')).trim().toLowerCase();
    var body = root.body;
    if (body && body.getAttribute('data-chrome-intent')) {
      return String(body.getAttribute('data-chrome-intent')).trim().toLowerCase();
    }
    return '';
  }

  function resolveChromeIntent(pathname, doc, search) {
    var override = readIntentOverride(doc);
    if (override === 'medicare' || override === 'under-65' || override === 'losing-coverage') {
      return override;
    }
    var path = normalizePath(pathname || currentPathname());
    if (pathLooksLikeMedicare(pathname || path)) return 'medicare';
    if (pathMatches(path, LOSING_COVERAGE_PATHS)) return 'losing-coverage';
    if (pathMatches(path, UNDER65_PATHS)) return 'under-65';
    return readQueryIntent(search);
  }

  function chromeGetHelpHref(intent) {
    if (intent === 'medicare') return '/get-help/?intent=medicare';
    if (intent === 'under-65') return '/get-help/?intent=under-65';
    if (intent === 'losing-coverage') return '/get-help/?intent=losing-coverage';
    return '/get-help/';
  }

  function shouldShowHealthSherpa(pathname, intent) {
    var path = normalizePath(pathname || currentPathname());
    if (path.indexOf('/lp/') === 0) return false;
    if (intent === 'medicare') return false;
    return true;
  }

  function shouldShowSeasonalBanner(pathname, options) {
    var opts = options || {};
    if (!isWithinSeasonalBannerWindow(opts.now)) return false;
    var path = normalizePath(pathname || currentPathname());
    if (path.indexOf('/lp/') === 0) return false;
    try {
      if (window.localStorage && window.localStorage.getItem(BANNER_STORAGE_KEY) === 'dismissed') {
        return false;
      }
    } catch (error) {
      // localStorage can be blocked; still evaluate path/intent rules.
    }
    if (path === '/' || path === '/coverage-center/') return true;
    var intent = opts.intent;
    if (intent == null) {
      intent = resolveChromeIntent(pathname, opts.doc, opts.search);
    }
    return intent === 'medicare';
  }

  const navLinks = [
    ['/aca-health-insurance-lakeland-fl/', 'Individual and Family Coverage'],
    ['/medicare/', 'Medicare'],
    ['/plans/', 'Coverage Options'],
    ['/carriers/', 'Carriers'],
    ['/blog/', 'Blog'],
    ['/learning/', 'Learn'],
    ['/about/', 'About']
  ];

  function createHeader(intent) {
    var helpHref = chromeGetHelpHref(intent);
    var menuLinks = [
      ['/', 'Home'],
      ['/aca-health-insurance-lakeland-fl/', 'Individual and Family Coverage'],
      ['/medicare/', 'Medicare'],
      ['/plans/', 'Coverage Options'],
      ['/carriers/', 'Carriers'],
      ['/blog/', 'Blog'],
      ['/learning/', 'Learn'],
      ['/about/', 'About'],
      [helpHref, 'Get Help'],
      ['/calendly-book.html', 'Book a Call'],
      [phoneHref, 'Call Now']
    ];
    const header = document.createElement('header');
    header.innerHTML = `
      <nav class="container">
        <div class="logo-container">
          <a class="brand-name" href="/">
            Lakeland Health Insurance
            <span class="license-tag">Licensed FL health agent #W371813</span>
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
          <a href="${helpHref}" class="cta-button">Request a plan review</a>
        </div>
      </nav>`;
    return header;
  }

  function createFooter(intent, pathname) {
    var helpHref = chromeGetHelpHref(intent);
    var showHealthSherpa = shouldShowHealthSherpa(pathname, intent);
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
              <li><span aria-hidden="true">&#128205;</span> Lakeland Health Insurance · Lakeland, FL 33805 · By appointment</li>
            </ul>
          </div>
          <div class="footer-column">
            <h3>Service Areas</h3>
            <ul class="service-area-list">
              <li><a href="/aca-health-insurance-lakeland-fl/">Lakeland</a></li>
              <li><a href="/brandon-health-insurance/">Brandon</a></li>
              <li><a href="/clearwater-health-insurance/">Clearwater</a></li>
              <li><a href="/davenport-health-insurance/">Davenport</a></li>
              <li><a href="/haines-city-health-insurance/">Haines City</a></li>
              <li><a href="/lake-alfred-health-insurance/">Lake Alfred</a></li>
              <li><a href="/largo-health-insurance/">Largo</a></li>
              <li><a href="/new-port-richey-health-insurance/">New Port Richey</a></li>
              <li><a href="/riverview-health-insurance/">Riverview</a></li>
              <li><a href="/st-petersburg-health-insurance/">St. Petersburg</a></li>
              <li><a href="/tampa-health-insurance/">Tampa</a></li>
              <li><a href="/wesley-chapel-health-insurance/">Wesley Chapel</a></li>
              <li><a href="/winter-haven-health-insurance/">Winter Haven</a></li>
              <li>Polk County</li>
              <li>Remote assistance across Florida</li>
            </ul>
          </div>
          <div class="footer-column">
            <h3>Quick Links</h3>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/aca-health-insurance-lakeland-fl/">Individual and Family Coverage</a></li>
              <li><a href="/losing-coverage/">Losing Coverage</a></li>
              <li><a href="/self-employed-health-insurance/">Self-Employed Coverage</a></li>
              <li><a href="/medicare/">Medicare</a></li>
              <li><a href="/plans/">Coverage Options</a></li>
              ${showHealthSherpa ? `<li><a href="${healthSherpaHref}" target="_blank" rel="noopener noreferrer">Self-Service ACA Quote</a></li>` : ''}
              <li><a href="/blog/">Blog</a></li>
              <li><a href="/our-approach.html">Our Approach</a></li>
              <li><a href="${helpHref}">Request a plan review</a></li>
              <li><a href="/privacy-policy.html">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-tpmo" role="note">
          <p class="tpmo-standard-disclaimer">${tpmoDisclaimer}</p>
        </div>
        <div class="footer-bottom">
          <p>&copy; <span data-current-year></span> Lakeland Health Insurance. Lakeland-based health insurance assistance for Florida residents.</p>
          <p>David Huff | FL License #W371813 | NPN 18213932 | Lakeland Health Insurance is not an insurance carrier.</p>
          <p style="margin-top: 1rem;"><a href="https://www.facebook.com/HealthMarkets.David.Huff" target="_blank" rel="noopener noreferrer">Powered by David the Insurance Dude</a></p>
        </div>
      </div>`;
    return footer;
  }

  function createSeasonalBanner(intent) {
    var banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.className = 'seasonal-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Medicare Annual Enrollment reminder');
    banner.innerHTML = `
      <div class="seasonal-banner-inner">
        <p>Medicare Annual Enrollment is <strong>Oct 15–Dec 7</strong>. A review is not enrollment. <a href="/medicare/">See Medicare enrollment dates</a></p>
        <button type="button" class="seasonal-banner-dismiss" aria-label="Dismiss Medicare enrollment reminder">Dismiss</button>
      </div>`;
    banner.querySelector('.seasonal-banner-dismiss').addEventListener('click', function () {
      try {
        window.localStorage.setItem(BANNER_STORAGE_KEY, 'dismissed');
      } catch (error) {
        // Ignore quota / privacy-mode failures.
      }
      banner.remove();
      document.body.classList.remove('has-seasonal-banner');
      var header = document.querySelector('header');
      if (header) header.classList.remove('has-seasonal-banner');
    });
    return banner;
  }

  function createFloatingActions() {
    const wrapper = document.createElement('div');
    wrapper.className = 'floating-actions';
    wrapper.setAttribute('aria-label', 'Call David Huff');

    const call = document.createElement('a');
    call.href = phoneHref;
    call.className = 'click-to-call';
    call.setAttribute('data-floating-call', 'true');
    call.setAttribute('aria-label', `Call ${phoneDisplay}`);
    call.innerHTML = `
      <span class="phone-icon" aria-hidden="true">&#128222;</span>
      <div class="floating-action-label">
        <span>Call: ${phoneDisplay}</span>
        <span style="font-size:0.8rem;opacity:0.9;">Direct broker line</span>
      </div>`;

    wrapper.append(call);
    return wrapper;
  }

  function removeOldFloatingActions() {
    document.querySelectorAll('.click-to-call, .lhi-floating-call, [data-floating-call], .messenger-button, .chat-widget-button').forEach((node) => node.remove());
  }

  function loadBbbSeal() {
    if (window.LHIBbbSeal) {
      window.LHIBbbSeal.mount();
      return;
    }

    if (document.querySelector('script[src*="/js/bbb-seal.js"]')) return;

    const script = document.createElement('script');
    script.src = '/js/bbb-seal.js?v=20260729-bbb-seal';
    script.defer = true;
    document.body.append(script);
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
    var pathname = currentPathname();
    var intent = resolveChromeIntent(pathname, document);
    const firstHeader = document.querySelector('header');
    const nextHeader = createHeader(intent);
    if (firstHeader) {
      firstHeader.replaceWith(nextHeader);
    } else {
      document.body.prepend(nextHeader);
    }

    if (shouldShowSeasonalBanner(pathname, { intent: intent })) {
      nextHeader.prepend(createSeasonalBanner(intent));
      nextHeader.classList.add('has-seasonal-banner');
      document.body.classList.add('has-seasonal-banner');
    }

    const lastFooter = document.querySelector('footer');
    if (lastFooter) {
      lastFooter.replaceWith(createFooter(intent, pathname));
    } else {
      document.body.append(createFooter(intent, pathname));
    }

    removeOldFloatingActions();
    const floatingActions = createFloatingActions();
    const siteFooter = document.querySelector('body > footer');
    if (siteFooter) {
      siteFooter.before(floatingActions);
    } else {
      document.body.append(floatingActions);
    }
    document.body.classList.add('has-floating-actions');

    document.querySelectorAll('#current-year, [data-current-year]').forEach((node) => {
      node.textContent = new Date().getFullYear();
    });

    wireMenu();
    loadBbbSeal();
  }

  window.LHISiteChrome = {
    resolveIntent: resolveChromeIntent,
    getHelpHref: chromeGetHelpHref,
    shouldShowHealthSherpa: shouldShowHealthSherpa,
    shouldShowSeasonalBanner: shouldShowSeasonalBanner,
    isWithinSeasonalBannerWindow: isWithinSeasonalBannerWindow,
    bannerStorageKey: BANNER_STORAGE_KEY,
    bannerId: BANNER_ID,
    bannerTimezone: SEASONAL_BANNER_TIMEZONE,
    bannerWindowStart: { month: SEASONAL_BANNER_START_MONTH, day: SEASONAL_BANNER_START_DAY },
    bannerWindowEnd: { month: SEASONAL_BANNER_END_MONTH, day: SEASONAL_BANNER_END_DAY }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalizeTemplate);
  } else {
    normalizeTemplate();
  }
})();
