(function(){
  if (window.__LHI_CHAT_WIDGET_LOADED__) return;
  window.__LHI_CHAT_WIDGET_LOADED__ = true;
  const messengerUrl = 'https://m.me/2330958066941437';

  const style = document.createElement('style');
  style.textContent = `
    .chat-widget-button{position:fixed;bottom:110px;right:20px;z-index:2000;background:linear-gradient(135deg,#0084ff,#0063d1);color:#fff;padding:14px 18px;border-radius:999px;box-shadow:0 10px 30px rgba(0,132,255,0.25);border:none;cursor:pointer;font-weight:700;text-decoration:none;display:flex;align-items:center;gap:6px}
    .chat-widget-button:hover{transform:translateY(-3px)}
  `;
  document.head.appendChild(style);

  const btn = document.createElement('a');
  btn.id = 'openChat';
  btn.className = 'chat-widget-button';
  btn.setAttribute('aria-label','Message David on Facebook');
  btn.setAttribute('title','Message David on Facebook Messenger');
  btn.href = messengerUrl;
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.innerText = '💬 Chat with David';

  btn.addEventListener('click', function () {
    if (typeof gtag === 'function') {
      try { gtag('event', 'open_chat', { event_category: 'engagement', event_label: 'messenger_chat_button' }); } catch (e) {}
    }
  });

  document.body.appendChild(btn);
})();
