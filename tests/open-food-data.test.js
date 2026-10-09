const test=require('node:test'),assert=require('node:assert/strict');
const open=require('../lib/open-food-data'),source=require('../lib/source-catalog');
function call(path,query={}){let body,status=200;const handlers={};source({get:(p,h)=>handlers[p]=h});handlers[path]({query},{set(){},status(n){status=n;return this;},json(x){body=x;}});return {body,status};}
test('open data directory profiles preserve identities, licence and unknown status without vocabulary menus',()=>{
 assert.equal(open.businesses.length,1993);assert.equal(new Set(open.businesses.map(b=>b.sourceKey)).size,1993);
 for(const b of open.businesses){
  assert.equal(b.existingBusinessId,'osm:'+b.source_id);assert.match(b.attribution,/OpenStreetMap contributors/);assert.equal(b.restaurant_rating,null);assert.equal(b.operating_status,null);assert.equal(b.recommendation_eligible,false);
  const r=call('/api/business-source',{businessId:b.sourceKey});assert.equal(r.status,200);assert.equal(r.body.menuScope,'none');assert.deepEqual(r.body.menuItems,[]);
 }
});
test('Wikidata vocabulary stays separate, paginated and without outlet or price claims',()=>{
 const r=call('/api/dish-vocabulary');assert.equal(r.body.total,208);assert.equal(r.body.items.length,20);assert.equal(r.body.outletAvailabilityConfirmed,false);
 for(const item of open.snapshot.vocabulary){assert.equal(item.outlet_id,null);assert.equal(item.price,null);assert.equal(item.license,'CC0-1.0');}
 assert.equal(call('/api/dish-vocabulary',{limit:100}).status,400);
 assert.equal(call('/api/dish-vocabulary',{q:'gulab'}).body.items.some(r=>r.dish_name==='gulab jamun'),true);
});
test('adapted OSM dataset is downloadable and uncertain duplicates are held without merging',()=>{
 const r=call('/api/open-food-data/export');assert.equal(r.body.businesses.length,1993);assert.equal(r.body.held_records.length,83);assert.equal(r.body.duplicate_candidates.length,37);
 assert.ok(r.body.duplicate_candidates.every(d=>d.automatic_merge===false));assert.equal(source.coverage.menuEntries,13684);assert.equal(source.coverage.publishedPrices,5962);
});

test("food-shop profiles retain observed raw categories rather than inferred restaurant types",()=>{
 const evidence=require("../api/source-batches/mumbai-osm-food-shop-tags-2026-10-09.json");assert.equal(Object.keys(evidence).length,6);
 for(const [id,e] of Object.entries(evidence)){const b=open.businesses.find(b=>b.source_id===id);assert.ok(b);assert.equal(b.category,e.category);assert.equal(b.name,e.evidence_tags.name);assert.equal(b.recommendation_eligible,false);}
});

test("fresh food-shop collection pass preserves counters and unique identities",()=>{
 const p=open.snapshot.food_shop_collection_pass;assert.equal(p.added,187);assert.deepEqual(p.districts,[7964376,7964375]);assert.deepEqual(p.failures,[]);assert.equal(p.new_unique_objects,205);assert.equal(open.snapshot.input_records,2113);assert.equal(new Set(open.businesses.map(b=>b.source_id)).size,1993);
});
