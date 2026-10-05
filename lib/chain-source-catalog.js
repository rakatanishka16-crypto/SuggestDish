const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
// A fixed snapshot, included as a function asset. No request URL can select a file.
const snapshot=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches/chain-outlets-2026-10-05.json.gz'))).toString('utf8'));
const menuSets=snapshot.menu_sets;
const businessKeys=new Set(snapshot.businesses.map(b=>b.sourceKey));
const menuItems=Object.values(menuSets).flatMap(set=>set.items);
function menuFor(business){
 const id=business.outlet_menu_set_id || business.reference_menu_set_id;
 if(!id)return businessKeys.has(business.sourceKey) ? {menuScope:'none',menuItems:[]} : null;
 const set=menuSets[id];
 if(!set || set.brand!==business.brand)throw new Error('Invalid outlet menu association');
 const scoped=set.kind==='outlet_page';
 return {menuScope:set.kind,menuItems:set.items.map(item=>({...item,source_url:scoped ? business.source_urls[0] : item.source_url,source_business_id:scoped ? business.sourceKey : null})),menuNotice:scoped ? 'Items and prices published on this outlet’s official page. Current stock and final prices still require confirmation.' : 'National brand menu reference. Availability and prices at this outlet have not been confirmed.'};
}
module.exports={businesses:snapshot.businesses,menuItems,menuFor,batchId:snapshot.batch_id,checkedOn:snapshot.retrieved_on,researchScope:snapshot.research_scope};
