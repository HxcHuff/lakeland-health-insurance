(function () {
  if (!document.body) return;
  if (document.querySelector('.lhi-topbar')) return;

  var header = document.querySelector('header');
  if (!header) return;

  var bar = document.createElement('div');
  bar.className = 'lhi-topbar';
  bar.innerHTML = 'Need plan-specific help now? Call <a href="tel:+18636403102">(863) 640-3102</a>';

  header.parentNode.insertBefore(bar, header);
})();
