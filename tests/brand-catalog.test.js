const test=require('node:test'),assert=require('node:assert/strict'),register=require('../lib/brand-catalog');
function run(query={}){let handler,body,status=200;register({get:(path,h)=>handler=h});handler({query},{set(){},status(n){status=n;return this;},json(d){body=d;}});return {status,body};}
test('brand references never become verified outlets or recommendation data',()=>{
 const r=run();assert.equal(r.body.total,58);assert.equal(new Set(r.body.brands.map(b=>b.id)).size,58);
 for(const b of r.body.brands){assert.equal(b.ownerVerified,false);assert.equal(b.outletCoverageConfirmed,false);assert.equal(b.menuCoverageConfirmed,false);assert.equal(b.recommendationEligible,false);assert.ok(!('price' in b));for(const u of b.sourceUrls)assert.equal(new URL(u).protocol,'https:');}
});
test('franchise filters retain paused applications and distinguish company-owned chains',()=>{
 const network=run({model:'franchise_network'}).body.brands;
 assert.ok(!network.some(b=>b.name==='Chai Kings' || b.name==='The Pizza Bakery' || b.name==='McDonald’s'));
 assert.match(network.find(b=>b.name==='Naturals Ice Cream').enquiryStatus,/paused/);
 assert.equal(run({model:'company_operated'}).body.count,2);
 assert.equal(run({q:'Domino',category:'Pizza'}).body.brands[0].operatingModel,'master_or_regional_operator');
 assert.match(run({q:'Wow! Momo'}).body.brands[0].note,/historical/);
 assert.match(run({q:'Dunkin'}).body.brands[0].note,/31 December 2026/);
 for(const query of [{q:['bad']},{q:'x'.repeat(101)},{category:'made-up'},{model:'all_verified'}])assert.equal(run(query).status,400);
});
