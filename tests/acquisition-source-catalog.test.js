const test=require('node:test'),assert=require('node:assert/strict');
const source=require('../lib/source-catalog'),acquisition=require('../lib/acquisition-source-catalog');
const handlers={};source({get:(p,h)=>handlers[p]=h});
function request(id){let body,status=200;handlers['/api/business-source']({query:{businessId:id}},{set(){},status(code){status=code;return this;},json(value){body=value;}});return {body,status};}
test('three Mumbai batch checkpoints publish every outlet through one stable source profile',()=>{
 const stats=acquisition.coverage();assert.equal(stats.outlets,197);assert.equal(stats.businesses,29);assert.equal(stats.dishes,6856);assert.equal(stats.neonImport,false);assert.deepEqual(stats.publication.unresolvedMatches,[]);
 assert.equal(acquisition.outletProfiles.size,197);assert.equal(new Set(acquisition.outletProfiles.values()).size,197);assert.equal(new Set(source.listingRows.map(b=>b.id)).size,source.listingRows.length);
 for(const [outlet,id] of acquisition.outletProfiles){const r=request(id);assert.equal(r.status,200);assert.equal(r.body.business.acquisition_outlet_id,outlet);assert.equal(r.body.business.address,acquisition.rawOutlets.get(outlet).full_address);}
});
test('dietary conflicts, variant ranges and testimonial scope cannot become confirmed recommendations',()=>{
 let ranges=0,conflicts=0;
 for(const [outlet,id] of acquisition.outletProfiles){const {body}=request(id);const o=acquisition.rawOutlets.get(outlet);assert.equal(body.business.currently_operating,o.currently_operating);
  for(const item of body.menuItems){assert.equal(item.recommendation_eligible,false);assert.ok(['not_confirmed','published_on_outlet_page'].includes(item.branch_availability));if(item.price_min_inr!=null){assert.equal(item.price_inr,null);assert.match(item.order_note,/variant range/);ranges++;}if(item.data_conflict){assert.equal(item.is_veg,null);conflicts++;}}
  if(o.brand_name==='Just Kerala')assert.equal(body.menuScope,'documented_references');
  if(o.brand_name==="Thepla House by Tejal's Kitchen"){assert.equal(body.menuScope,'brand_reference');assert.ok(body.menuItems.every(m=>m.source_business_id===null));assert.ok(body.menuItems.every(m=>(m.dish_signals || []).every(s=>s.confidence===null)));}
 }
 assert.equal(ranges,24);assert.equal(conflicts,18);
});
