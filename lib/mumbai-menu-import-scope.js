'use strict';
const batch=require('../api/source-batches/mumbai-hopleaf-samraj-2026-10-14.json');
function load(){
 const chains=require('./chain-source-catalog');
 const keys=new Set(batch.research_scope.target_source_keys);
 const ids=new Set(batch.research_scope.new_item_ids);
 const businesses=chains.businesses.filter(b=>keys.has(b.sourceKey));
 if(businesses.length!==2)throw Error('Missing target Mumbai outlet');
 const menuFor=b=>{const menu=chains.menuFor(b);if(!menu||menu.menuScope!=='outlet_page')throw Error('Missing target outlet menu');return {...menu,menuItems:menu.menuItems.filter(i=>ids.has(i.external_id))};};
 const menuItems=businesses.flatMap(b=>menuFor(b).menuItems);
 if(menuItems.length!==130||new Set(menuItems.map(m=>m.external_id)).size!==130)throw Error('Incomplete Mumbai menu batch');
 return {businesses,menuItems,menuFor};
}
module.exports={load};
