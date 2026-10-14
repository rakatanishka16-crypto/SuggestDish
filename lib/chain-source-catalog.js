const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
// Fixed snapshots, included as function assets. No request URL can select a file.
const snapshots=['mumbai-pizzahut-r-mall-menu-2026-10-13.json.gz','mumbai-official-cafe-food-2026-10-13.json.gz','mumbai-official-breakfast-tiffin-2026-10-13.json.gz','chain-outlets-2026-10-05.json.gz','remaining-chain-outlets-2026-10-05.json.gz','viral-food-outlets-2026-10-05.json.gz','food-gap-outlets-2026-10-05.json.gz','maharashtra-2026-10-06.json.gz','maharashtra-mall-menus-2026-10-06.json.gz','maharashtra-mall-menu-followup-2026-10-12.json.gz','maharashtra-mall-menu-followup-2-2026-10-12.json.gz','maharashtra-mall-menu-followup-3-2026-10-12.json.gz','maharashtra-mall-menu-followup-4-2026-10-12.json.gz','maharashtra-mall-menu-followup-5-2026-10-13.json.gz','maharashtra-mall-menu-followup-6-2026-10-13.json.gz','maharashtra-mall-menu-followup-7-2026-10-13.json.gz','maharashtra-mall-menu-followup-8-2026-10-13.json.gz','maharashtra-mall-menu-followup-9-2026-10-13.json.gz','maharashtra-mall-menu-followup-10-2026-10-13.json.gz','maharashtra-mall-menu-followup-11-2026-10-13.json.gz','maharashtra-mall-menu-followup-12-2026-10-13.json.gz','maharashtra-mall-menu-followup-13-2026-10-13.json.gz','maharashtra-mall-menu-followup-14-2026-10-13.json.gz','maharashtra-mall-menu-followup-15-2026-10-13.json.gz','maharashtra-mall-menu-followup-16-2026-10-13.json.gz','maharashtra-mall-menu-followup-17-2026-10-13.json.gz','maharashtra-thane-official-followup-18-2026-10-13.json.gz','maharashtra-local-official-2026-10-08.json.gz','maharashtra-kolhapur-official-2026-10-08.json.gz','maharashtra-nashik-official-2026-10-08.json.gz','sambhajinagar-chul-priced-menu-2026-10-13.json.gz'].map(file=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches',file))).toString('utf8')));
snapshots.unshift(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches/amravati-belgian-waffle-locator-2026-10-14.json.gz'))).toString('utf8')));
snapshots.unshift(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches/vashi-haldirams-duplicate-reconciliation-2026-10-14.json.gz'))).toString('utf8')));
snapshots.unshift(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches/malad-haldirams-locator-2026-10-14.json.gz'))).toString('utf8')));
snapshots.unshift(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches/pune-haldirams-seasons-duplicate-reconciliation-2026-10-14.json.gz'))).toString('utf8')));
snapshots.unshift(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches/mumbai-pizzahut-phoenix-kurla-menu-2026-10-14.json.gz'))).toString('utf8')));
const snapshot={businesses:snapshots.flatMap(s=>s.businesses),menu_sets:Object.assign({},...snapshots.map(s=>s.menu_sets)),batch_id:snapshots.map(s=>s.batch_id).join('+'),retrieved_on:snapshots.map(s=>s.retrieved_on).sort().at(-1),research_scope:{batches:snapshots.map(s=>({batchId:s.batch_id,...s.research_scope})),brand_counts:snapshots.flatMap(s=>s.businesses).reduce((counts,b)=>(counts[b.brand]=(counts[b.brand]||0)+1,counts),{})}};
snapshot.businesses=snapshot.businesses.map(b=>Object.prototype.hasOwnProperty.call(b,'fssai_license_number')?b:{...b,fssai_license_number:null});
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
for(const patch of snapshots.flatMap(s=>s.business_enrichments || [])) {
 const business=snapshot.businesses.find(b=>b.sourceKey===patch.sourceKey);
 if(!business || business.brand!==patch.brand || business.city!==patch.city)throw new Error('Invalid source business enrichment');
 Object.assign(business,patch.fields);
}
for(const exclusion of snapshots.flatMap(s=>s.business_exclusions || [])) {
 const duplicate=snapshot.businesses.find(b=>b.sourceKey===exclusion.sourceKey);
 const canonical=snapshot.businesses.find(b=>b.sourceKey===exclusion.canonical_source_key);
 if(!duplicate || !canonical || duplicate.brand!==canonical.brand || duplicate.phone!==canonical.phone)throw new Error('Invalid source business exclusion');
 snapshot.businesses=snapshot.businesses.filter(b=>b.sourceKey!==exclusion.sourceKey);
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
