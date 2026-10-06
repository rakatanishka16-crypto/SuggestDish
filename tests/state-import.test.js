const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),zlib=require('node:zlib');
const batch=JSON.parse(zlib.gunzipSync(fs.readFileSync(require('node:path').join(__dirname,'../api/source-batches/maharashtra-2026-10-06.json.gz'))));
const chains=require('../lib/chain-source-catalog'),register=require('../lib/source-catalog');
test('Maharashtra locator pagination reconciles identities and retains source facts',()=>{
 assert.equal(batch.businesses.length,133);
 assert.equal(batch.research_scope.locator_reported_outlets,133);
 assert.equal(batch.research_scope.locator_pagination_reconciled,true);
 assert.equal(batch.research_scope.complete_state_census,false);
 assert.equal(new Set(chains.businesses.map(b=>b.sourceKey)).size,chains.businesses.length);
 assert.equal(new Set(batch.businesses.filter(b=>b.source_store_id).map(b=>b.source_store_id)).size,batch.businesses.filter(b=>b.source_store_id).length);
 for(const b of batch.businesses){assert.equal(b.state,'Maharashtra');assert.ok(b.address);assert.ok(b.city);assert.ok(b.source_city);assert.equal(b.restaurant_rating,null);assert.equal(b.review_count,null);assert.equal(b.license_status,'not_checked');assert.equal(b.recommendation_eligible,false);assert.equal(b.retrieved_on,'2026-10-06');}
 assert.ok(batch.businesses.some(b=>b.city==='Aurangabad' && b.source_city.startsWith('Chhatrapati')));
});
test('Nagpur menu source belongs to its branch and absent prices remain unknown',()=>{
 const b=batch.businesses.find(b=>b.source_store_id==='163313');assert.ok(b);assert.equal(b.city,'Nagpur');
 const menu=chains.menuFor(b);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,133);
 for(const m of menu.menuItems){assert.equal(m.source_business_id,b.sourceKey);assert.match(m.source_url,/163313\/Menu$/);assert.equal(m.price_inr,null);assert.equal(m.recommendation_eligible,false);}
 const margherita=menu.menuItems.find(m=>m.name==='Margherita Ultimate Cheese');assert.equal(margherita.is_veg,true);
 const chicken=menu.menuItems.find(m=>m.name==='Chicken Sausage Ultimate Cheese');assert.equal(chicken.is_veg,false);
 const mallBatch=JSON.parse(zlib.gunzipSync(fs.readFileSync(require('node:path').join(__dirname,'../api/source-batches/maharashtra-mall-menus-2026-10-06.json.gz'))));
 const enriched=new Set(mallBatch.menu_associations.map(p=>p.sourceKey));
 for(const other of chains.businesses.filter(x=>batch.businesses.some(y=>y.sourceKey===x.sourceKey) && x.sourceKey!==b.sourceKey && !enriched.has(x.sourceKey)))assert.deepEqual(chains.menuFor(other),{menuScope:'none',menuItems:[]});
});
test('state queue keeps Maharashtra incomplete and Chennai within Tamil Nadu',()=>{
 const handlers={};register({get:(p,h)=>handlers[p]=h});let result;
 handlers['/api/import-progress']({}, {set(){},json(v){result=v;}});
 assert.equal(result.success,true);assert.equal(result.active_state,'Maharashtra');
 assert.deepEqual(result.state_order,['Maharashtra','Karnataka','Goa','Gujarat','Delhi','Haryana','Tamil Nadu']);
 assert.equal(result.complete_state_census,false);assert.equal(result.states[0].status,'in_progress');
 assert.ok(result.states.find(s=>s.state==='Tamil Nadu').city_priority.includes('Chennai'));
});
