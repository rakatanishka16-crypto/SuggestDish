const test=require('node:test'),assert=require('node:assert/strict');
const {load,batch}=require('../lib/mumbai-postal-import-scope');
const {plan,register}=require('../lib/catalogue-import');
const data=load(),p=plan(data);
test('postal import contains only seven exact 400001 profiles',()=>{
 assert.equal(data.businesses.length,7);assert.ok(data.businesses.every(b=>b.city==='Mumbai'&&b.postal_code==='400001'&&/400001/.test(b.address)));
 assert.equal(new Set(data.businesses.map(b=>b.sourceKey)).size,7);
 assert.equal(data.businesses.find(b=>b.brand==='Sequel').sourceKey,'open:osm_node_8084252878');
});
test('49 priced foods retain evidence; 14 unknown diets never promote',()=>{
 assert.equal(data.menuItems.filter(i=>i.price_inr!=null).length,49);
 assert.equal(p.summary.promotionDishes,35);assert.equal(p.summary.promotionOutlets,1);
 assert.equal(p.summary.heldAssociations.unknown_diet,14);
 assert.equal(p.summary.observations,189);
 assert.ok(p.outlets[0].dishes.every(d=>typeof d.isVeg==='boolean'&&d.price>0&&d.payload.veg_evidence&&d.payload.source_page));
});
test('unpriced Portal and Malvaan items do not become priced recommendations',()=>{
 assert.equal(p.summary.heldAssociations.missing_explicit_price,42);
 assert.ok(data.menuItems.filter(i=>['Portal Restaurant','Malvaan Samudhra'].includes(i.brand)).every(i=>i.price_inr===null));
});
test('seafood and egg facts take precedence over appealing menu names',()=>{
 const item=n=>data.menuItems.find(i=>i.name===n);
 assert.equal(item('Avo Halloumi and Pomelo Salad').is_veg,false);
 assert.equal(item('Almond & Coconut Pancakes').veg_nonveg,'egg');
 assert.equal(item('Flourless Dark Chocolate Coffee Cake').is_veg,false);
 assert.equal(item('The Sequel Tartine').is_veg,true);
 assert.match(item('Chickpea, Goat Cheese, Bell Pepper Sandwich').dietary_note,/withheld/);
});
test('unknown pins, ratings and effective dates remain unknown',()=>{
 assert.ok(data.businesses.every(b=>b.latitude===null&&b.longitude===null&&b.restaurant_rating===null&&b.review_count===null));
 assert.ok(data.menuItems.every(i=>i.price_effective_date===null&&i.branch_availability==='not_confirmed'));
 assert.equal(batch.research_scope.completeCityCensus,false);
});
test('postal endpoint authenticates, plans read-only and rejects wrong snapshot',async()=>{
 let h;register({post:(path,fn)=>h=fn},{env:{SOURCE_CATALOG_IMPORT_KEY:'x'.repeat(40)},load:()=>{throw Error('Full catalogue must not load');},connect:()=>{throw Error('Must not connect');}});
 const res={status(n){this.code=n;return this;},json(b){this.body=b;return this;}};
 await h({headers:{},body:{scope:batch.batch_id}},res);assert.equal(res.code,403);
 const headers={authorization:'Bearer '+'x'.repeat(40)};
 await h({headers,body:{scope:batch.batch_id,stage:'plan'}},res);assert.equal(res.body.promotionDishes,35);
 await h({headers,body:{scope:batch.batch_id,stage:'publish',digest:'wrong'}},res);assert.equal(res.code,409);
});
