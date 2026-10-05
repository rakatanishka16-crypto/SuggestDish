const test=require('node:test'),assert=require('node:assert/strict'),chains=require('../lib/chain-source-catalog'),register=require('../lib/source-catalog');
function request(id){let handler,body,status=200;register({get:(route,h)=>{if(route==='/api/business-source')handler=h;}});handler({query:{businessId:id}},{set(){},status(n){status=n;return this;},json(value){body=value;}});return {status,body};}
test('Jalna has a real Domino’s outlet and its national menu is not advertised as local stock or pricing',()=>{
 const b=chains.businesses.find(b=>b.brand==="Domino's Pizza" && b.city==='Jalna');assert.ok(b);assert.match(b.address,/Shakun Plaza/);assert.equal(b.source_store_id,'64037');assert.equal(b.latitude,19.848007);assert.equal(b.longitude,75.9098);
 const {status,body}=request(b.sourceKey);assert.equal(status,200);assert.equal(body.menuScope,'brand_reference');assert.ok(body.menuItems.some(m=>m.name==='Margherita'));assert.ok(body.menuItems.length>600);
 for(const m of body.menuItems){assert.equal(m.branch_availability,'not_confirmed');assert.equal(m.source_business_id,null);assert.equal(m.recommendation_eligible,false);assert.match(m.price_scope,/outlet price not confirmed/);}
});
test('outlet-page menu evidence stays attached to that outlet rather than leaking to another same-brand branch',()=>{
 const b=chains.businesses.find(b=>b.brand==='KFC' && b.outlet_menu_set_id);assert.ok(b);const {body}=request(b.sourceKey);assert.equal(body.menuScope,'outlet_page');assert.ok(body.menuItems.length>50);
 for(const m of body.menuItems){assert.equal(m.source_business_id,b.sourceKey);assert.equal(m.source_url,b.source_urls[0]);assert.equal(m.branch_availability,'published_on_outlet_page');assert.ok(m.price_inr>0);assert.equal(m.recommendation_eligible,false);}
 assert.deepEqual(chains.menuFor({...b,outlet_menu_set_id:undefined}),{menuScope:'none',menuItems:[]});
 assert.throws(()=>chains.menuFor({...b,brand:'Different brand'}),/Invalid outlet menu association/);
});
test('outlet data preserves source identities and missing facts instead of inventing ratings or city-wide coverage',()=>{
 assert.ok(chains.businesses.length>2000);assert.equal(new Set(chains.businesses.map(b=>b.sourceKey)).size,chains.businesses.length);
 for(const b of chains.businesses){assert.ok(b.address===null || typeof b.address==='string' && b.address.length>0);assert.ok(b.city);assert.equal(b.restaurant_rating,null);assert.equal(b.fssai_license_number,null);assert.equal(b.recommendation_eligible,false);for(const url of b.source_urls)assert.equal(new URL(url).protocol,'https:');}
 assert.equal(new Set(chains.menuItems.map(m=>m.external_id)).size,chains.menuItems.length);
 const {body}=request(chains.businesses.find(b=>b.brand==='Burger King' && !b.outlet_menu_set_id)?.sourceKey || 'official:sd-food-'+'0'.repeat(20));if(body?.menuItems)assert.deepEqual(body.menuItems,[]);
});
test('remaining outlets have factual cities and do not inherit unobserved brand menus',()=>{
 const waffle=chains.businesses.find(b=>b.brand==='The Belgian Waffle Co.' && b.city==='Jalna');assert.ok(waffle);assert.match(waffle.address,/Civil Club/);assert.equal(request(waffle.sourceKey).body.menuScope,'none');
 const lapino=chains.businesses.find(b=>b.brand==="La Pino'z Pizza");assert.equal(lapino.address_scope,'locality_only');assert.equal(lapino.state,null);assert.match(lapino.service_note,/not a full street address/);assert.ok(Number.isFinite(lapino.latitude));
 assert.ok(chains.businesses.some(b=>b.brand==='Jumboking' && b.city==='Mumbai'));
 assert.ok(chains.businesses.every(b=>!['Test City','Punjab','Telangana'].includes(b.city)));
 const conflict=chains.businesses.find(b=>b.brand==='The Belgian Waffle Co.' && /Khosbagan/.test(b.name));assert.equal(conflict.state,null);assert.match(conflict.service_note,/conflicts/);
});
test('McDonald’s Jalna Road menu belongs to Aurangabad and never to Jalna',()=>{
 const b=chains.businesses.find(b=>b.brand==="McDonald's" && b.outlet_menu_set_id);assert.equal(b.city,'Aurangabad');assert.match(b.address,/Jalna Road/);
 const {body}=request(b.sourceKey);assert.equal(body.menuScope,'outlet_page');assert.equal(body.menuItems.find(m=>m.name==='McChicken Burger Combo').price_inr,325);
 const other=chains.businesses.find(b=>b.brand==="McDonald's" && !b.outlet_menu_set_id);assert.deepEqual(chains.menuFor(other),{menuScope:'none',menuItems:[]});
});
