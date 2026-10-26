'use strict';
(() => {
 let cancelCarousel=()=>{};
 const init=async()=>{
  cancelCarousel();
  const section=document.getElementById('featured-dishes'),list=document.getElementById('featuredDishList');
  if(!section || !list)return;
  try{
   const response=await fetch('/api/featured-dishes',{signal:AbortSignal.timeout(15000)});
   const data=await response.json();
   if(!response.ok || !data.success || !Array.isArray(data.dishes))return;
   const slideshow=document.getElementById('promotedDishSlideshow'),slides=document.getElementById('promotedSlides');
   const promoted=data.dishes.filter(d=>d.sponsored===true && typeof d.photoUrl==='string' && d.photoUrl.startsWith('/api/promotion-photo/'));
   if(slideshow && slides && promoted.length){
    let current=0,paused=window.matchMedia('(prefers-reduced-motion: reduce)').matches,timer;
    const count=document.getElementById('promotedSlideCount'),pause=document.getElementById('pausePromotedDishes');
    const items=promoted.map((dish,i)=>{
     const article=document.createElement('article');article.className='promoted-slide';article.hidden=i!==0;article.setAttribute('aria-label',(i+1)+' of '+promoted.length);
     const photo=document.createElement('img');photo.src=dish.photoUrl;photo.alt=dish.dishName+' from '+dish.restaurant;photo.loading=i===0?'eager':'lazy';photo.decoding='async';
     const info=document.createElement('div');info.className='promoted-slide-info';const badge=document.createElement('span');badge.className='badge';badge.textContent='Sponsored · Owner-submitted';const title=document.createElement('h2');title.textContent=dish.dishName;const price=document.createElement('p');price.textContent='₹'+dish.price+' · '+(dish.vegetarian?'Vegetarian':'Non-vegetarian');const business=document.createElement('p');const strong=document.createElement('strong');strong.textContent=dish.restaurant;business.append(strong);const location=document.createElement('p');location.className='promotion-location';location.textContent=dish.address||dish.city||'';info.append(badge,title,price,business,location);
     try{const url=new URL(dish.menuUrl);if(url.protocol==='https:'&&!url.username&&!url.password){const link=document.createElement('a');link.className='btn';link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='View menu';info.append(link);}}catch{}
     article.append(photo,info);return article;
    });
    slides.replaceChildren(...items);slideshow.hidden=false;
    function show(index){current=(index+items.length)%items.length;items.forEach((item,i)=>{item.hidden=i!==current;});count.textContent=(current+1)+' / '+items.length;}
    function schedule(){clearInterval(timer);pause.textContent=paused?'Play slideshow':'Pause slideshow';if(!paused && items.length>1 && !document.hidden)timer=setInterval(()=>{if(!slideshow.contains(document.activeElement)&&!slideshow.matches(':hover'))show(current+1);},5000);}
    document.getElementById('previousPromotedDish').onclick=()=>{show(current-1);schedule();};document.getElementById('nextPromotedDish').onclick=()=>{show(current+1);schedule();};pause.onclick=()=>{paused=!paused;schedule();};document.addEventListener('visibilitychange',schedule);cancelCarousel=()=>{clearInterval(timer);document.removeEventListener('visibilitychange',schedule);};show(0);schedule();
   }
   const cards=[];
   for(const dish of data.dishes.slice(0,6)){
    if(dish.sponsored!==true || (!Number.isSafeInteger(dish.dishId) && typeof dish.promotionId!=='string') || typeof dish.dishName!=='string')continue;
    const card=document.createElement('article');card.className='card panel';
    const badge=document.createElement('span');badge.className='badge';badge.textContent='Sponsored';
    const title=document.createElement('h3');title.textContent=dish.dishName;
    const details=document.createElement('p');details.className='mute';details.textContent=[dish.restaurant,dish.city,'₹'+dish.price,dish.vegetarian ? 'Vegetarian' : 'Non-vegetarian'].filter(Boolean).join(' · ');
    const address=document.createElement('p');address.className='small mute';address.textContent=dish.address || '';
    const note=document.createElement('p');note.className='small mute';note.textContent=(dish.ownerSubmitted?'Owner-submitted. ':'')+'Confirm current price, ingredients and availability with the restaurant.';
    card.append(badge,title,details,address,note);
    try{const url=new URL(dish.menuUrl);if(url.protocol==='https:' && !url.username && !url.password){
     const link=document.createElement('a');link.className='btn btn-light';link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='View menu';card.append(link);
    }}catch{}
    cards.push(card);
   }
   if(cards.length){list.replaceChildren(...cards);section.hidden=false;}
  }catch{/* Keep the section hidden when no paid listings can be loaded. */}
 };
 window.addEventListener('suggestdish:promotions-updated',init);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
