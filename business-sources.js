(() => {
  const line = (parent, text, className = 'small mute') => {
    const p = document.createElement('p'); p.className = className; p.textContent = text; parent.append(p);
  };
  const link = (parent, label, value) => {
    try { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password) return;
      const a = document.createElement('a'); a.href = u.href; a.textContent = label;
      a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.textDecoration = 'underline'; parent.append(a);
    } catch {}
  };
  window.SuggestDishSources = {attach(card, business) {
    const sourceId = business.sourceProfileId || business.id;
    if (!sourceId.startsWith('official:')) return;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-light';
    button.textContent = 'Business details & menu'; button.setAttribute('aria-expanded','false');
    const panel = document.createElement('div'); panel.hidden = true;
    panel.id = 'source-' + business.id.replace(/[^a-z0-9-]/gi,'-'); button.setAttribute('aria-controls',panel.id);
    card.append(button,panel); let loaded = false, busy = false;
    button.addEventListener('click', async () => {
      if (busy) return;
      panel.hidden = !panel.hidden; button.setAttribute('aria-expanded',String(!panel.hidden));
      if (panel.hidden || loaded) return;
      busy = true; button.disabled = true; panel.replaceChildren(); line(panel,'Loading source details…');
      try {
        const response = await fetch('/api/business-source?' + new URLSearchParams({businessId:sourceId}), {signal:AbortSignal.timeout(20000)});
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Details unavailable.');
        panel.replaceChildren(); const b = data.business;
        line(panel,data.notice);
        for (const [label,value] of [['Locality',b.locality],['Phone',b.phone],['Email',b.email],['Published hours',b.opening_hours],['Service',b.service_note]]) if (value) line(panel,label + ': ' + value);
        line(panel,'Source checked: ' + b.retrieved_on + '. Food licence status has not been checked.');
        for (const url of b.source_urls || []) { const p = document.createElement('p'); link(p,'Official business source',url); panel.append(p); }
        if (data.menuItems.length) {
          const heading = document.createElement('h4'); heading.textContent = 'Published brand menu'; panel.append(heading);
          line(panel,'Branch availability is unconfirmed. These menu entries are reference information; they do not enter budget or dietary recommendations automatically.');
          const list = document.createElement('ul'); list.style.paddingLeft = '20px';
          for (const m of data.menuItems) {
            const item = document.createElement('li'); item.textContent = m.name + (m.portion ? ' · '+m.portion : '') + (m.price_inr === null ? ' · Price not published' : ' · ₹'+m.price_inr+' (source menu price)') + (m.is_veg === true ? ' · Vegetarian according to source' : ''); list.append(item);
          }
          panel.append(list); for (const url of new Set(data.menuItems.map(m=>m.source_url))) { const p = document.createElement('p'); link(p,'View published menu',url); panel.append(p); }
          line(panel,'Menu effective date and tax inclusion are unspecified. Confirm today’s price, ingredients and preparation with the outlet.');
        } else line(panel,'No transcribed menu is available yet. Use the official source or contact the business.');
        loaded = true;
      } catch (e) { panel.replaceChildren(); line(panel,e.message || 'Details unavailable. Try again.'); }
      finally { busy = false; button.disabled = false; }
    });
  }};
})();
