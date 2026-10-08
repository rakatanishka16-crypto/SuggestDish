const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),zlib=require('zlib');
const batch=JSON.parse(zlib.gunzipSync(fs.readFileSync('api/source-batches/maharashtra-local-official-2026-10-08.json.gz')));
const source=require('../lib/source-catalog'),handlers={};source({get:(p,h)=>handlers[p]=h});
function request(id){let status=200,body;handlers['/api/business-source']({query:{businessId:id}},{set(){},status(c){status=c;return this;},json(x){body=x;}});return {status,body};}
test('five official local branches publish without inventing operation or dietary facts',()=>{
 assert.equal(batch.businesses.length,5);assert.equal(new Set(source.listingRows.map(b=>b.id)).size,source.listingRows.length);
 for(const b of batch.businesses){const r=request(b.sourceKey);assert.equal(r.status,200);assert.equal(r.body.business.address,b.address);assert.equal(b.currently_operating,null);assert.equal(b.restaurant_rating,null);assert.equal(b.license_status,'not_checked');for(const m of r.body.menuItems){assert.equal(m.source_business_id,b.sourceKey);assert.equal(m.is_veg,null);assert.equal(m.recommendation_eligible,false);}}
});
test('half/full handi prices retain separate observed variants and template hotel menus stay withheld',()=>{
 const chul=request(batch.businesses.find(b=>b.brand==='Hotel Chul').sourceKey).body;assert.equal(chul.menuItems.length,5);assert.deepEqual(chul.menuItems.filter(m=>m.name==='Champaran Mutton').map(m=>[m.portion,m.price_inr]),[['Half',900],['Full',1800]]);
 const hotel=request(batch.businesses.find(b=>b.brand==='Grand Madhuram Restaurant').sourceKey).body;assert.equal(hotel.menuItems.length,0);assert.equal(hotel.business.data_conflict,true);
 assert.equal(batch.research_scope.published_prices,5);assert.equal(batch.research_scope.menu_entries,20);
});
test('dish-only source batches do not introduce empty business records',()=>{
 assert.ok(source.listingRows.every(b=>b.id&&b.sourceUrl));assert.equal(request("x'; DROP TABLE").status,400);
});
