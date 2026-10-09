const test=require('node:test'),assert=require('node:assert/strict'),register=require('../lib/business-directory');
async function run(query,rows=[]){let handler,body,status=200;const calls=[];register({get:(p,h)=>handler=h},async(s,...v)=>{calls.push({q:s.join('?'),v});return rows;});await handler({query},{set(){},status(n){status=n;return this;},json(d){body=d;}});return {status,body,calls};}
test('directory bounds pagination and rejects unknown categories',async()=>{for(const query of [{offset:-1},{limit:100},{category:'invented'},{q:'a'.repeat(101)}]){const r=await run(query);assert.equal(r.status,400);assert.equal(r.calls.length,0);}});
test('directory binds and escapes user search text without exposing contacts',async()=>{const r=await run({q:"%_'; DROP TABLE Restaurant",category:'bakery'},[{name:'Bakery',matchCount:1,reviewStatus:'unverified'}]);assert.equal(r.status,200);assert.doesNotMatch(r.calls[0].q,/DROP TABLE/);assert.match(r.calls[0].v[1],/\\%\\_/);assert.equal('matchCount' in r.body.businesses[0],false);assert.equal(r.body.hasMore,false);});
test('directory returns optional straight-line distance without guessing missing pins',async()=>{
 const r=await run({lat:'19',lon:'73'},[{name:'Pinned bakery',latitude:19,longitude:73,matchCount:2},{name:'Unknown pin',latitude:null,longitude:null,matchCount:2}]);
 assert.equal(r.body.businesses[0].distanceKm,0);assert.equal(r.body.businesses[0].distanceBasis,'straight_line');assert.equal(r.body.businesses[1].distanceKm,null);
 const invalid=await run({lat:'19'});assert.equal(invalid.status,400);assert.equal(invalid.calls.length,0);
});
test('city searches do not mistake a road name for the outlet city',async()=>{
 const r=await run({city:'Jalna'});assert.match(r.calls[0].q,/AND city ILIKE/);assert.doesNotMatch(r.calls[0].q,/city ILIKE \? OR COALESCE\(address/);assert.match(r.calls[0].q,/COALESCE\(s.city,e.city\) AS city/);
});
test('OSM profile metadata survives directory responses and canonical candidate identity is matched',async()=>{
 const b=require('../lib/open-food-data').businesses[0];
 const r=await run({city:'Mumbai'},[{id:b.existingBusinessId,name:b.name,sourceProfileId:b.sourceKey,matchCount:1,latitude:b.latitude,longitude:b.longitude}]);
 assert.equal(r.body.businesses[0].sourceLicense,'ODbL-1.0');assert.match(r.body.businesses[0].attribution,/OpenStreetMap contributors/);
 const bound=JSON.parse(r.calls[0].v[0]).find(row=>row.id===b.sourceKey);assert.equal(bound.existingBusinessId,b.existingBusinessId);
});
