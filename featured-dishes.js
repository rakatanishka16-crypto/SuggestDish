'use strict';
(() => {
 const init=async()=>{
  const section=document.getElementById('featured-dishes'),list=document.getElementById('featuredDishList');
  if(!section || !list)return;
  try{
   const response=await fetch('/api/featured-dishes',{signal:AbortSignal.timeout(15000)});
   const data=await response.json();
   if(!response.ok || !data.success || !Array.isArray(data.dishes))return;
   const cards=[];
   for(const dish of data.dishes.slice(0,6)){
    if(dish.sponsored!==true || !Number.isSafeInteger(dish.dishId) || typeof dish.dishName!=='string')continue;
    const card=document.createElement('article');card.className='card panel';
    const badge=document.createElement('span');badge.className='badge';badge.textContent='Sponsored';
    const title=document.createElement('h3');title.textContent=dish.dishName;
    const details=document.createElement('p');details.className='mute';details.textContent=[dish.restaurant,dish.city,'₹'+dish.price,dish.vegetarian ? 'Vegetarian' : 'Non-vegetarian'].filter(Boolean).join(' · ');
    const address=document.createElement('p');address.className='small mute';address.textContent=dish.address || '';
    const note=document.createElement('p');note.className='small mute';note.textContent='Confirm current price, ingredients and availability with the restaurant.';
    card.append(badge,title,details,address,note);
    try{const url=new URL(dish.menuUrl);if(url.protocol==='https:' && !url.username && !url.password){
     const link=document.createElement('a');link.className='btn btn-light';link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='View menu';card.append(link);
    }}catch{}
    cards.push(card);
   }
   if(cards.length){list.replaceChildren(...cards);section.hidden=false;}
  }catch{/* Keep the section hidden when no verified paid listings can be loaded. */}
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
