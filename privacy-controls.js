'use strict';
(() => {
  const key = 'suggestdish.privacy.v1';
  let allowed = false;
  try { allowed = JSON.parse(localStorage.getItem(key) || 'null')?.analytics === true; } catch {}
  window.SuggestDishPrivacy = {
    analyticsAllowed: () => allowed,
    record(event, dishIds) {
      if (!allowed || navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
      fetch('/api/dish-events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,dishIds}),keepalive:true}).catch(()=>{});
    }
  };
  document.addEventListener('DOMContentLoaded', () => {
    const panel = document.createElement('section');
    panel.id = 'privacyChoices'; panel.className = 'privacy-choices'; panel.setAttribute('aria-label','Cookies and privacy choices');
    panel.innerHTML = '<h2>Cookies &amp; privacy</h2><p>We use device storage for your privacy choice and dishes or preferences you choose to save. Optional anonymous dish views and link clicks help us improve discovery. No advertising cookies are added by SuggestDish. <a href="/privacy.html">Read our privacy policy</a>.</p><div class="privacy-actions"><button type="button" class="btn btn-light" data-privacy="false">Reject optional analytics</button><button type="button" class="btn btn-light" data-privacy="true">Allow optional analytics</button></div><p class="small" role="status" id="privacyChoiceStatus"></p>';
    document.body.append(panel);
    function close(){panel.hidden=true;}
    for (const button of panel.querySelectorAll('[data-privacy]')) button.addEventListener('click',()=>{
      allowed = button.dataset.privacy === 'true';
      try {localStorage.setItem(key,JSON.stringify({analytics:allowed,updatedAt:new Date().toISOString()}));close();}
      catch {document.getElementById('privacyChoiceStatus').textContent='Your choice applies for this visit. This browser could not save it.';}
    });
    document.querySelectorAll('[data-open-privacy]').forEach(button=>button.addEventListener('click',()=>{panel.hidden=false;panel.querySelector('button').focus();}));
    try {panel.hidden=localStorage.getItem(key)!==null;} catch {panel.hidden=false;}
  });
})();
