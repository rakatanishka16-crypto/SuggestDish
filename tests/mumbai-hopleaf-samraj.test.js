const test=require('node:test'),assert=require('node:assert/strict');
const batch=require('../api/source-batches/mumbai-hopleaf-samraj-2026-10-14.json');
const chains=require('../lib/chain-source-catalog');
const {load}=require('../lib/mumbai-menu-import-scope');
const {plan,register}=require('../lib/catalogue-import');
const data=load(),p=plan(data);
test('scoped import contains only 130 new rows at the two exact Mumbai outlets',()=>{
 assert.equal(data.businesses.length,2);assert.equal(data.menuItems.length,130);
 assert.ok(data.businesses.every(b=>b.city==='Mumbai'));
 assert.deepEqual(p.outlets.map(o=>o.dishes.length).sort((a,b)=>a-b),[28,85]);
 assert.equal(p.summary.promotionDishes,113);assert.equal(p.summary.observations,262);
 assert.equal(p.summary.heldAssociations.source_conflict,17);
});
test('Hopleaf enrichment retains every original item identity and price',()=>{
 const fs=require('node:fs'),zlib=require('node:zlib');
 const old=JSON.parse(zlib.gunzipSync(fs.readFileSync(require('node:path').join(__dirname,'../api/source-batches/mumbai-official-cafe-food-2026-10-13.json.gz'))));
 const b=old.businesses.find(b=>b.brand.startsWith('Hopleaf'));
 const current=chains.businesses.filter(x=>x.sourceKey===b.sourceKey);
 assert.equal(current.length,1);const menu=chains.menuFor(current[0]);assert.equal(menu.menuItems.length,128);
 for(const prior of old.menu_sets[b.outlet_menu_set_id].items){const next=menu.menuItems.find(m=>m.external_id===prior.external_id);assert.equal(next.price_inr,prior.price_inr);assert.equal(next.name,prior.name);assert.ok(!data.menuItems.some(m=>m.external_id===prior.external_id));}
});
test('pizza and sizzler categories cannot become misleading standalone curries',()=>{
 const rows=data.menuItems.filter(m=>m.menu_category==='PIZZA - THIN CRUST');
 assert.equal(rows.length,6);assert.ok(rows.every(m=>/pizza/i.test(m.name)));
 assert.match(rows.find(m=>m.source_name==='PANEER TIKKA(J)').name,/Pizza/);
 assert.ok(data.menuItems.filter(m=>m.menu_category==='SIZZLERS').every(m=>/sizzler/i.test(m.name)));
});
test('explicit dietary sections supply Samraj flags and ambiguous rows never promote',()=>{
 const rows=data.menuItems.filter(m=>m.brand==='Hotel Samraj');assert.equal(rows.length,38);
 for(const m of rows){assert.equal(m.is_veg,!m.menu_category.includes('Non-Vegetarian'));assert.ok(m.veg_evidence.includes('hotelsamraj.com/hotelsamrajmenu?'));}
 const promoted=new Set(p.outlets.flatMap(o=>o.dishes.map(d=>d.key)));
 for(const m of data.menuItems){assert.ok(m.price_inr>0);assert.equal(m.retrieved_on,'2026-10-14');assert.equal(m.branch_availability,'not_confirmed');assert.equal(m.price_effective_date,null);if(m.verification_status.includes('needs_review'))assert.ok(!promoted.has(m.external_id));}
});
test('unknown coordinates stay unknown and no social rating or stock is invented',()=>{
 for(const b of data.businesses){assert.equal(b.latitude,null);assert.equal(b.longitude,null);assert.equal(b.restaurant_rating,null);assert.equal(b.review_count,null);}
 assert.equal(new Set(data.menuItems.map(m=>m.external_id)).size,130);
});
test('scoped endpoint plan is read only and unknown scope is rejected',async()=>{
 let h;register({post:(path,fn)=>h=fn},{env:{SOURCE_CATALOG_IMPORT_KEY:'x'.repeat(40)},load:()=>{throw Error('Full catalogue must not load');},connect:()=>{throw Error('Must not connect');}});
 const res={status(n){this.code=n;return this;},json(b){this.body=b;return this;}};
 const headers={authorization:'Bearer '+'x'.repeat(40)};
 await h({headers,body:{scope:batch.batch_id,stage:'plan'}},res);assert.equal(res.body.success,true);assert.equal(res.body.promotionDishes,113);
 await h({headers,body:{scope:'unrelated'}},res);assert.equal(res.code,400);
 await h({headers,body:{scope:batch.batch_id,stage:'publish',digest:'wrong'}},res);assert.equal(res.code,409);
});
test('full and scoped plans have separate caches and cannot reuse a digest',async()=>{
 let h;register({post:(path,fn)=>h=fn},{env:{SOURCE_CATALOG_IMPORT_KEY:'x'.repeat(40)},load:()=>({businesses:[],menuItems:[],menuFor:()=>null}),connect:()=>{throw Error('Must not connect');}});
 const res={status(n){this.code=n;return this;},json(b){this.body=b;return this;}};const headers={authorization:'Bearer '+'x'.repeat(40)};
 await h({headers,body:{stage:'plan'}},res);const fullDigest=res.body.digest;
 await h({headers,body:{scope:batch.batch_id,stage:'plan'}},res);assert.notEqual(fullDigest,res.body.digest);
 await h({headers,body:{scope:batch.batch_id,stage:'publish',digest:fullDigest}},res);assert.equal(res.code,409);
});
