const test=require('node:test'),assert=require('node:assert/strict'),register=require('../lib/source-catalog');
const batch=require('../api/source-batches/mumbai-2026-10-04.json');
function request(id){let handler,status=200,result;register({get:(p,h)=>handler=h});handler({query:{businessId:id}},{set(){},status(c){status=c;return this;},json(d){result=d;}});return {status,result};}
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
 assert.equal(batch.businesses.length,25);assert.equal(batch.menu_items.length,53);
 for(const b of batch.businesses){assert.equal(b.license_status,'not_checked');assert.equal(b.restaurant_rating,null);assert.equal(b.latitude,null);assert.ok(b.address);for(const u of b.source_urls)assert.equal(new URL(u).protocol,'https:');}
 const m=batch.menu_items.find(m=>m.name==='Kadai Paneer');assert.equal(m.price_inr,399);assert.equal(m.portion,'500 ml');assert.equal(m.is_veg,true);
});
