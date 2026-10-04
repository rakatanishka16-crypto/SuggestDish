const test=require('node:test'),assert=require('node:assert/strict'),register=require('../lib/dish-photos');
function harness(photos=[]){let handler;register({get:(p,h)=>handler=h},{verifiedPhotos:photos});return async(dish,vegetarian)=>{let body,status=200;await handler({query:{dish,vegetarian}},{set(){},status(s){status=s;return this;},json(b){body=b;}});return {body,status};};}
const photo={dishName:'Veg Sandwich',vegetarian:true,verified:true,ingredientEvidence:'Reviewed vegetable filling',license:'Restaurant permission',url:'https://images.example/veg.jpg',sourceUrl:'https://restaurant.example/menu',artist:'Restaurant'};
test('exact verified vegetarian photo works with safe attribution',async()=>{const r=await harness([photo])('  VEG Sandwich  ','true');assert.equal(r.body.photo.url,photo.url);});
test('vegetarian never receives nonvegetarian or unverified media',async()=>{for(const p of [{...photo,vegetarian:false},{...photo,verified:false},{...photo,ingredientEvidence:''}]) assert.equal((await harness([p])('Veg Sandwich','true')).body.photo,null);});
test('nonvegetarian gets its exact verified photo, never a generic sandwich',async()=>{const p={...photo,dishName:'Chicken Sandwich',vegetarian:false,ingredientEvidence:'Chicken filling'};assert.equal((await harness([p])('Chicken Sandwich','false')).body.photo.url,p.url);assert.equal((await harness([p])('Mutton Sandwich','false')).body.photo,null);assert.equal((await harness([photo])('Veg Sandwich','false')).body.photo,null);});
test('unknown diet and unsafe URLs fail closed',async()=>{assert.equal((await harness([photo])('Veg Sandwich')).body.photo,null);assert.equal((await harness([{...photo,url:'javascript:alert(1)'}])('Veg Sandwich','true')).body.photo,null);assert.equal((await harness()('x'.repeat(161),'true')).status,400);});

test('reviewed restaurant media still requires exact dish and dietary match',async()=>{
 let handler;const id='11111111-1111-4111-8111-111111111111';let row={id,name:'Veg Sandwich',isVeg:true,restaurant:'Test restaurant'};
 register({get:(p,h)=>handler=h},{sql:async()=>[row]});
 const run=async()=>{let body;await handler({query:{dish:'Veg Sandwich',dishId:'1',vegetarian:'true'}},{set(){},json(b){body=b;}});return body;};
 assert.match((await run()).photo.url,/\/api\/business-media\//);row={...row,isVeg:false};assert.equal((await run()).photo,null);row={...row,isVeg:true,name:'Chicken Sandwich'};assert.equal((await run()).photo,null);
});
