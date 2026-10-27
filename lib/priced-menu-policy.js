'use strict';
const scopes=new Set(['outlet_page','outlet_observed']);
function itemsFor(business,menu){
 if(!menu||!scopes.has(menu.menuScope))return [];
 return (menu.menuItems||[]).filter(item=>{
  if(item.source_business_id!==business.sourceKey||!item.name||!Number.isFinite(item.price_inr)||item.price_inr<=0||item.price_inr>100000||item.data_conflict)return false;
  if(item.price_min_inr!=null||item.price_max_inr!=null)return false;
  try{const url=new URL(item.source_url);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}
 });
}
function metadata(business,menu){
 const items=itemsFor(business,menu);
 return {hasPricedMenu:items.length>0,pricedMenuCount:items.length,pricedMenuItems:items.slice(0,3).map(m=>({name:m.name,price:m.price_inr,portion:m.portion||null,sourceUrl:m.source_url})),pricedMenuUrl:items[0]?.source_url||null};
}
module.exports={itemsFor,metadata};
