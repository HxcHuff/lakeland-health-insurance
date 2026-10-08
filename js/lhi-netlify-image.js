/**
 * Build Netlify Image CDN URLs for local site assets.
 * @see https://docs.netlify.com/build/image-cdn/overview/
 */
(function (root) {
  'use strict';

  function netlifyImage(path, options) {
    const opts = options || {};
    const params = new URLSearchParams();
    params.set('url', String(path || '').trim());
    if (opts.w != null) params.set('w', String(opts.w));
    if (opts.h != null) params.set('h', String(opts.h));
    if (opts.fm) params.set('fm', opts.fm);
    if (opts.q != null) params.set('q', String(opts.q));
    if (opts.fit) params.set('fit', opts.fit);
    return '/.netlify/images?' + params.toString();
  }

  function netlifySrcset(path, widths, options) {
    const opts = options || {};
    const list = Array.isArray(widths) ? widths : [];
    return list
      .map(function (w) {
        return netlifyImage(path, Object.assign({}, opts, { w: w })) + ' ' + w + 'w';
      })
      .join(', ');
  }

  const api = { netlifyImage: netlifyImage, netlifySrcset: netlifySrcset };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LhiNetlifyImage = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
