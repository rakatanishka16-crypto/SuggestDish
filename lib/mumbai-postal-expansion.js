'use strict';
const batch = JSON.parse(require('node:zlib').gunzipSync(require('node:fs').readFileSync(require('node:path').join(__dirname,'../api/source-batches/mumbai-400001-expansion-2026-10-14.json.gz'))).toString('utf8'));
function load() {
 const businesses = batch.businesses;
 if (businesses.length !== 6 || new Set(businesses.map(b=>b.sourceKey)).size !== 6 || businesses.some(b=>b.city!=='Mumbai'||b.postal_code!=='400001')) throw Error('Invalid postal expansion scope');
 const menuFor = b => {
  const set = batch.menu_sets[b.outlet_menu_set_id || b.reference_menu_set_id];
  if (!set) return {menuScope:'none',menuItems:[]};
  if (set.brand!==b.brand || set.items.some(i=>set.kind==='outlet_page'?i.source_business_id!==b.sourceKey:i.source_business_id!==null)) throw Error('Invalid branch menu association');
  return {menuScope:set.kind,menuItems:set.items,menuNotice:b.service_note};
 };
 const menuItems = businesses.flatMap(b=>menuFor(b).menuItems);
 if (menuItems.length!==211 || new Set(menuItems.map(i=>i.external_id)).size!==211) throw Error('Incomplete postal expansion');
 return {businesses,menuItems,menuFor};
}
module.exports={batch,load};
