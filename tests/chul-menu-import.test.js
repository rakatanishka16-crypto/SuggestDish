const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path');
const chains=require('../lib/chain-source-catalog');
const batch=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches/sambhajinagar-chul-priced-menu-2026-10-13.json.gz'))));
const key='official:sd-food-13ce8839d72d9bf20b4d';
const branch=chains.businesses.find(b=>b.sourceKey===key);
const items=chains.menuFor(branch).menuItems;
test('Chul enrichment keeps one existing outlet and historical source records',()=>{
 assert.equal(chains.businesses.filter(b=>b.sourceKey===key).length,1);
 assert.equal(batch.businesses.length,0);
 assert.equal(items.length,153);
 assert.equal(new Set(items.map(i=>i.name)).size,134);
 assert.equal(new Set(items.map(i=>i.name+'|'+i.portion)).size,153);
 const original=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches/maharashtra-local-official-2026-10-08.json.gz'))));
 assert.equal(Object.values(original.menu_sets).find(s=>s.brand==='Hotel Chul').items.length,5);
 for(const item of items){assert.equal(item.source_business_id,key);assert.equal(item.source_url,'https://chul.in/menu');assert.equal(item.tax_included,false);assert.equal(item.recommendation_eligible,false);assert.ok(item.price_inr>0);}
});
test('exact portions remain separate and ambiguous diet markers stay unknown',()=>{
 const rice=items.filter(i=>i.name==='Jeera Rice');
 assert.deepEqual(rice.map(i=>[i.portion,i.price_inr]),[['Half',100],['Full',190]]);
 assert.equal(items.find(i=>i.name==='Paneer Chilli').is_veg,true);
 const chicken=items.find(i=>i.name==='Chicken Chilli');
 assert.equal(chicken.source_diet_marker,'https://schema.org/OmnivorousDiet');assert.equal(chicken.is_veg,null);
 assert.ok(!items.some(i=>i.menu_category==='Beverages'));
});
test('conflicting signature and detailed-menu prices cannot be treated as confirmed',()=>{
 const conflict=items.filter(i=>i.name==='Shevga Handi');
 assert.equal(conflict.length,2);
 for(const item of conflict){assert.equal(item.data_conflict,true);assert.equal(item.publish_ready,false);assert.equal(item.recommendation_eligible,false);assert.match(item.notes,/450.*460\/.*730/);}
});
