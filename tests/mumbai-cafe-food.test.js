const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const chains=require('../lib/chain-source-catalog');
const data=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches/mumbai-official-cafe-food-2026-10-13.json.gz'))));
const items=Object.values(data.menu_sets).flatMap(s=>s.items);
test('three exact Mumbai outlet menus contain 299 distinct priced foods',()=>{
 assert.equal(data.businesses.length,3);assert.equal(items.length,299);
 assert.equal(new Set(items.map(i=>i.external_id)).size,299);
 for(const b of data.businesses){const m=chains.menuFor(b);assert.equal(m.menuScope,'outlet_page');assert.ok(m.menuItems.every(i=>i.source_business_id===b.sourceKey&&i.brand===b.brand));}
});
test('diet evidence, taxes, menu age and location uncertainty are retained',()=>{
 for(const i of items){assert.equal(i.is_veg,true);assert.ok(i.veg_evidence.startsWith('https://'));assert.ok(i.price_inr>0);assert.equal(i.price_effective_date,null);assert.equal(i.branch_availability,'not_confirmed');}
 const ep=items.filter(i=>i.brand==='Epilicious Cafe & Cakes');assert.equal(ep.length,35);assert.ok(ep.every(i=>i.notes.includes('2025')));
 const waffles=ep.filter(i=>i.menu_category==='Waffles');assert.equal(waffles.length,6);assert.ok(waffles.every(i=>i.price_inr===160&&i.notes.includes('Shared section price')));
 assert.equal(ep.find(i=>i.name==='Cheese Garlic Bread').price_inr,125);assert.equal(ep.find(i=>i.name==='Cheese Chilli Toast').price_inr,150);
 for(const b of data.businesses.filter(b=>b.brand!=='Celebration 365 Pure Veg Family Restaurant')){assert.equal(b.latitude,null);assert.equal(b.longitude,null);}
 assert.equal(data.businesses.find(b=>b.brand.startsWith('Celebration')).latitude,19.2351266305);
});
test('Celebration food rows exclude beverages and preserve menu prices',()=>{
 const rows=items.filter(i=>i.brand.startsWith('Celebration'));assert.equal(rows.length,228);assert.ok(rows.every(i=>i.menu_category!=='Beverages'&&i.tax_included===false));
 assert.equal(rows.find(i=>i.name==='Idli Sambar').price_inr,135);
 assert.equal(data.research_scope.excluded_beverages,19);
});
test('new menus produce 299 eligible import candidates without conflicts',()=>{
 const p=require('../lib/catalogue-import').plan({businesses:data.businesses,menuItems:items,menuFor:b=>chains.menuFor(b)});
 assert.equal(p.summary.promotionOutlets,3);assert.equal(p.summary.promotionDishes,299);assert.equal(p.summary.heldAssociations.duplicate_or_conflicting_dish,0);
 assert.equal(p.outlets.find(o=>o.business.brand==='Hopleaf Restobar & Lounge').dishes.length,36);
});
