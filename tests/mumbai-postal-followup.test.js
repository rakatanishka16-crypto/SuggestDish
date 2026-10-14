const test=require('node:test'),assert=require('node:assert/strict');
const {load,batch}=require('../lib/mumbai-postal-followup');
const {plan,register}=require('../lib/catalogue-import');
const d=load(),p=plan(d);
test('scope has four 400001 profiles and retains three existing identities',()=>{
 assert.equal(d.businesses.length,4);assert.ok(d.businesses.every(b=>b.city==='Mumbai'&&b.postal_code==='400001'));
 for(const key of batch.research_scope.existing_identities_retained)assert.ok(d.businesses.some(b=>b.sourceKey===key));
 assert.equal(batch.research_scope.new_source_profiles,1);
});
test('only 103 exact Fort food SKUs promote from 337 evidence records',()=>{
 assert.equal(d.menuItems.length,337);assert.equal(p.summary.promotionDishes,103);assert.equal(p.summary.observations,573);
 assert.equal(p.outlets.length,1);assert.equal(p.outlets[0].business.brand,'Theobroma');
 assert.equal(p.summary.heldAssociations.source_conflict,67);
 for(const x of p.outlets[0].dishes){assert.equal(x.payload.source_outlet_id,'9920');assert.equal(x.payload.source_active,true);assert.equal(x.payload.source_out_of_stock,false);assert.ok(x.price>0&&typeof x.isVeg==='boolean');}
});
test('selectable combos, inactive products and unpriced references stay out',()=>{
 const keys=new Set(p.outlets.flatMap(o=>o.dishes.map(i=>i.key)));
 for(const i of d.menuItems)if(i.hold_reason||i.price_inr===null||i.brand!=='Theobroma')assert.ok(!keys.has(i.external_id));
 assert.equal(d.menuItems.filter(i=>i.price_inr===null).length,167);
 assert.ok(d.menuItems.filter(i=>i.brand==='Oye Kake').every(i=>i.source_business_id===null&&i.price_inr===null));
 assert.ok(d.menuItems.filter(i=>i.brand==='Pizza Hut').every(i=>i.price_inr===null));
});
test('beverages, non-food merchandise, recipes, customer data and ratings are omitted',()=>{
 assert.ok(d.menuItems.every(i=>!['Beverages','Cake Add-Ons','Theobroma Collectibles'].includes(i.menu_category)));
 for(const i of d.menuItems)for(const key of ['description','reviews','orders_count','image','nutrition','customer','token','rating'])assert.ok(!Object.hasOwn(i,key));
 assert.deepEqual(batch.research_scope.excluded_source_rows,{'Beverages':16,'Cake Add-Ons':18,'Theobroma Collectibles':9});
});
test('source pins and diet labels have exact branch provenance; unknowns stay unknown',()=>{
 const b=d.businesses.find(b=>b.brand==='Theobroma');assert.equal(b.latitude,18.9302517);assert.equal(b.longitude,72.8321193);
 const unknown=d.businesses.find(b=>b.brand==='Sbarro');assert.equal(unknown.address,null);assert.equal(unknown.latitude,null);
 for(const i of d.menuItems.filter(i=>i.brand==='Theobroma')){assert.equal(i.is_veg,i.source_diet_label==='veg');assert.equal(i.tax_included,false);}
 assert.ok(d.menuItems.every(i=>i.branch_availability==='not_confirmed'&&i.price_effective_date===null));
});
test('authenticated plan is isolated and snapshot digest is required for writes',async()=>{
 let h;register({post:(_p,f)=>h=f},{env:{SOURCE_CATALOG_IMPORT_KEY:'x'.repeat(40)},load:()=>{throw Error('Unrelated full catalogue');},connect:()=>{throw Error('Must not connect');}});
 const r={status(n){this.code=n;return this;},json(x){this.body=x;return this;}};
 await h({headers:{},body:{scope:batch.batch_id}},r);assert.equal(r.code,403);
 const headers={authorization:'Bearer '+'x'.repeat(40)};
 await h({headers,body:{scope:batch.batch_id,stage:'plan'}},r);assert.equal(r.body.promotionDishes,103);
 await h({headers,body:{scope:batch.batch_id,stage:'publish',digest:'wrong'}},r);assert.equal(r.code,409);
});
