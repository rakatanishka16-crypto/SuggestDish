const test=require('node:test'),assert=require('node:assert/strict');
const batch=require('../api/source-batches/jalna-district-open-data-2026-10-10.json');
const catalog=require('../lib/source-catalog');
test('district map observations preserve location provenance and do not invent menus',()=>{
 assert.equal(batch.businesses.length,5);assert.equal(batch.held_records.length,3);assert.equal(batch.duplicate_candidates.length,0);
 let handler;catalog({get:(path,fn)=>{if(path==='/api/business-source')handler=fn;}});
 for(const b of batch.businesses){
  assert.equal(b.district,'Jalna');assert.equal(b.source_license,'ODbL-1.0');assert.ok(b.attribution);assert.equal(b.operating_status,null);assert.equal(b.restaurant_rating,null);assert.equal(b.recommendation_eligible,false);
  assert.ok(catalog.listingRows.some(x=>x.id===b.sourceKey&&x.existingBusinessId==='osm:'+b.source_id));
  let result;handler({query:{businessId:b.sourceKey}},{set(){},json(x){result=x;}});assert.equal(result.menuScope,'none');assert.deepEqual(result.menuItems,[]);
 }
 assert.equal(batch.businesses.filter(b=>b.city!==null).length,1);assert.equal(batch.businesses[0].city,'ambad');
 assert.ok(batch.held_records.find(x=>x.source_id==='node/7771689120'));
});
