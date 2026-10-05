(() => {
  const showCoverage = async () => {
    const target = document.getElementById('sourceCoverage'); if (!target) return;
    try {
      const response = await fetch('/api/data-coverage', {signal:AbortSignal.timeout(10000)});
      const data = await response.json(); if (!response.ok || !data.success) return;
      target.textContent = 'Published source details: ' + data.businessProfiles + ' business profiles, ' + data.menuEntries + ' menu entries and ' + data.publishedPrices + ' published prices and ' + data.profilesWithCoordinates + ' source map locations. Checked ' + data.checkedOn + '. Coverage is partial; food licences and current availability remain unverified.';
    } catch {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',showCoverage,{once:true}); else showCoverage();
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
        for (const [label,value] of [['State',b.state],['Locality',b.locality],['Phone',b.phone],['Email',b.email],['Published hours',b.opening_hours],['Service',b.service_note],['FSSAI number published by business (unverified)',b.fssai_license_number]]) if (value) line(panel,label + ': ' + value);
        if (Number.isFinite(b.latitude) && Number.isFinite(b.longitude)) {line(panel,'Source map location: '+b.latitude+', '+b.longitude+'. Pin accuracy is unconfirmed.'); const map=document.createElement('p');link(map,'Open outlet map','https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(b.latitude+','+b.longitude));panel.append(map);}
        line(panel,'Source checked: ' + b.retrieved_on + '. Food licence status has not been checked.');
        for (const url of b.source_urls || []) { const p = document.createElement('p'); link(p,new URL(url).hostname.endsWith('zomato.com') ? 'Published delivery-platform source' : 'Official business source',url); panel.append(p); }
        if (b.google_listing_status==='business_link_published' && b.google_maps_url) {
          const url=new URL(b.google_maps_url);
          if (url.protocol==='https:' && ['share.google','maps.app.goo.gl','goo.gl','g.page','www.google.com','maps.google.com'].includes(url.hostname)) {
            const p=document.createElement('p');link(p,'Google Maps link published by the business',url.href);panel.append(p);
          }
        }
        if (data.menuItems.length) {
          const heading = document.createElement('h4'); heading.textContent = data.menuScope==='outlet_page' ? 'Published outlet menu' : 'Brand menu reference'; panel.append(heading);
          line(panel,data.menuNotice || 'Branch availability is unconfirmed. These menu entries are reference information; they do not enter budget or dietary recommendations automatically.');
          const label = document.createElement('label'); label.textContent = 'Search this menu';
          const filter = document.createElement('input'); filter.type = 'search'; filter.id = panel.id + '-filter';
          label.htmlFor = filter.id; filter.placeholder = 'Dish or menu category'; filter.maxLength = 100;
          filter.style.width = '100%'; panel.append(label,filter);
          const count = document.createElement('p'); count.className = 'small mute'; count.setAttribute('aria-live','polite'); panel.append(count);
          const list = document.createElement('ul'); list.style.paddingLeft = '20px';
          for (const m of data.menuItems) {
            const item = document.createElement('li'); item.textContent = m.name + (m.menu_category ? ' · '+m.menu_category : '') + (m.portion ? ' · '+m.portion : '') + (m.price_inr === null ? ' · Price not published' : ' · ₹'+m.price_inr+(data.menuScope==='outlet_page' ? ' (outlet-page price)' : ' (reference price; confirm with outlet)')) + (m.is_veg === true ? ' · Vegetarian according to source' : m.is_veg === false ? ' · Non-vegetarian according to source' : ' · Dietary type unconfirmed') + (m.tax_included===false ? ' · Excludes GST' : '') + (m.service_time ? ' · Served '+m.service_time : '') + (m.order_note ? ' · '+m.order_note : '') + (['OutOfStock','catalog_disabled'].includes(m.source_availability) ? ' · Source lists unavailable' : ''); list.append(item);
          }
          const applyFilter = () => {const query=filter.value.trim().toLowerCase();let visible=0;for(const item of list.children){item.hidden=!item.textContent.toLowerCase().includes(query);if(!item.hidden)visible++;}count.textContent=visible+' of '+data.menuItems.length+' menu entries';};
          filter.addEventListener('input',applyFilter);applyFilter();
          panel.append(list); for (const url of new Set(data.menuItems.map(m=>m.source_url))) { const p = document.createElement('p'); link(p,'View published menu',url); panel.append(p); }
          line(panel,'Confirm today’s total price, taxes, availability, ingredients and preparation with the outlet.');
        } else line(panel,'No transcribed menu is available yet. Use the published source or contact the business.');
        loaded = true;
      } catch (e) { panel.replaceChildren(); line(panel,e.message || 'Details unavailable. Try again.'); }
      finally { busy = false; button.disabled = false; }
    });
  }};
})();
