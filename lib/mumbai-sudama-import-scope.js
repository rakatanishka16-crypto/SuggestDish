'use strict';
const batch=require('../api/source-batches/mumbai-sudama-dosa-2026-10-23.json');
const sourceKey='official:sd-mumbai-sudama-krishna-palace-20261023';
function load(data=batch){
 const businesses=data.businesses,menuItems=data.menu_items;
 if(businesses.length!==1||businesses[0].sourceKey!==sourceKey||businesses[0].city!=='Mumbai'||!businesses[0].address.includes('96/98, Sleater Road')||menuItems.length!==13||new Set(menuItems.map(m=>m.external_id)).size!==13)throw Error('Invalid Sudama outlet/menu scope');
 for(const m of menuItems)if(m.source_business_id!==sourceKey||m.source_url!=='https://www.krishnapalaceresidency.com/mumbai/facilities/pdf/sudama-a-la-carte-menu-august-23.pdf'||m.source_page!==3||m.is_veg!==true||!m.veg_evidence||m.publish_ready!==true||m.recommendation_eligible!==true||!Number.isFinite(m.price_inr)||m.price_inr<=0)throw Error('Missing Sudama menu evidence');
 return {businesses,menuItems,menuFor:b=>{if(b.sourceKey!==sourceKey)throw Error('Unrelated outlet');return {menuScope:'outlet_page',menuItems};}};
}
module.exports={batch,load,sourceKey};
