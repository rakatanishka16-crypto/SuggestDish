const test=require('node:test'),assert=require('node:assert/strict');
const {distanceKm,queryOrigin}=require('../lib/outlet-distance');
test('outlet distances preserve unknown coordinates and use kilometres',()=>{
  const origin={latitude:0,longitude:0};
  assert.equal(distanceKm(origin,{latitude:0,longitude:0}),0);
  assert.ok(Math.abs(distanceKm(origin,{latitude:0,longitude:1})-111.19)<0.02);
  assert.equal(distanceKm(origin,{latitude:null,longitude:null}),null);
  assert.equal(distanceKm(null,{latitude:19,longitude:73}),null);
  assert.equal(distanceKm(origin,{latitude:91,longitude:0}),null);
});
test('distance requests require a complete valid coordinate pair',()=>{
  assert.equal(queryOrigin({}),null);
  assert.deepEqual(queryOrigin({lat:'19',lon:'73'}),{latitude:19,longitude:73});
  for(const query of [{lat:'19'},{lat:'',lon:'73'},{lat:'NaN',lon:'73'},{lat:'19',lon:181},{lat:['19'],lon:'73'}])assert.throws(()=>queryOrigin(query));
});
