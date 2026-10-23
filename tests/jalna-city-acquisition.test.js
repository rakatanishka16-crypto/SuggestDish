'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const batch=require('../api/source-batches/jalna-city-government-official-2026-10-23.json');
const catalog=require('../lib/source-catalog');
test('Jalna city directory additions retain government provenance without inventing priced menus',()=>{
 const government=batch.businesses.filter(b=>b.source_types.includes('government_website'));
 assert.equal(government.length,27);
 assert.equal(batch.held_records.length,10);
 assert.equal(new Set(batch.businesses.map(b=>b.sourceKey)).size,31);
 assert.deepEqual(batch.menu_items,[]);
 for(const b of batch.businesses){
  assert.equal(b.city,'Jalna');assert.equal(b.latitude,null);assert.equal(b.longitude,null);
  assert.equal(b.recommendation_eligible,false);assert.equal(b.operating_status,null);
  assert.ok(catalog.listingRows.some(row=>row.id===b.sourceKey));
  assert.equal(catalog.importData.menuFor(b).menuItems.length,0);
 }
 for(const b of government){assert.ok(Number.isInteger(b.source_plate_allocation));assert.equal(b.price_inr,undefined);}
 const official=batch.businesses.filter(b=>b.source_types.includes('business_website'));
 assert.deepEqual(official.map(b=>b.existingBusinessId).sort(),['restaurant:14','restaurant:30','restaurant:54','restaurant:6']);
});
test('Jalna acquisition report and original OSM export remain separate',()=>{
 const routes=new Map();catalog({get:(path,handler)=>routes.set(path,handler)});
 let report,osm;
 routes.get('/api/jalna-acquisition')({}, {set(){},json(value){report=value;}});
 routes.get('/api/open-food-data/jalna-export')({}, {set(){},json(value){osm=value;}});
 assert.equal(report.batch_id,batch.batch_id);assert.equal(report.research_summary.new_priced_dishes,0);
 assert.equal(osm.batch_id,'jalna-district-open-data-2026-10-10');
 assert.equal(osm.dataset_license,'ODbL-1.0');
});
