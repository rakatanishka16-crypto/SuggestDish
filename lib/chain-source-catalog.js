const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
// Fixed snapshots, included as function assets. No request URL can select a file.
const snapshots=['chain-outlets-2026-10-05.json.gz','remaining-chain-outlets-2026-10-05.json.gz','viral-food-outlets-2026-10-05.json.gz','food-gap-outlets-2026-10-05.json.gz','maharashtra-2026-10-06.json.gz','maharashtra-mall-menus-2026-10-06.json.gz','maharashtra-local-official-2026-10-08.json.gz'].map(file=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches',file))).toString('utf8')));
const snapshot={businesses:snapshots.flatMap(s=>s.businesses),menu_sets:Object.assign({},...snapshots.map(s=>s.menu_sets)),batch_id:snapshots.map(s=>s.batch_id).join('+'),retrieved_on:snapshots.map(s=>s.retrieved_on).sort().at(-1),research_scope:{batches:snapshots.map(s=>({batchId:s.batch_id,...s.research_scope})),brand_counts:snapshots.flatMap(s=>s.businesses).reduce((counts,b)=>(counts[b.brand]=(counts[b.brand]||0)+1,counts),{})}};
const menuSets=snapshot.menu_sets;
// Add menus to existing profiles without duplicating outlets or implying a
// national reference is a branch menu. Fail closed on broken associations.
for(const patch of snapshots.flatMap(s=>s.menu_associations || [])) {
 const business=snapshot.businesses.find(b=>b.sourceKey===patch.sourceKey);
 const set=menuSets[patch.outlet_menu_set_id || patch.reference_menu_set_id];
 if(!business || business.brand!==patch.brand || !set || set.brand!==business.brand)throw new Error('Invalid source menu enrichment');
 const scoped=Boolean(patch.outlet_menu_set_id);
 if(set.kind!==(scoped?'outlet_page':'brand_reference'))throw new Error('Invalid source menu scope');
 delete business.outlet_menu_set_id;delete business.reference_menu_set_id;
 business[scoped?'outlet_menu_set_id':'reference_menu_set_id']=patch.outlet_menu_set_id || patch.reference_menu_set_id;
 business.menu_status=scoped?'outlet_page_observed':'brand_reference_only';
}
const businessKeys=new Set(snapshot.businesses.map(b=>b.sourceKey));
const menuItems=Object.values(menuSets).flatMap(set=>set.items);
function menuFor(business){
 const id=business.outlet_menu_set_id || business.reference_menu_set_id;
 if(!id)return businessKeys.has(business.sourceKey) ? {menuScope:'none',menuItems:[]} : null;
 const set=menuSets[id];
 if(!set || set.brand!==business.brand)throw new Error('Invalid outlet menu association');
 const scoped=set.kind==='outlet_page';
 return {menuScope:set.kind,menuItems:set.items.map(item=>({...item,source_url:scoped ? (set.source_url || business.source_urls[0]) : item.source_url,source_business_id:scoped ? business.sourceKey : null})),menuNotice:scoped ? 'Items observed on this outlet’s published menu page. Prices are shown only where published; current stock and final prices require confirmation.' : 'National brand menu reference. Availability and prices at this outlet have not been confirmed.'};
}
module.exports={businesses:snapshot.businesses,menuItems,menuFor,batchId:snapshot.batch_id,checkedOn:snapshot.retrieved_on,researchScope:snapshot.research_scope};
