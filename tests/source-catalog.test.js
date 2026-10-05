const test=require('node:test'),assert=require('node:assert/strict'),register=require('../lib/source-catalog');
const batch=require('../api/source-batches/mumbai-2026-10-04.json');
function request(id){let handler,status=200,result;register({get:(p,h)=>{if(p==='/api/business-source')handler=h;}});handler({query:{businessId:id}},{set(){},status(c){status=c;return this;},json(d){result=d;}});return {status,result};}
test('catalog exposes only source-checked business profiles and rejects unknown identifiers',()=>{
 assert.equal(request("x'; DROP TABLE").status,400);assert.equal(request('official:sd-mumbai-'+'0'.repeat(20)).status,404);
 for(const b of batch.businesses) assert.equal(request(b.sourceKey).result.business.name,b.name);
 assert.equal('research_leads' in batch,false);
});
test('brand menus are kept separate from branch availability and budget recommendations',()=>{
 const b=batch.businesses.find(b=>b.name==='Oye Kake'),r=request(b.sourceKey);assert.equal(r.result.menuItems.length,24);
 for(const m of r.result.menuItems){assert.equal(m.price_inr,null);assert.equal(m.branch_availability,'not_confirmed');assert.equal(m.tax_included,null);}
 assert.match(r.result.notice,/not owner verification/);
});
test('source facts have no guessed licences, ratings or coordinates and preserve real menu price units',()=>{
 assert.equal(batch.businesses.length,73);assert.equal(batch.menu_items.length,512);
 for(const b of batch.businesses){assert.equal(b.license_status,'not_checked');assert.equal(b.restaurant_rating,null);assert.equal(b.latitude,null);assert.ok(b.address);for(const u of b.source_urls)assert.equal(new URL(u).protocol,'https:');}
 const m=batch.menu_items.find(m=>m.name==='Kadai Paneer');assert.equal(m.price_inr,399);assert.equal(m.portion,'500 ml');assert.equal(m.is_veg,true);
});

test('expanded catalog preserves menu variants, source dietary labels, and read-only eligibility',()=>{
 assert.equal(new Set(batch.businesses.map(b=>b.sourceKey)).size,batch.businesses.length);
 assert.equal(new Set(batch.menu_items.map(m=>m.external_id)).size,batch.menu_items.length);
 const pizza=batch.menu_items.filter(m=>m.brand==='PizzaExpress');assert.equal(pizza.length,130);
 assert.equal(pizza.find(m=>m.name==='American Pizza').is_veg,false);
 assert.equal(pizza.find(m=>m.name==='Margherita Pizza').is_veg,true);
 assert.ok(pizza.every(m=>m.price_inr===null));
 const thepla=batch.menu_items.filter(m=>m.brand==="Thepla House by Tejal's Kitchen");assert.equal(thepla.length,248);
 assert.deepEqual(thepla.filter(m=>m.name==='Methi Thepla - Vacuum Pack of 5 Piece').map(m=>m.price_inr).sort(),[122,137]);
 assert.equal(batch.menu_items.find(m=>m.name==='Lagan Nu Custard Tart').is_veg,null);
 for(const m of batch.menu_items){assert.equal(m.recommendation_eligible,false);assert.ok(m.price_inr===null || (Number.isFinite(m.price_inr)&&m.price_inr>0));}
});
test('coverage exposes honest counts without publishing unresolved research leads',()=>{
 const handlers={};register({get:(path,h)=>handlers[path]=h});let result;handlers['/api/data-coverage']({}, {set(){},json(d){result=d;}});
 assert.equal(result.completeCityCensus,false);assert.equal(result.businessProfiles,402);assert.equal(result.menuEntries,896);assert.equal(result.publishedPrices,632);assert.equal(result.researchLeadsChecked,127);assert.equal(result.licencesVerified,0);assert.equal('leads' in result,false);
});

const expansion=require('../api/source-batches/food-outlets-2026-10-05.json');
test('bakery catalog preserves priced variants, source locations and unknown regular cake ingredients',()=>{
 assert.equal(expansion.businesses.length,329);assert.equal(expansion.menu_items.length,384);
 const variants=expansion.menu_items.filter(m=>m.name==='Belgian Chocolate Cake');
 assert.ok(variants.some(m=>m.portion==='0.5 KG / Eggless' && m.price_inr===1550 && m.is_veg===true));
 assert.ok(variants.some(m=>m.portion==='0.5 KG / Regular' && m.price_inr===1550 && m.is_veg===null));
 for(const b of expansion.businesses){assert.equal(b.license_status,'not_checked');assert.equal(b.restaurant_rating,null);assert.ok(b.address);assert.equal(request(b.sourceKey).status,200);}
 for(const m of expansion.menu_items){assert.equal(m.branch_availability,'not_confirmed');assert.equal(m.recommendation_eligible,false);assert.ok(m.price_inr>0);}
 assert.equal(new Set([...batch.menu_items,...expansion.menu_items].map(m=>m.external_id)).size,batch.menu_items.length+expansion.menu_items.length);
});
