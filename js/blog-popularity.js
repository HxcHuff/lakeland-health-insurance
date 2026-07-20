(function () {
  var DATA_URL = '../data/blog-visits.json';

  function normalizePath(url) {
    try {
      var parsed = new URL(url, window.location.href);
      return parsed.pathname.replace(/^\/+/, '').replace(/\/index\.html$/, '/');
    } catch (e) {
      return String(url || '').replace(/^\/+/, '').replace(/\/index\.html$/, '/');
    }
  }

  function formatCount(value) {
    if (value >= 1000000) return (value / 1000000).toFixed(value >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (value >= 1000) return (value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return String(value);
  }

  function getArticleData(counts) {
    return Array.from(document.querySelectorAll('.article-card')).map(function (card) {
      var link = card.querySelector('.article-title a');
      if (!link) return null;

      var path = normalizePath(link.getAttribute('href'));
      var views = Number(counts[path] || counts['/' + path] || 0);
      return {
        card: card,
        link: link,
        title: link.textContent.trim(),
        url: link.getAttribute('href'),
        date: (card.querySelector('.article-date') || {}).textContent || '',
        views: Number.isFinite(views) ? views : 0
      };
    }).filter(Boolean);
  }

  function addCardBadges(articles) {
    articles.forEach(function (article) {
      if (article.views <= 0) return;
      var date = article.card.querySelector('.article-date');
      if (!date || date.querySelector('.visit-count-badge')) return;

      var badge = document.createElement('span');
      badge.className = 'visit-count-badge';
      badge.textContent = formatCount(article.views) + ' visits';
      date.appendChild(badge);
    });
  }

  function renderPopularPosts(articles, meta) {
    var section = document.getElementById('popular-posts');
    var list = document.getElementById('popular-post-list');
    var note = document.getElementById('popular-post-note');
    if (!section || !list) return;

    var ranked = articles.filter(function (article) {
      return article.views > 0;
    }).sort(function (a, b) {
      return b.views - a.views;
    }).slice(0, 5);

    if (!ranked.length) {
      section.hidden = true;
      return;
    }

    list.innerHTML = ranked.map(function (article, index) {
      return [
        '<a class="popular-post-row" href="' + article.url + '">',
        '<span class="popular-rank">#' + (index + 1) + '</span>',
        '<span class="popular-title">' + article.title + '</span>',
        '<span class="popular-count">' + formatCount(article.views) + '<small>visits</small></span>',
        '</a>'
      ].join('');
    }).join('');

    if (note && meta && meta.window) {
      note.textContent = 'Ranked by visits, ' + meta.window.replace(/_/g, ' ') + '.';
    }

    section.hidden = false;
  }

  function init() {
    fetch(DATA_URL, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Visit data unavailable');
        return response.json();
      })
      .then(function (data) {
        var counts = data && data.counts ? data.counts : {};
        var articles = getArticleData(counts);
        addCardBadges(articles);
        renderPopularPosts(articles, data);
      })
      .catch(function () {
        var section = document.getElementById('popular-posts');
        if (section) section.hidden = true;
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
