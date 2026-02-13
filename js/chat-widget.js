(function(){
  if (window.__LHI_CHAT_WIDGET_LOADED__) return;
  window.__LHI_CHAT_WIDGET_LOADED__ = true;
  const messengerUrl = 'https://m.me/2330958066941437';

  const style = document.createElement('style');
  style.textContent = `
    .chat-widget-button{position:fixed;bottom:110px;right:20px;z-index:2000;background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:#fff;padding:14px 18px;border-radius:999px;box-shadow:0 10px 30px rgba(30,58,138,0.25);border:none;cursor:pointer;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:4px}
    .chat-widget-button:hover{transform:translateY(-3px);box-shadow:0 14px 40px rgba(30,58,138,0.35)}
  `;
  document.head.appendChild(style);

  const btn = document.createElement('a');
  btn.id = 'openChat';
  btn.className = 'chat-widget-button';
  btn.setAttribute('href', messengerUrl);
  btn.setAttribute('target', '_blank');
  btn.setAttribute('rel', 'noopener noreferrer');
  btn.setAttribute('aria-label','Chat with David on Messenger');
  btn.setAttribute('title','Opens Facebook Messenger — Chat with David');
  btn.innerText = '💬 Chat with David';

  document.body.appendChild(btn);
  btn.addEventListener('click', function () {
    if (typeof gtag === 'function') {
      try { gtag('event', 'open_chat', { event_category: 'engagement', event_label: 'messenger_chat_button' }); } catch (e) {}
    }
    if (typeof fbq === 'function') {
      try { fbq('track', 'Contact', {content_name: 'messenger_chat'}); } catch (e) {}
    }
  });
})();
