'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const expansion=require('../lib/mumbai-oct23-menu-scope');
const importer=require('../lib/catalogue-import');
test('Mumbai expansion promotes only explicit outlet prices and supported dietary labels',()=>{
 const p=importer.plan(expansion.load());
 assert.equal(p.summary.promotionOutlets,2);assert.equal(p.summary.promotionDishes,347);
 assert.equal(p.summary.heldAssociations.unknown_diet,140);assert.equal(p.summary.heldAssociations.source_conflict,9);
 const cafe=p.outlets.find(o=>o.business.name==='La Sanazaar Cafe');assert.equal(cafe.dishes.length,212);
 assert.ok(cafe.dishes.some(d=>d.isVeg===false));assert.ok(cafe.dishes.some(d=>d.isVeg===true));
 assert.ok(!cafe.dishes.some(d=>d.price===8888||d.price===0||d.name==='Seafood Hor Fun veg'||/Eggless/.test(d.payload.menu_category)));
 assert.ok(cafe.dishes.find(d=>d.name==='Sweet Corn (Vegetarian Soup) (Plate)').isVeg);
 const hotel=p.outlets.find(o=>o.business.brand==='Sudama All Veg');assert.equal(hotel.dishes.length,135);
 assert.ok(hotel.dishes.every(d=>d.isVeg===true&&d.payload.source_page>=3&&d.payload.source_page<=14));
 assert.ok(!hotel.dishes.some(d=>d.name==='Corn Cheese Balls'||/Neer Dosa/.test(d.name)));
 assert.ok(p.outlets.every(o=>o.business.city==='Mumbai'&&o.business.latitude===null&&o.business.longitude===null));
});
test('Mumbai scope rejects changed cities, unrelated sources, incomplete menus and unsupported dietary flags',()=>{
 for(const mutate of [d=>d.businesses[0].city='Jalna',d=>d.menu_items.pop(),d=>d.menu_items[0].source_url='https://example.com/menu',d=>d.menu_items[0].veg_evidence=null,d=>d.menu_items[0].is_veg=null]){
  const d=structuredClone(expansion.batch);mutate(d);assert.throws(()=>expansion.load(d));
 }
});
test('Mumbai scoped endpoint is authenticated, digest-bound and never imports the full catalogue',async()=>{
 let handler;const key='x'.repeat(40);
 importer.register({post:(path,fn)=>handler=fn},{env:{SOURCE_CATALOG_IMPORT_KEY:key},load:()=>{throw Error('Full catalogue forbidden');},connect:()=>{throw Error('No database connection expected');}});
 const res={status(n){this.code=n;return this;},json(data){this.body=data;return this;}};
 await handler({headers:{},body:{scope:expansion.scope}},res);assert.equal(res.code,403);
 const headers={authorization:'Bearer '+key};
 await handler({headers,body:{scope:expansion.scope,stage:'plan'}},res);assert.equal(res.body.promotionDishes,347);
 await handler({headers,body:{scope:expansion.scope,stage:'publish',digest:'wrong'}},res);assert.equal(res.code,409);
});
test('Mumbai source enrichment reuses both profiles and retains earlier Sudama dosa variants',()=>{
 const catalog=require('../lib/source-catalog');
 for(const b of expansion.batch.businesses){
  assert.equal(catalog.importData.businesses.filter(row=>row.sourceKey===b.sourceKey).length,1);
  const menu=catalog.importData.menuFor(b);assert.equal(menu.menuScope,'outlet_page');
  assert.equal(menu.menuItems.length,b.brand==='Sudama All Veg'?148:361);
  assert.equal(new Set(menu.menuItems.map(m=>m.external_id)).size,menu.menuItems.length);
 }
 const original=require('../lib/mumbai-sudama-import-scope');
 for(const m of original.batch.menu_items)assert.ok(catalog.importData.menuFor(original.batch.businesses[0]).menuItems.some(row=>row.external_id===m.external_id));
});
