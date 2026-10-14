'use strict';
const batch=require('../api/source-batches/mumbai-400001-followup-2026-10-14.json');
function load(){
 const businesses=batch.businesses;
 if(businesses.length!==4||new Set(businesses.map(b=>b.sourceKey)).size!==4||businesses.some(b=>b.city!=='Mumbai'||b.postal_code!=='400001'))throw Error('Invalid postal follow-up scope');
 const menuFor=b=>{
  const set=batch.menu_sets[b.outlet_menu_set_id||b.reference_menu_set_id];
  if(!set)return {menuScope:'none',menuItems:[]};
  if(set.brand!==b.brand||set.items.some(i=>set.kind==='outlet_page'?i.source_business_id!==b.sourceKey:i.source_business_id!==null))throw Error('Invalid menu association');
  return {menuScope:set.kind,menuItems:set.items,menuNotice:b.service_note};
 };
 const menuItems=businesses.flatMap(b=>menuFor(b).menuItems);
 if(menuItems.length!==337||new Set(menuItems.map(i=>i.external_id)).size!==337)throw Error('Incomplete follow-up');
 return {businesses,menuItems,menuFor};
}
module.exports={batch,load};
