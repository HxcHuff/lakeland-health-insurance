/**
 * Static site header shell matching js/site-template.js createHeader() defaults.
 * Phone/help hrefs are patched at runtime by site-template.js.
 */

const NAV_LINKS = [
  ['/aca-health-insurance-lakeland-fl/', 'Individual'],
  ['/medicare/', 'Medicare'],
  ['/provider-prescription-check/', 'Doctors & Rx'],
  ['/plans/', 'Plans'],
  ['/carriers/', 'Carriers'],
  ['/blog/', 'Blog']
];

const MENU_LINKS = [
  ['/', 'Home'],
  ['/aca-health-insurance-lakeland-fl/', 'Individual and Family Coverage'],
  ['/medicare/', 'Medicare'],
  ['/provider-prescription-check/', 'Check doctors & Rx'],
  ['/plans/', 'Coverage Options'],
  ['/carriers/', 'Carriers'],
  ['/states/', "States I'm licensed in"],
  ['/blog/', 'Blog'],
  ['/learning/', 'Learn'],
  ['/about/', 'About'],
  ['/get-help/', 'Get Help'],
  ['tel:+18636403102', '(863) 640-3102'],
  ['tel:+18636403102', 'Call Now']
];

export function renderSeasonalBannerShell() {
  return `<div id="lhi-seasonal-banner" class="seasonal-banner" role="region" aria-label="Medicare Annual Enrollment reminder">
        <div class="seasonal-banner-inner">
          <p>Medicare Annual Enrollment is <strong>Oct 15–Dec 7</strong>. A review is not enrollment. <a href="/medicare/">See Medicare enrollment dates</a></p>
          <button type="button" class="seasonal-banner-dismiss" aria-label="Dismiss Medicare enrollment reminder">Dismiss</button>
        </div>
      </div>`;
}

export function renderSiteHeaderShell(options = {}) {
  const {
    helpHref = '/get-help/',
    seasonalBanner = false,
    bannerClasses = ''
  } = options;

  const menuItems = MENU_LINKS.map(([href, label]) => {
    const resolvedHref = label === 'Get Help' ? helpHref : href;
    return `<div class="menu-item"><a href="${resolvedHref}">${label}</a></div>`;
  }).join('');

  const navItems = NAV_LINKS.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('');

  const bannerBlock = seasonalBanner ? renderSeasonalBannerShell() : '';

  const headerClass = [
    seasonalBanner ? 'has-seasonal-banner' : '',
    bannerClasses
  ].filter(Boolean).join(' ');

  return `<header data-lhi-site-chrome="shell"${headerClass ? ` class="${headerClass.trim()}"` : ''} aria-label="Site header">
      ${bannerBlock}
      <nav class="container">
        <div class="logo-container">
          <a class="brand-name" href="/">
            Lakeland Health Insurance
            <span class="license-tag">FL #W371813</span>
          </a>
          <button class="menu-button" type="button" aria-label="Toggle navigation menu" aria-expanded="false">
            <div class="ellipses" aria-hidden="true">
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
          </button>
          <div class="dropdown-menu" id="dropdownMenu">
            ${menuItems}
          </div>
        </div>
        <ul class="nav-links">
          ${navItems}
        </ul>
        <div class="cta-group">
          <a href="${helpHref}" class="cta-button" data-lhi-help-cta="true">Plan review</a>
        </div>
      </nav>
    </header>`;
}

export function shouldEmbedSeasonalBanner(metaIntent, publicPath) {
  if (publicPath === '/' || publicPath === '/coverage-center/') return true;
  return metaIntent === 'medicare';
}
