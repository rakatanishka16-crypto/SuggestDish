const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path');
const chains=require('../lib/chain-source-catalog');
const data=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches/mumbai-official-breakfast-tiffin-2026-10-13.json.gz'))));
const items=Object.values(data.menu_sets).flatMap(s=>s.items);
test('official batch has 2 distinct outlets and 47 priced observations',()=>{
 assert.equal(data.businesses.length,2);assert.equal(items.length,47);assert.equal(new Set(items.map(i=>i.external_id)).size,47);
 for(const b of data.businesses){assert.equal(chains.businesses.filter(x=>x.sourceKey===b.sourceKey).length,1);const menu=chains.menuFor(b);assert.equal(menu.menuScope,'outlet_page');assert.ok(menu.menuItems.every(i=>i.source_business_id===b.sourceKey));}
});
test('breakfast prices and portions remain explicit and Mumbai scoped',()=>{
 const b=data.businesses.find(b=>b.brand==='Breakfast Kitchen');const menu=chains.menuFor(b).menuItems;
 assert.equal(menu.length,31);assert.equal(menu.find(i=>i.name==='Poha').price_inr,138);
 assert.deepEqual(menu.filter(i=>i.name==='Spicy Missal Pao').map(i=>[i.price_inr,i.portion]),[[149,'with 2 pao']]);
 assert.deepEqual(menu.filter(i=>i.name==='Puri Bhaji').map(i=>[i.price_inr,i.portion]),[[147,'with 3 puris']]);assert.equal(b.city,'Mumbai');
});
test('unknown diets, price dates, coordinates and personal contacts are not invented',()=>{
 for(const i of items){assert.equal(i.is_veg,null);assert.equal(i.veg_nonveg,null);assert.equal(i.price_effective_date,null);assert.equal(i.tax_included,null);assert.equal(i.recommendation_eligible,false);assert.equal(i.publish_ready,false);assert.ok(Number.isFinite(i.price_inr)&&i.price_inr>0);assert.equal(i.retrieved_on,'2026-10-13');assert.ok(!/swiggy|zomato|reddit/.test(i.source_url));}
 for(const b of data.businesses){assert.equal(b.phone,null);assert.equal(b.email,null);assert.equal(b.latitude,null);assert.equal(b.longitude,null);assert.equal(b.restaurant_rating,null);assert.equal(b.review_count,null);}
 const b=data.businesses.find(b=>b.locality==='Malad West');assert.equal(b.address_precision,'locality_only');
});
test('ambiguous oyster mushroom prices retain review flags and distinct portions',()=>{
 const variants=items.filter(i=>i.name==='Oyster Mushroom');assert.equal(variants.length,2);
 assert.deepEqual(variants.map(i=>[i.price_inr,i.portion]),[[250,null],[180,'6pcs']]);assert.ok(variants.every(i=>i.data_conflict&&i.notes.includes('Review before import')&&i.recommendation_eligible===false));
});
test('menu alternatives stay grouped rather than becoming invented priced dishes',()=>{
 assert.equal(items.filter(i=>i.name==='Stuffed Parantha').length,1);assert.equal(items.filter(i=>i.name==='Eggs To Order').length,1);assert.ok(items.find(i=>i.name==='Eggs To Order').notes.includes('One listed price'));
});
