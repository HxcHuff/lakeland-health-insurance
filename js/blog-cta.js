// Sticky CTA Bar for Blog Posts
// Auto-injects a fixed bottom bar after scrolling 300px
// ViewContent + tel: Contact tracking now handled by analytics.js auto-wiring
(function() {
    // Create sticky bar HTML
    var bar = document.createElement('div');
    bar.id = 'stickyCta';
    bar.setAttribute('role', 'complementary');
    bar.setAttribute('aria-label', 'Contact David for help');
    bar.innerHTML = '<div class="sticky-cta-inner">' +
        '<span class="sticky-cta-text">Need help choosing a plan?</span>' +
        '<div class="sticky-cta-buttons">' +
            '<a href="tel:+18636403102" class="sticky-cta-call" onclick="if(typeof gtag===\'function\')gtag(\'event\',\'phone_call\',{event_category:\'blog_sticky_cta\'})">Call (863) 640-3102</a>' +
            '<a href="/#contact" class="sticky-cta-quote">Get Free Quote</a>' +
        '</div>' +
        '<button class="sticky-cta-dismiss" aria-label="Dismiss">&times;</button>' +
    '</div>';

    // Create styles
    var style = document.createElement('style');
    style.textContent = '#stickyCta{position:fixed;bottom:-80px;left:0;right:0;z-index:999;transition:bottom 0.4s ease;pointer-events:none}' +
        '#stickyCta.visible{bottom:0;pointer-events:auto}' +
        '.sticky-cta-inner{background:linear-gradient(135deg,#1B2A4A,#2563EB);padding:12px 20px;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;box-shadow:0 -4px 20px rgba(0,0,0,0.15)}' +
        '.sticky-cta-text{color:white;font-weight:600;font-size:0.95rem;font-family:DM Sans,-apple-system,BlinkMacSystemFont,sans-serif}' +
        '.sticky-cta-buttons{display:flex;gap:10px;align-items:center}' +
        '.sticky-cta-call{background:linear-gradient(135deg,#D4A843,#B8962D);color:white;padding:8px 18px;border-radius:50px;text-decoration:none;font-weight:600;font-size:0.9rem;transition:transform 0.2s;font-family:inherit}' +
        '.sticky-cta-call:hover{transform:translateY(-2px)}' +
        '.sticky-cta-quote{background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.4);color:white;padding:8px 18px;border-radius:50px;text-decoration:none;font-weight:600;font-size:0.9rem;transition:all 0.2s;font-family:inherit}' +
        '.sticky-cta-quote:hover{background:rgba(255,255,255,0.25)}' +
        '.sticky-cta-dismiss{background:none;border:none;color:rgba(255,255,255,0.7);font-size:1.3rem;cursor:pointer;padding:4px 8px;transition:color 0.2s}' +
        '.sticky-cta-dismiss:hover{color:white}' +
        '@media(max-width:600px){.sticky-cta-text{display:none}.sticky-cta-inner{justify-content:center;padding:10px 16px}}';

    // Inject into page
    document.head.appendChild(style);
    document.body.appendChild(bar);

    // Show after scrolling 300px
    var dismissed = false;
    window.addEventListener('scroll', function() {
        if (dismissed) return;
        if (window.pageYOffset > 300) {
            bar.classList.add('visible');
        } else {
            bar.classList.remove('visible');
        }
    });

    // Dismiss button
    bar.querySelector('.sticky-cta-dismiss').addEventListener('click', function() {
        dismissed = true;
        bar.classList.remove('visible');
    });
})();
