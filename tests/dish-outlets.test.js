const test=require('node:test'),assert=require('node:assert/strict');
const register=require('../lib/source-catalog'),chains=require('../lib/chain-source-catalog');
const routes={};register({get:(p,h)=>routes[p]=h});
function request(query={},path='/api/dish-outlets'){let body,status=200;routes[path]({query},{set(){},status(n){status=n;return this},json(d){body=d;return this}});return {body,status};}
test('all 100 curated dishes resolve reviewed menu IDs to real catalog outlets',()=>{
 const result=request().body;assert.equal(result.dishes.length,100);assert.equal(result.coverage.dishesWithMenuMatches,100);assert.equal(result.coverage.measuredRanking,false);assert.equal(result.coverage.availabilityConfirmed,false);
 for(const dish of result.dishes){const response=request({dishId:String(dish.id)}).body;assert.ok(response.total>0,dish.name);for(const outlet of response.outlets){assert.ok(outlet.address);assert.equal(outlet.availabilityConfirmed,false);assert.ok(outlet.menuItems.length);assert.ok(outlet.menuItems.every(m=>m.source_url && m.external_id));}}
});
test('preparation-specific matches cannot confuse vegetable noodles, chicken 65 or shawarma',()=>{
 const noodles=request({dishId:'46'}).body;assert.ok(noodles.outlets.every(b=>b.menuItems.every(m=>m.name==='Veg.Hakka Noodles')));
 const chicken=request({dishId:'54'}).body;assert.ok(chicken.outlets.every(b=>b.menuItems.every(m=>m.name==='Chicken 65 (Boneless)')));assert.ok(chicken.outlets.every(b=>b.menuScope==='brand_reference'));
 const shawarma=request({dishId:'56'}).body;assert.equal(shawarma.total,1);assert.equal(shawarma.outlets[0].city,'New Delhi');assert.deepEqual(shawarma.outlets[0].sourceTypes,['delivery_platform','business_website']);assert.equal(shawarma.outlets[0].menuItems[0].price_inr,490);
});
test('branch-specific momo and matcha menus stay at their checked outlets',()=>{
 const momo=request({dishId:'41'}).body;assert.equal(momo.total,1);assert.equal(momo.outlets[0].name,'Wow! Momo - CR Park');assert.equal(momo.outlets[0].menuScope,'outlet_page');
 const another=chains.businesses.find(b=>b.brand==='Wow! Momo' && b.locality!=='CR Park');assert.deepEqual(chains.menuFor(another),{menuScope:'none',menuItems:[]});
 const matcha=request({dishId:'100'}).body;assert.equal(matcha.total,1);assert.equal(matcha.outlets[0].city,'Chandigarh');assert.equal(matcha.outlets[0].menuItems[0].price_inr,750);
});
test('city filters are exact and pagination and IDs are bounded',()=>{
 assert.equal(request({dishId:'100',city:'Pune'}).body.total,0);assert.equal(request({dishId:'100',city:'chandigarh'}).body.total,1);
 const a=request({dishId:'1',limit:'1'}).body,b=request({dishId:'1',limit:'1',offset:'1'}).body;assert.notEqual(a.outlets[0].id,b.outlets[0].id);assert.equal(a.hasMore,true);
 for(const query of [{dishId:'x'},{dishId:'1',limit:'1000'},{dishId:'1',offset:'-1'},{dishId:'1',city:'x'.repeat(101)}])assert.equal(request(query).status,400);
 assert.equal(request({dishId:'101'}).status,404);
});
test('the poha shortlist preserves separate menu items without a fabricated combo price',()=>{
 const result=request({dishId:'81'}).body;assert.match(result.dish.note,/separately/);assert.deepEqual(result.outlets[0].menuItems.map(m=>m.name),['Indori Poha','Jalebi (50GMS)']);assert.ok(result.outlets[0].menuItems.every(m=>m.price_inr===null));
});
test('new branch records and menu enrichments are unique and source eligibility stays conservative',()=>{
 assert.equal(new Set(chains.businesses.map(b=>b.sourceKey)).size,chains.businesses.length);
 assert.equal(new Set(chains.menuItems.map(m=>m.external_id)).size,chains.menuItems.length);
 for(const b of chains.businesses){assert.equal(b.recommendation_eligible,false);assert.equal(b.publish_ready,false);}
 const chocolate=chains.businesses.find(b=>b.brand==='Kunafa Bytes');const menu=chains.menuFor(chocolate);assert.equal(menu.menuScope,'brand_reference');const item=menu.menuItems.find(m=>m.name==='Dubai Kunafa Chocolate');assert.equal(item.portion,'55 g');assert.equal(item.price_inr,320);assert.equal(item.source_business_id,null);
});
