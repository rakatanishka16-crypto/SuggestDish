'use strict';
const batch=JSON.parse(require('node:zlib').gunzipSync(require('node:fs').readFileSync(require('node:path').join(__dirname,'../api/source-batches/jalna-menu-listings-2026-10-26.json.gz'))).toString('utf8'));
function apply(existing){
 const result=existing.map(b=>({...b})),byKey=new Map(result.map(b=>[b.sourceKey,b]));
 for(const entry of batch.businesses){
  const matched=entry.matched_source_key&&byKey.get(entry.matched_source_key);
  if(entry.matched_source_key&&!matched)throw Error('Missing matched Jalna source profile: '+entry.matched_source_key);
  if(matched){
   // Directory evidence supplements a known profile; it never replaces its identity,
   // coordinates, owner status, official sources or transcribed menu.
   matched.menu_source_urls=[...new Set([...(matched.menu_source_urls||[]),...entry.menu_source_urls])];
   matched.directory_listing_checked_on=batch.retrieved_on;
   matched.directory_attribution=batch.attribution;
  }else{result.push({...entry});byKey.set(entry.sourceKey,entry);}
 }
 return result;
}
function menuFor(b){
 if(!b.sourceKey.startsWith('directory:jalna-menu-'))return null;
 return {menuScope:'external_link',menuItems:[],menuNotice:'An online menu listing was found. Its dishes, prices and dietary preparation have not been transcribed or independently verified.'};
}
module.exports={batch,apply,menuFor};
