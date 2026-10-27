'use strict';
const batch=JSON.parse(require('node:zlib').gunzipSync(require('node:fs').readFileSync(require('node:path').join(__dirname,'../api/source-batches/jalna-priced-menus-2026-10-27.json.gz'))).toString('utf8'));
const byKey=new Map(batch.businesses.map(b=>[b.sourceKey,b]));
const itemsByKey=new Map();
for(const item of batch.menu_items){const rows=itemsByKey.get(item.source_business_id)||[];rows.push(item);itemsByKey.set(item.source_business_id,rows);}
function apply(existing){
 const result=existing.map(b=>({...b})),known=new Map(result.map(b=>[b.sourceKey,b]));
 for(const entry of batch.businesses){
  const current=known.get(entry.sourceKey);
  if(current){
   // Keep the earlier identity, coordinates, licence facts and owner evidence.
   current.menu_source_urls=[...new Set([...entry.menu_source_urls,...(current.menu_source_urls||[])])];
   for(const key of ['menu_provider','menu_upstream_source','menu_upstream_url','menu_source_updated_at','menu_retrieved_on','menu_attribution'])current[key]=entry[key];
  }else{const added={...entry};result.push(added);known.set(added.sourceKey,added);}
 }
 return result;
}
function menuFor(business){
 const entry=byKey.get(business.sourceKey);if(!entry)return null;
 return {menuScope:'outlet_observed',menuItems:itemsByKey.get(business.sourceKey)||[],menuProvider:entry.menu_provider,menuUpstreamSource:entry.menu_upstream_source,menuUpstreamUrl:entry.menu_upstream_url,menuSourceUpdatedAt:entry.menu_source_updated_at,menuRetrievedOn:entry.menu_retrieved_on,menuNotice:entry.menu_attribution+' Source updated: '+(entry.menu_source_updated_at||'not supplied')+'. Retrieved: '+entry.menu_retrieved_on+'. Confirm current prices, ingredients and availability with the outlet.'};
}
module.exports={batch,apply,menuFor};
