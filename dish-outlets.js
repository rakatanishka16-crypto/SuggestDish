(() => {
 const init=async()=>{
  const form=document.getElementById('dishOutletForm');if(!form)return;
  const select=document.getElementById('dishOutletSelect'),status=document.getElementById('dishOutletStatus'),results=document.getElementById('dishOutletResults'),next=document.getElementById('dishOutletNext');
  let summary=[],filters={},offset=0,busy=false;
  const text=(parent,tag,value,cls)=>{const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;parent.append(el);return el;};
  const sourceLink=(parent,label,url)=>{try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)return;const a=text(parent,'a',label);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.style.textDecoration='underline';}catch{}};
  const showSummary=()=>{
   results.replaceChildren();next.hidden=true;
   status.textContent=summary.length+' dishes in this curated shortlist. Select a dish to explore its menu matches.';
   for(const dish of summary){const card=document.createElement('article');card.className='card panel';text(card,'h3',dish.name);text(card,'p',dish.brands.join(', ')||'Research pending','mute');text(card,'p',dish.outletMenuCount+' outlet-page matches · '+dish.referenceOutletCount+' branch references','small mute');const button=text(card,'button','Explore outlets','btn btn-light');button.type='button';button.addEventListener('click',()=>{select.value=String(dish.id);form.requestSubmit();});results.append(card);}
  };
  const search=async()=>{
   if(busy)return;
   if(!filters.dishId){showSummary();return;}
   busy=true;next.hidden=true;results.replaceChildren();status.textContent='Finding published dish matches…';
   try{
    const response=await fetch('/api/dish-outlets?'+new URLSearchParams({...filters,offset,limit:20}),{signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.error || 'Search unavailable.');
    status.textContent=data.total?data.dish.name+': '+data.total+' matching outlet records'+(data.city?' in '+data.city:'')+'. Showing '+(offset+1)+'–'+(offset+data.outlets.length)+'.': 'No source-backed match for this dish in the selected city yet.';
    for(const outlet of data.outlets){const card=document.createElement('article');card.className='card panel';text(card,'h3',outlet.name);text(card,'p',[outlet.city,outlet.state,outlet.address].filter(Boolean).join(' · '),'mute');text(card,'p',outlet.menuScope==='outlet_page'?'Published outlet menu; confirm current availability.':'Brand menu reference; availability and prices at this branch are unconfirmed.','small mute');text(card,'p',data.dish.note,'small mute');const list=document.createElement('ul');list.style.paddingLeft='20px';for(const item of outlet.menuItems){text(list,'li',item.name+(item.portion?' · '+item.portion:'')+(item.price_inr===null?' · Price not published':' · ₹'+item.price_inr+(outlet.menuScope==='brand_reference'?' (reference price)':' (published price)'))+(item.tax_included===false?' · Excludes GST':''));}card.append(list);sourceLink(card,'View outlet source',outlet.sourceUrl);for(const url of new Set(outlet.menuItems.map(m=>m.source_url)))sourceLink(text(card,'p',''),'View menu evidence',url);window.SuggestDishSources?.attach(card,outlet);results.append(card);}
    next.hidden=!data.hasMore;
   }catch(error){status.textContent=error.message || 'Dish search unavailable. Please try again.';}finally{busy=false;}
  };
  form.addEventListener('submit',event=>{event.preventDefault();if(busy)return;filters=Object.fromEntries(new FormData(form));offset=0;search();});next.addEventListener('click',()=>{if(busy)return;offset+=20;search();});
  try{const response=await fetch('/api/dish-outlets',{signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok||!data.success)throw new Error('Dish shortlist is temporarily unavailable.');summary=data.dishes;for(const dish of summary){const option=document.createElement('option');option.value=String(dish.id);option.textContent=dish.name;select.append(option);}showSummary();}catch(error){status.textContent=error.message;}
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
