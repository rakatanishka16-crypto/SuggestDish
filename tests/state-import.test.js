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
 enriched.add('official:sd-food-cd832e85898cd156a795');
 enriched.add('official:sd-food-583755cbec328a2285f5');
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

test('Chhatrapati Sambhajinagar open-data batch keeps source facts and uncertain records separate',()=>{
 const cityBatch=JSON.parse(zlib.gunzipSync(fs.readFileSync(require('node:path').join(__dirname,'../api/source-batches/chhatrapati-sambhajinagar-open-data-2026-10-12.json.gz'))));
 assert.equal(cityBatch.businesses.length,50);
 assert.equal(cityBatch.menu_items.length,0);
 assert.equal(cityBatch.complete_city_census,false);
 assert.equal(cityBatch.duplicate_candidates.length,2);
 assert.equal(cityBatch.deferred_source_ids.length,33);
 assert.equal(new Set(cityBatch.businesses.map(b=>b.sourceKey)).size,50);
 for(const b of cityBatch.businesses){
  assert.equal(b.city,'Chhatrapati Sambhajinagar');
  assert.equal(b.state,'Maharashtra');
  assert.equal(b.source_license,'ODbL-1.0');
  assert.equal(b.verification_status,'source_observed');
  assert.equal(b.operating_status,null);
  assert.equal(b.restaurant_rating,null);
  assert.equal(b.review_count,null);
  assert.equal(b.recommendation_eligible,false);
  assert.ok(Number.isFinite(b.latitude)&&Number.isFinite(b.longitude));
  assert.match(b.directions_url,/^https:\/\/www\.openstreetmap\.org\/directions\?/);
 }
});

test('deferred Sambhajinagar follow-up publishes unique identities and holds an uncertain chain match',()=>{
 const followup=JSON.parse(zlib.gunzipSync(fs.readFileSync(require('node:path').join(__dirname,'../api/source-batches/chhatrapati-sambhajinagar-deferred-2026-10-12.json.gz'))));
 assert.equal(followup.businesses.length,32);
 assert.equal(followup.menu_items.length,0);
 assert.equal(followup.held_records.length,0);
 assert.equal(followup.duplicate_candidates.length,1);
 assert.equal(followup.duplicate_candidates[0].source_id,'node/14089978918');
 assert.equal(followup.duplicate_candidates[0].automatic_merge,false);
 assert.equal(followup.deferred_source_ids.length,0);
 assert.equal(new Set(followup.businesses.map(b=>b.sourceKey)).size,32);
 assert.ok(!followup.businesses.some(b=>b.source_id==='node/14089978918'));
 for(const b of followup.businesses){
  assert.equal(b.source_license,'ODbL-1.0');
  assert.equal(b.operating_status,null);
  assert.equal(b.recommendation_eligible,false);
  assert.ok(Number.isFinite(b.latitude)&&Number.isFinite(b.longitude));
 }
});
