// In-flow CTA for blog posts. Contact tracking is handled by analytics.js.
(function () {
    var existingArticleCta = document.querySelector(
        'main .cta-section, main .cta-panel, main .article-cta, main .cta-box, ' +
        'main .quote-tool-cta, main .review-cta'
    );
    if (existingArticleCta) return;

    var bar = document.createElement('aside');
    bar.id = 'articleCta';
    bar.setAttribute('aria-label', 'Contact David for plan help');
    bar.innerHTML = '<div class="article-cta-inner">' +
        '<span class="article-cta-text">Need help comparing plan options?</span>' +
        '<div class="article-cta-buttons">' +
            '<a href="tel:+18636403102" class="article-cta-call">Call (863) 640-3102</a>' +
            '<a href="/get-help/" class="article-cta-review">Start Plan Review</a>' +
        '</div>' +
    '</div>';

    var style = document.createElement('style');
    style.textContent = '#articleCta{background:linear-gradient(135deg,#1B2A4A,#2563EB);margin:0;position:static}' +
        '.article-cta-inner{align-items:center;display:flex;flex-wrap:wrap;gap:18px;justify-content:center;margin:0 auto;max-width:1100px;padding:20px}' +
        '.article-cta-text{color:white;font-family:DM Sans,-apple-system,BlinkMacSystemFont,sans-serif;font-size:1rem;font-weight:600}' +
        '.article-cta-buttons{align-items:center;display:flex;gap:10px}' +
        '.article-cta-call,.article-cta-review{border-radius:50px;font-family:inherit;font-size:0.9rem;font-weight:700;padding:9px 18px;text-decoration:none;transition:background-color 0.2s ease,transform 0.2s ease}' +
        '.article-cta-call{background:#D4A843;color:#0F1A2E}' +
        '.article-cta-review{background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.45);color:white}' +
        '.article-cta-call:hover,.article-cta-review:hover{transform:translateY(-2px)}' +
        '.article-cta-review:hover{background:rgba(255,255,255,0.25)}' +
        '.article-cta-call:focus-visible,.article-cta-review:focus-visible{outline:3px solid white;outline-offset:3px}' +
        '@media(max-width:768px){#articleCta{display:none}}';

    document.head.appendChild(style);
    var insertionPoint = document.querySelector('.related-posts, body > footer');
    if (insertionPoint) {
        insertionPoint.before(bar);
    } else {
        document.body.appendChild(bar);
    }
})();
