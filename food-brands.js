(() => {
  const form=document.getElementById('brandFilters'),search=document.getElementById('brandSearch'),category=document.getElementById('brandCategory'),model=document.getElementById('brandModel'),status=document.getElementById('brandStatus'),results=document.getElementById('brandResults'),retry=document.getElementById('brandRetry');
  let catalog=null;
  const normalized=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const paragraph=(parent,text,className='')=>{const p=document.createElement('p');p.textContent=text;p.className=className;parent.append(p);};
  function render(){
    if(!catalog)return;
    const q=normalized(search.value);
    const rows=catalog.brands.filter(b=>(!category.value || category.value===b.category) && (!model.value || model.value===b.operatingModel) && (!q || normalized(b.name+' '+b.category+' '+b.note).includes(q)));
    results.replaceChildren();
    status.textContent=rows.length+' of '+catalog.total+' brand profiles. Sources checked '+catalog.checkedOn+'. Outlet and menu coverage is separate.';
    if(!rows.length){paragraph(results,'No brands match these filters. Try another name or clear the filters.');return;}
    for(const b of rows){
      const card=document.createElement('article');card.className='brand-card';
      const heading=document.createElement('h2');heading.textContent=b.name;card.append(heading);
      paragraph(card,b.category,'muted small');paragraph(card,catalog.models[b.operatingModel],'badge');
      paragraph(card,b.enquiryStatus,'status small');if(b.note)paragraph(card,b.note,'small muted');
      paragraph(card,'Source checked: '+b.checkedOn,'small muted');
      for(const source of b.sourceUrls){try{const url=new URL(source);if(url.protocol!=='https:' || url.username || url.password)continue;const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='View brand source';card.append(link);}catch{}}
      results.append(card);
    }
  }
  async function load(){
    retry.hidden=true;status.textContent='Loading brand sources…';
    try{const response=await fetch('/api/food-brands',{signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok || !data.success)throw new Error('Brand catalogue is unavailable. Please retry.');catalog=data;
      category.replaceChildren(new Option('All categories',''));for(const c of data.categories)category.add(new Option(c,c));
      model.replaceChildren(new Option('All operating models',''));for(const [value,label] of Object.entries(data.models))model.add(new Option(label,value));
      render();
    }catch{status.textContent='Brand catalogue is unavailable. Please retry.';retry.hidden=false;}
  }
  form.addEventListener('submit',event=>{event.preventDefault();render();});search.addEventListener('input',render);category.addEventListener('change',render);model.addEventListener('change',render);
  document.getElementById('brandReset').addEventListener('click',()=>{form.reset();render();});retry.addEventListener('click',load);load();
})();
