(function(){
  if (window.__LHI_CHAT_WIDGET_LOADED__) return;
  window.__LHI_CHAT_WIDGET_LOADED__ = true;
  const agentUrl = 'https://www.genspark.ai/agents?type=custom_super_agent&agent_id=eeee3a51-ad35-4269-9aae-e945275e1375';

  const style = document.createElement('style');
  style.textContent = `
    .chat-widget-button{position:fixed;bottom:110px;right:20px;z-index:2000;background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:#fff;padding:14px 18px;border-radius:999px;box-shadow:0 10px 30px rgba(30,58,138,0.25);border:none;cursor:pointer;font-weight:700}
    .chat-widget-button:hover{transform:translateY(-3px)}
    .chat-widget-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);z-index:2001;padding:20px}
    .chat-widget-overlay.show{display:flex}
    .chat-widget-modal{width:100%;max-width:980px;height:80vh;background:#fff;border-radius:12px;overflow:hidden;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
    .chat-widget-close{position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.05);border:none;width:36px;height:36px;border-radius:8px;cursor:pointer;font-size:18px;z-index:10}
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'openChat';
  btn.className = 'chat-widget-button';
  btn.setAttribute('aria-label','Open chat');
  btn.innerText = '💬 Chat';

  // Simpler behavior: open genspark agent in a new tab/window.
  // Many providers (including Genspark) send X-Frame-Options:SAMEORIGIN which blocks embedding.
  // Opening in a new tab is a reliable fallback that preserves the user's context.
  document.body.appendChild(btn);
  btn.addEventListener('click', function () {
    window.open(agentUrl, '_blank', 'noopener');
  });
})();
