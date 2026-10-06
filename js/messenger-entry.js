/* Scoped Meta Message Us (m.me) entry for three public pages only.
 * Meta retired fb-customer-chat on 2024-05-09. This is a plain m.me link
 * to the Facey-confirmed Facebook Page Inbox — no Facebook SDK, no Pixel.
 */
(function (w, d) {
  'use strict';

  if (w.__LHI_MESSENGER_ENTRY_LOADED__) return;
  w.__LHI_MESSENGER_ENTRY_LOADED__ = true;

  var PAGE_ID = '1068037236387352';
  var GREETING = 'Hi, this is David Huff, a licensed health insurance agent here in Lakeland. What can I help you with?';
  var ALLOWED_PATHS = ['/', '/book/', '/medicare/'];
  var MARKER = 'data-lhi-page-inbox';

  function rawPath(pathname) {
    return String(pathname || '/').split(/[?#]/, 1)[0] || '/';
  }

  function normalizePath(pathname) {
    var path = rawPath(pathname);
    if (path.length > 1 && /\/index\.html$/i.test(path)) {
      path = path.slice(0, -'/index.html'.length) || '/';
    }
    if (!path) return '/';
    if (path.charAt(0) !== '/') path = '/' + path;
    if (path.length > 1 && path.charAt(path.length - 1) !== '/') {
      if (!/\.[a-z0-9]+$/i.test(path)) path += '/';
    }
    return path;
  }

  function currentPathname() {
    try {
      return String((w.location && w.location.pathname) || '/');
    } catch (error) {
      return '/';
    }
  }

  function isAllowedPath(pathname) {
    var path = normalizePath(pathname == null ? currentPathname() : pathname);
    for (var i = 0; i < ALLOWED_PATHS.length; i += 1) {
      if (path === ALLOWED_PATHS[i]) return true;
    }
    return false;
  }

  function buildHref() {
    return 'https://m.me/' + PAGE_ID + '?text=' + encodeURIComponent(GREETING);
  }

  function pageKey(pathname) {
    var path = normalizePath(pathname == null ? currentPathname() : pathname);
    if (path === '/') return 'home';
    if (path === '/book/') return 'book';
    if (path === '/medicare/') return 'medicare';
    return 'other';
  }

  function existingButton() {
    return d.querySelector('.messenger-button[' + MARKER + ']');
  }

  function hostForPath(pathname) {
    var path = normalizePath(pathname == null ? currentPathname() : pathname);
    if (path === '/') return d.body;
    return d.querySelector('.floating-actions') || d.body;
  }

  function trackClick() {
    if (typeof w.trackMessengerClick === 'function') {
      try { w.trackMessengerClick(); } catch (error) {}
      return;
    }
    if (w.LHI && typeof w.LHI.track === 'function') {
      try {
        w.LHI.track('messenger_click', { content_name: pageKey() + '_messenger_click' });
      } catch (error) {}
      return;
    }
    if (typeof w.gtag === 'function') {
      try {
        w.gtag('event', 'messenger_click', {
          event_category: 'engagement',
          event_label: 'messenger_button'
        });
      } catch (error) {}
    }
  }

  function createButton() {
    var link = d.createElement('a');
    link.className = 'messenger-button';
    link.href = buildHref();
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute(MARKER, PAGE_ID);
    link.setAttribute('data-lhi-messenger-entry', 'true');
    link.setAttribute('aria-label', GREETING);
    link.setAttribute('title', GREETING);
    link.innerHTML =
      '<span class="messenger-icon" aria-hidden="true">&#128172;</span>' +
      '<div class="floating-action-label">' +
        '<span>Message us</span>' +
        '<span style="font-size:0.8rem;opacity:0.9;">Opens Messenger</span>' +
      '</div>';
    link.addEventListener('click', trackClick);
    return link;
  }

  function mount(pathname) {
    if (!isAllowedPath(pathname)) return null;
    if (!d.body) return null;
    var current = existingButton();
    if (current) return current;
    var host = hostForPath(pathname);
    if (!host) return null;
    var button = createButton();
    host.appendChild(button);
    if (host.classList && host.classList.contains('floating-actions')) {
      host.setAttribute('aria-label', 'Call or message David Huff');
    }
    return button;
  }

  function watchRemovers() {
    if (!d.body || typeof w.MutationObserver !== 'function') return;
    if (w.__LHI_MESSENGER_ENTRY_OBSERVER__) return;
    var observer = new w.MutationObserver(function () {
      if (isAllowedPath() && !existingButton()) mount();
    });
    observer.observe(d.body, { childList: true, subtree: true });
    w.__LHI_MESSENGER_ENTRY_OBSERVER__ = observer;
  }

  function boot() {
    if (!isAllowedPath()) return;
    mount();
    watchRemovers();
    if (typeof w.setTimeout === 'function') {
      w.setTimeout(function () { mount(); }, 0);
    }
  }

  if (w.__LHI_TEST === true) {
    w.LHIMessengerEntry = {
      PAGE_ID: PAGE_ID,
      GREETING: GREETING,
      ALLOWED_PATHS: ALLOWED_PATHS.slice(),
      normalizePath: normalizePath,
      isAllowedPath: isAllowedPath,
      buildHref: buildHref,
      pageKey: pageKey,
      mount: mount
    };
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : {});
