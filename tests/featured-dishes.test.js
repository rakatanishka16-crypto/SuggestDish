const test=require('node:test'),assert=require('node:assert/strict'),register=require('../lib/featured-dishes');
const now=Date.parse('2026-10-12T12:00:00Z');
const row={plan:'monthly',amount:49900,currency:'INR',keyId:'rzp_live_example',paymentStatus:'captured',startsAt:'2026-10-01T00:00:00Z',endsAt:'2026-11-01T00:00:00Z',claimStatus:'approved',revisionStatus:'approved',submissionStatus:'approved',slot:2,dishId:10,dishName:'Paneer Tikka',restaurant:'Example Restaurant',price:200,vegetarian:true};
test('only an active captured live paid plan can feature a reviewed owner dish',()=>{
 assert.equal(register.eligible(row,now),true);
 for(const change of [{keyId:'rzp_test_example'},{paymentStatus:'refunded'},{paymentStatus:'created'},{endsAt:'2026-10-12T12:00:00Z'},{startsAt:'2026-10-13T00:00:00Z'},{endsAt:null},{plan:'free'},{plan:'constructor'},{amount:1},{currency:'USD'},{slot:3},{slot:0},{claimStatus:'pending'},{revisionStatus:'pending'},{submissionStatus:'rejected'},{price:null},{vegetarian:null}]){
  assert.equal(register.eligible({...row,...change},now),false,JSON.stringify(change));
 }
});
test('annual plan features two slots, with no monthly-slot carryover',()=>{
 const annual={...row,plan:'annual',amount:499900,slot:2};
 assert.equal(register.eligible(annual,now),true);
 assert.equal(register.eligible({...annual,slot:3},now),false);
});
async function call(sql){let handler,status=200,body;register({get:(path,fn)=>{assert.equal(path,'/api/featured-dishes');handler=fn;}},sql);await handler({}, {set(){},status(n){status=n;return this;},json(data){body=data;return this;}});return {status,body};}
test('empty paid inventory returns no catalogue fallback',async()=>{
 const result=await call(async()=>[]);assert.deepEqual(result,{status:200,body:{success:true,dishes:[]}});
});
test('feature responses exclude payment secrets and owner contact data',async()=>{
 const current={...row,startsAt:'2020-01-01T00:00:00Z',endsAt:'2099-01-01T00:00:00Z',email:'private@example.com',accessCode:'private-code'};
 const result=await call(async()=>[current,{...current,keyId:'rzp_test_example'}]);
 assert.equal(result.body.dishes.length,1);assert.equal(result.body.dishes[0].sponsored,true);
 for(const key of ['keyId','email','accessCode','startsAt','endsAt','paymentStatus'])assert.equal(key in result.body.dishes[0],false);
});
test('database errors hide featured inventory without leaking details',async()=>{
 const result=await call(async()=>{throw Error('private database credentials');});
 assert.equal(result.status,503);assert.equal(JSON.stringify(result).includes('credentials'),false);
});
