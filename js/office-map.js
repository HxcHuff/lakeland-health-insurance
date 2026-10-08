(function () {
  'use strict';

  var EMBED_SRC = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d56313.12040141287!2d-81.93287494999998!3d28.0986556!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xad587a646ef093b7%3A0x4b3db99e3bd22c62!2sLakeland%20Health%20Insurance!5e0!3m2!1sen!2sus!4v1791470623360!5m2!1sen!2sus';

  function createMapIframe() {
    var iframe = document.createElement('iframe');
    iframe.src = EMBED_SRC;
    iframe.loading = 'lazy';
    iframe.title = 'Map to Lakeland Health Insurance';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('allowfullscreen', '');
    return iframe;
  }

  document.querySelectorAll('[data-office-map-click]').forEach(function (wrap) {
    var btn = wrap.querySelector('.office-map-load-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      wrap.classList.remove('office-map-embed--click');
      wrap.replaceChildren(createMapIframe());
    });
  });
})();
