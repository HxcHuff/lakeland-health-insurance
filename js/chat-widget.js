(function(){
  if (window.__LHI_CHAT_WIDGET_LOADED__) return;
  window.__LHI_CHAT_WIDGET_LOADED__ = true;
  const messengerUrl = 'https://m.me/2330958066941437';
  const phoneUrl = 'tel:+18636403102';

  const style = document.createElement('style');
  style.textContent = `
    .click-to-call{position:fixed;bottom:20px;right:20px;z-index:1999;background:linear-gradient(135deg,#16a34a,#059669);color:#fff;padding:14px 18px;border-radius:999px;box-shadow:0 8px 25px rgba(22,163,74,0.35);border:none;cursor:pointer;font-weight:800;display:inline-flex;align-items:center;gap:8px;text-decoration:none}
    .click-to-call:hover{transform:translateY(-3px);box-shadow:0 12px 34px rgba(22,163,74,0.42)}
    .chat-widget-button{position:fixed;bottom:82px;right:20px;z-index:2000;background:linear-gradient(135deg,#0084ff,#0063d1);color:#fff;padding:14px 18px;border-radius:999px;box-shadow:0 10px 30px rgba(0,132,255,0.25);border:none;cursor:pointer;font-weight:800;display:inline-flex;align-items:center;gap:8px;text-decoration:none}
    .chat-widget-button:hover{transform:translateY(-3px);box-shadow:0 14px 40px rgba(0,132,255,0.35)}
    .chat-widget-icon,.call-widget-icon{font-size:1rem;line-height:1}
    @media (max-width:640px){.click-to-call{bottom:14px;right:14px;font-size:14px;padding:12px 15px}.chat-widget-button{bottom:72px;right:14px;font-size:14px;padding:12px 15px}}
  `;
  document.head.appendChild(style);

  let callBtn = document.querySelector('.click-to-call, [data-floating-call]');
  if (!callBtn) {
    callBtn = document.createElement('a');
    callBtn.className = 'click-to-call';
    callBtn.href = phoneUrl;
    callBtn.setAttribute('aria-label','Call Lakeland Health Insurance at 863-640-3102');
    document.body.appendChild(callBtn);
  }
  callBtn.innerHTML = '<span class="call-widget-icon" aria-hidden="true">&#9742;</span><span>Call: (863) 640-3102</span>';
  callBtn.addEventListener('click', function () {
    if (typeof window.lhiTrackPhoneClick === 'function') {
      try { window.lhiTrackPhoneClick('floating_call_button', 'phone_click'); } catch (e) {}
    } else if (typeof gtag === 'function') {
      try { gtag('event', 'phone_call_click', { event_category: 'engagement', event_label: 'floating_call_button' }); } catch (e) {}
      try { gtag('event', 'phone_click', { event_category: 'engagement', event_label: 'floating_call_button' }); } catch (e) {}
    }
  });

  let btn = document.getElementById('openChat');
  if (!btn) {
    btn = document.createElement('a');
    btn.id = 'openChat';
    btn.className = 'chat-widget-button';
    btn.href = messengerUrl;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.setAttribute('aria-label','Message Lakeland Health Insurance on Messenger');
    btn.setAttribute('title','Opens Facebook Messenger - Chat with Lakeland Health Insurance');
    document.body.appendChild(btn);
  }

  if (!btn.parentNode) {
    document.body.appendChild(btn);
  }
  btn.innerHTML = '<span class="chat-widget-icon" aria-hidden="true">&#128172;</span><span>Chat with Us</span>';
  btn.addEventListener('click', function () {
    if (typeof gtag === 'function') {
      try { gtag('event', 'messenger_click', { event_category: 'engagement', event_label: 'messenger_chat_button' }); } catch (e) {}
    }
    if (btn.tagName.toLowerCase() !== 'a') {
      window.open(messengerUrl, '_blank', 'noopener');
    }
  });
})();
