const test=require('node:test'),assert=require('node:assert/strict');
const {batch,load}=require('../lib/mumbai-postal-expansion');
const {plan,register}=require('../lib/catalogue-import');
const d=load(),p=plan(d);
test('only the six reviewed Mumbai 400001 identities are in scope',()=>{
 assert.equal(d.businesses.length,6);assert.equal(d.menuItems.length,211);
 assert.ok(d.businesses.every(b=>b.city==='Mumbai'&&b.postal_code==='400001'));
 assert.ok(d.businesses.some(b=>b.sourceKey==='listing:sd-mumbai-fountain-sizzlers-fort-20261007'));
});
test('51 KMC dishes promote; shared Raju prices and all unpriced dishes remain evidence',()=>{
 assert.equal(p.summary.promotionDishes,51);assert.equal(p.summary.observations,362);
 assert.equal(p.outlets.length,1);assert.equal(p.outlets[0].business.brand,'KMC Bar & Bistro');
 assert.equal(d.menuItems.filter(i=>i.brand==='Raju Ki Chai').length,52);
 assert.ok(d.menuItems.filter(i=>i.brand==='Raju Ki Chai').every(i=>i.source_business_id===null&&i.is_veg===null&&i.tax_included===true));
 assert.equal(p.summary.heldAssociations.unknown_diet,3);
});
test('alcohol desserts stay out and category/diet evidence survives',()=>{
 const names=p.outlets[0].dishes.map(i=>i.name);
 assert.ok(!names.includes('Kahlua Mousse')&&!names.includes('KMC Tiramisu'));
 assert.ok(p.outlets[0].dishes.some(i=>i.name==='Broken Tortilla'&&!i.isVeg&&i.payload.veg_nonveg==='egg'));
 assert.ok(p.outlets[0].dishes.filter(i=>i.payload.menu_category==='Veg Plates').every(i=>i.isVeg));
});
test('pins, source prices and preparation notes are retained without recipe text',()=>{
 const b=p.outlets[0].business;assert.equal(b.latitude,18.937483);assert.equal(b.longitude,72.8338696);
 assert.ok(p.outlets[0].dishes.every(i=>i.payload.service_charge_percent===10&&i.payload.tax_included===false));
 assert.equal(p.outlets[0].dishes.find(i=>i.name==='Skillet Cookie').payload.source_preparation_minutes,25);
 for(const i of d.menuItems)for(const k of ['description','rating','reviews','image_url','token'])assert.ok(!Object.hasOwn(i,k));
});
test('Malvaan item codes never become prices and previous highlights remain',()=>{
 const m=d.menuItems.filter(i=>i.brand==='Malvaan Samudhra');assert.ok(m.length>60);
 assert.ok(m.every(i=>i.price_inr===null));
 assert.ok(m.some(i=>i.name==='Rawa Fry Rawas (Boneless)'));
 assert.ok(m.some(i=>i.name==='Prawns'&&i.menu_category==='Malvani Ghee Roast'));
});
test('new scope fails closed and digest is required before any writes',async()=>{
 let handler;register({post:(_p,f)=>handler=f},{env:{SOURCE_CATALOG_IMPORT_KEY:'x'.repeat(40)},connect:()=>{throw Error('No connection should occur');},load:()=>{throw Error('No unrelated import');}});
 const r={status(n){this.code=n;return this},json(x){this.body=x;return this}};
 await handler({headers:{},body:{scope:batch.batch_id}},r);assert.equal(r.code,403);
 const headers={authorization:'Bearer '+'x'.repeat(40)};
 await handler({headers,body:{scope:batch.batch_id,stage:'plan'}},r);assert.equal(r.body.promotionDishes,51);
 await handler({headers,body:{scope:batch.batch_id,stage:'publish',digest:'wrong'}},r);assert.equal(r.code,409);
});
test('catalogue resolves the new scope and does not duplicate Fountain source identity',()=>{
 const c=require('../lib/source-catalog').importData;
 const b=c.businesses.find(b=>b.sourceKey===p.outlets[0].business.sourceKey);
 assert.equal(c.menuFor(b).menuItems.length,56);
 const key='listing:sd-mumbai-fountain-sizzlers-fort-20261007';assert.equal(c.businesses.filter(b=>b.sourceKey===key).length,1);
});
