(function(){
  if (window.__LHI_CHAT_WIDGET_LOADED__) return;
  window.__LHI_CHAT_WIDGET_LOADED__ = true;
  const messengerUrl = 'https://m.me/2330958066941437';

  const style = document.createElement('style');
  style.textContent = `
    .chat-widget-button{position:fixed;bottom:110px;right:20px;z-index:2000;background:linear-gradient(135deg,#0084ff,#0063d1);color:#fff;padding:14px 18px;border-radius:999px;box-shadow:0 10px 30px rgba(0,132,255,0.25);border:none;cursor:pointer;font-weight:700;display:inline-flex;align-items:center;gap:8px;text-decoration:none}
    .chat-widget-button:hover{transform:translateY(-3px);box-shadow:0 14px 40px rgba(0,132,255,0.35)}
    .chat-widget-icon{font-size:1rem;line-height:1}
  `;
  document.head.appendChild(style);

  let btn = document.getElementById('openChat');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'openChat';
    btn.className = 'chat-widget-button';
    btn.setAttribute('aria-label','Message David on Messenger');
    btn.setAttribute('title','Opens Facebook Messenger - Chat with David');
    document.body.appendChild(btn);
  }

  if (!btn.parentNode) {
    document.body.appendChild(btn);
  }
  btn.innerHTML = '<span class="chat-widget-icon" aria-hidden="true">&#128172;</span><span>Chat with David</span>';
  btn.addEventListener('click', function () {
    if (typeof gtag === 'function') {
      try { gtag('event', 'messenger_click', { event_category: 'engagement', event_label: 'messenger_chat_button' }); } catch (e) {}
    }
    if (btn.tagName.toLowerCase() !== 'a') {
      window.open(messengerUrl, '_blank', 'noopener');
    }
  });
})();
