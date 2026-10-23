'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const batch=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches/mumbai-official-menu-expansion-2026-10-23.json.gz'))));
const sudama=require('./mumbai-sudama-import-scope');
const scope=batch.batch_id;
const keys=new Set(batch.businesses.map(b=>b.sourceKey));
const updates=new Map(batch.menu_items.map(m=>[m.external_id,m]));
function load(data=batch){
 if(data.businesses.length!==2||data.businesses.some(b=>!keys.has(b.sourceKey)||b.city!=='Mumbai'||!b.address))throw Error('Invalid Mumbai outlet scope');
 if(data.menu_items.length!==496||new Set(data.menu_items.map(m=>m.external_id)).size!==496)throw Error('Incomplete Mumbai menu observations');
 for(const m of data.menu_items){
  if(!keys.has(m.source_business_id)||m.retrieved_on!=='2026-10-23')throw Error('Unrelated or undated menu item');
  const url=m.source_business_id===sudama.sourceKey?sudama.batch.menu_items[0].source_url:'https://lasanazaarcafe.com/';
  if(m.source_url!==url)throw Error('Unexpected menu source');
  if(m.recommendation_eligible&&(!m.veg_evidence||typeof m.is_veg!=='boolean'||!Number.isFinite(m.price_inr)||m.price_inr<=0||m.data_conflict))throw Error('Missing price or dietary evidence');
 }
 return {businesses:data.businesses,menuItems:data.menu_items,menuFor:b=>({menuScope:'outlet_page',menuItems:data.menu_items.filter(m=>m.source_business_id===b.sourceKey)})};
}
function enrichProfiles(businesses){
 const overrides=new Map(batch.businesses.map(b=>[b.sourceKey,b]));
 for(const key of keys)if(!businesses.some(b=>b.sourceKey===key))throw Error('Missing existing Mumbai source profile');
 return businesses.map(b=>overrides.has(b.sourceKey)?{...b,...overrides.get(b.sourceKey)}:b);
}
function mergeItems(items){return [...items.filter(m=>!updates.has(m.external_id)),...batch.menu_items];}
function menuFor(b){
 if(!keys.has(b.sourceKey))return null;
 return {menuScope:'outlet_page',menuItems:[...(b.sourceKey===sudama.sourceKey?sudama.batch.menu_items:[]),...batch.menu_items.filter(m=>m.source_business_id===b.sourceKey)],menuNotice:'Official outlet menu observations. Dietary labels come from explicit source sections or variant labels; unknowns and conflicting prices remain held. Current prices and availability require restaurant confirmation.'};
}
module.exports={batch,scope,load,enrichProfiles,mergeItems,menuFor};
