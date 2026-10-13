const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const batch=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches/maharashtra-mall-menus-2026-10-06.json.gz'))));
const chains=require('../lib/chain-source-catalog');
test('mall enrichment patches existing identities and reconciles observed menus and prices',()=>{
 assert.equal(batch.businesses.length,0);assert.equal(batch.research_scope.malls,17);
 assert.equal(batch.research_scope.target_records,71);assert.equal(batch.menu_associations.length,37);
 assert.equal(batch.research_scope.complete_mall_tenant_census,false);
 let entries=0,prices=0;
 for(const patch of batch.menu_associations){
  const b=chains.businesses.find(b=>b.sourceKey===patch.sourceKey);assert.ok(b);
  const set=batch.menu_sets[patch.outlet_menu_set_id],menu=chains.menuFor(b);
  assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,set.items.length);
  for(const m of menu.menuItems){assert.equal(m.source_business_id,b.sourceKey);assert.equal(m.source_url,set.source_url);assert.equal(m.recommendation_eligible,false);assert.equal(m.publish_ready,false);entries++;if(m.price_inr!==null){assert.ok(m.price_inr>0);prices++;}}
 }
 assert.equal(entries,4297);assert.equal(prices,1448);
 assert.equal(new Set(chains.businesses.map(b=>b.sourceKey)).size,chains.businesses.length);
});
test('mall products keep published prices, unknown dietary markers and precise portions',()=>{
 const kfc=chains.businesses.find(b=>b.sourceKey==='official:sd-food-30b8ddd3035454a899a9');
 const item=chains.menuFor(kfc).menuItems.find(m=>m.name==='Double Chicken Dynamite');
 assert.equal(item.price_inr,349);assert.equal(item.portion,'Serves: 1 | 250g');assert.equal(item.tax_included,false);assert.equal(item.is_veg,null);
 const ph=Object.values(batch.menu_sets).filter(s=>s.brand==='Pizza Hut');
 assert.ok(ph.every(s=>s.items.every(m=>m.price_inr===null)));
 assert.ok(batch.research_scope.source_checks.some(r=>r.brand==="Haldiram's" && r.status==='pending'));
 assert.ok(!batch.menu_associations.some(p=>p.brand==='Burger King' || p.brand==="Domino's Pizza"));
});
test('Burger King Kurla promotions remain branch-scoped and non-recommendable',()=>{
 const sourceKey='official:sd-food-e66d16b463fe11b57fe7';
 const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);
 const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,2);
 assert.deepEqual(menu.menuItems.map(m=>[m.name,m.price_inr]),[['Crispy Veg Meal',99],['Veg Whopper Deluxe Meal',149]]);
 for(const item of menu.menuItems){assert.equal(item.source_business_id,sourceKey);assert.equal(item.is_veg,true);assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);}
 const other=chains.businesses.find(b=>b.brand==='Burger King'&&b.sourceKey!==sourceKey);assert.ok(other);assert.notEqual(other.outlet_menu_set_id,branch.outlet_menu_set_id);
});
test('dated Korum Mall promotion remains branch-scoped and non-recommendable',()=>{
 const sourceKey='official:sd-food-fff9c9d5c17382f409e1';
 const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);
 const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,1);
 const item=menu.menuItems[0];assert.equal(item.name,'Veg Whopper Deluxe');assert.equal(item.price_inr,139);
 assert.equal(item.branch_availability,'historical_promotion_observed');assert.equal(item.source_business_id,sourceKey);
 assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);
 const other=chains.businesses.find(b=>b.brand==='Burger King'&&b.sourceKey!==sourceKey);assert.ok(other);assert.notEqual(other.outlet_menu_set_id,branch.outlet_menu_set_id);
});
test('dated Nashik and Pune promotions remain attached to their exact branches',()=>{
 const keys=['official:sd-food-04cc6a3242c2959a7775','official:sd-food-e59d48d5290e37f03013'];
 for(const sourceKey of keys){
  const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);
  const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,1);
  const item=menu.menuItems[0];assert.equal(item.name,'2 Crispy Veg Burgers');assert.equal(item.portion,'2 burgers');assert.equal(item.price_inr,79);
  assert.equal(item.observed_promotion_date,'2026-09-17');assert.equal(item.branch_availability,'historical_promotion_observed');
  assert.equal(item.source_business_id,sourceKey);assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);
 }
 assert.notEqual(chains.businesses.find(b=>b.sourceKey===keys[0]).outlet_menu_set_id,chains.businesses.find(b=>b.sourceKey===keys[1]).outlet_menu_set_id);
});
test('dated Prozone, Viviana and Inorbit Vashi promotions remain branch-scoped',()=>{
 const keys=['official:sd-food-546f105843a8e1347c32','official:sd-food-37aeb8e2939674abe250','official:sd-food-f28c27da38e038228206'];
 for(const sourceKey of keys){
  const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);
  const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,1);
  const item=menu.menuItems[0];assert.equal(item.name,'2 Crispy Veg Burgers');assert.equal(item.portion,'2 burgers');assert.equal(item.price_inr,79);
  assert.equal(item.observed_promotion_date,'2026-10-07');assert.equal(item.branch_availability,'historical_promotion_observed');
  assert.equal(item.source_business_id,sourceKey);assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);
 }
 assert.equal(new Set(keys.map(k=>chains.businesses.find(b=>b.sourceKey===k).outlet_menu_set_id)).size,3);
});
test('dated Tapadia and Seasons Mall promotions remain branch-scoped',()=>{
 const keys=['official:sd-food-0b6813a4903cf8310869','official:sd-food-18df6e3ec8f04f8f7752'];
 for(const sourceKey of keys){
  const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);
  const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,1);
  const item=menu.menuItems[0];assert.equal(item.name,'2 Crispy Veg Burgers');assert.equal(item.portion,'2 burgers');assert.equal(item.price_inr,79);
  assert.equal(item.observed_promotion_date,'2026-10-07');assert.equal(item.branch_availability,'historical_promotion_observed');
  assert.equal(item.source_business_id,sourceKey);assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);
 }
 assert.notEqual(chains.businesses.find(b=>b.sourceKey===keys[0]).outlet_menu_set_id,chains.businesses.find(b=>b.sourceKey===keys[1]).outlet_menu_set_id);
});
test('dated Amanora and Pavilion promotions remain branch-scoped',()=>{
 const keys=['official:sd-food-b46d66290fd93220859b','official:sd-food-267e442f9937a8cdd2d3'];
 for(const sourceKey of keys){const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,1);const item=menu.menuItems[0];assert.equal(item.name,'2 Crispy Veg Burgers');assert.equal(item.price_inr,79);assert.equal(item.observed_promotion_date,'2026-10-07');assert.equal(item.branch_availability,'historical_promotion_observed');assert.equal(item.source_business_id,sourceKey);assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);}
 assert.notEqual(chains.businesses.find(b=>b.sourceKey===keys[0]).outlet_menu_set_id,chains.businesses.find(b=>b.sourceKey===keys[1]).outlet_menu_set_id);
});
test('Dominos Phoenix Marketcity offer remains branch-scoped and non-recommendable',()=>{
 const sourceKey='official:sd-food-b061d57272c45e4f2c26';
 const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);
 const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,1);
 const item=menu.menuItems[0];assert.equal(item.name,'2 Regular Pizzas');assert.equal(item.portion,'2 regular pizzas; ₹99 each');assert.equal(item.price_inr,99);
 assert.equal(item.is_veg,null);assert.equal(item.branch_availability,'official_branch_menu_offer_observed');assert.equal(item.source_business_id,sourceKey);
 assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);
});
test('Dominos Inorbit Vashi menu remains attached only to its exact branch',()=>{
 const sourceKey='official:sd-food-edbfc77c66961c46673c';
 const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);
 const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,53);
 assert.ok(menu.menuItems.some(m=>m.name==='Veg Extravaganza'&&m.is_veg===true));
 assert.ok(menu.menuItems.some(m=>m.name==='Chicken Dominator'&&m.is_veg===false));
 assert.ok(menu.menuItems.some(m=>m.name==='GARLIC BREADSTICKS'&&m.is_veg===null));
 for(const item of menu.menuItems){assert.equal(item.price_inr,null);assert.equal(item.source_business_id,sourceKey);assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);}
});
test('Dominos Amanora Mall offer remains branch-scoped and non-recommendable',()=>{
 const sourceKey='official:sd-food-a6fd30b4929fa5097139';
 const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);
 const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,1);
 const item=menu.menuItems[0];assert.equal(item.name,'2 Regular Pizzas');assert.equal(item.portion,'2 regular pizzas; ₹99 each');assert.equal(item.price_inr,99);
 assert.equal(item.is_veg,null);assert.equal(item.branch_availability,'official_branch_menu_offer_observed');assert.equal(item.source_business_id,sourceKey);
 assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);
});
test('Dominos Prozone Mall menu remains attached only to its exact branch',()=>{
 const sourceKey='official:sd-food-022918f8c6f84bc12ff2';
 const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);
 const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,51);
 assert.ok(menu.menuItems.some(m=>m.name==='The Unthinkable Pizza'&&m.is_veg===true));
 assert.ok(menu.menuItems.some(m=>m.name==='Chicken Dominator'&&m.is_veg===null));
 assert.ok(menu.menuItems.some(m=>m.name==='Pepsi (500ml)'&&m.is_veg===null));
 for(const item of menu.menuItems){assert.equal(item.price_inr,null);assert.equal(item.source_business_id,sourceKey);assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);}
});
test('Dominos Nashik City Center offer remains branch-scoped and non-recommendable',()=>{
 const sourceKey='official:sd-food-2a52b955ed923a5dc0cd';
 const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);
 const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,1);
 const item=menu.menuItems[0];assert.equal(item.name,'2 Regular Pizzas');assert.equal(item.portion,'2 regular pizzas; ₹99 each');assert.equal(item.price_inr,99);
 assert.equal(item.is_veg,null);assert.equal(item.source_business_id,sourceKey);assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);
});
test('Dominos Tapadia City Centre Amravati offer remains branch-scoped and non-recommendable',()=>{
 const sourceKey='official:sd-food-aef0f54cd02e3b038004';
 const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);
 const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,1);
 const item=menu.menuItems[0];assert.equal(item.name,'2 Regular Pizzas');assert.equal(item.portion,'2 regular pizzas; ₹99 each');assert.equal(item.price_inr,99);
 assert.equal(item.is_veg,null);assert.equal(item.source_business_id,sourceKey);assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);
});
test('Dominos Phoenix Marketcity Pune and Nexus Westend offers remain branch-scoped',()=>{
 const keys=['official:sd-food-2f858bdd5f3b28f56e0c','official:sd-food-d3a2b33f7535b00062d9'];
 for(const sourceKey of keys){const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,1);const item=menu.menuItems[0];assert.equal(item.name,'2 Regular Pizzas');assert.equal(item.price_inr,99);assert.equal(item.is_veg,null);assert.equal(item.source_business_id,sourceKey);assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);}
 assert.notEqual(chains.businesses.find(b=>b.sourceKey===keys[0]).outlet_menu_set_id,chains.businesses.find(b=>b.sourceKey===keys[1]).outlet_menu_set_id);
});
test('Three additional Dominos Maharashtra offers remain exact-branch scoped',()=>{
 const keys=['official:sd-food-3c527de05a51a94de259','official:sd-food-66f0e4bc7c913a943b4d','official:sd-food-99fca9b511520248ebdc'];
 for(const sourceKey of keys){const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,1);const item=menu.menuItems[0];assert.equal(item.name,'2 Regular Pizzas');assert.equal(item.price_inr,99);assert.equal(item.is_veg,null);assert.equal(item.source_business_id,sourceKey);assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);}
 assert.equal(new Set(keys.map(k=>chains.businesses.find(b=>b.sourceKey===k).outlet_menu_set_id)).size,3);
});
test('Dominos Phoenix Millennium and Tapadia Plaza offers remain exact-branch scoped',()=>{
 const keys=['official:sd-food-fb58ab484605c353f91f','official:sd-food-98239d19446756b9524e'];
 for(const sourceKey of keys){const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,1);const item=menu.menuItems[0];assert.equal(item.name,'2 Regular Pizzas');assert.equal(item.price_inr,99);assert.equal(item.is_veg,null);assert.equal(item.source_business_id,sourceKey);assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);}
});
test('Dominos R City and Korum Mall offers remain exact-branch scoped',()=>{
 const keys=['official:sd-food-659b97408a94b17fce19','official:sd-food-e779e36cace0343e6c05'];
 for(const sourceKey of keys){const branch=chains.businesses.find(b=>b.sourceKey===sourceKey);assert.ok(branch);const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,1);const item=menu.menuItems[0];assert.equal(item.name,'2 Regular Pizzas');assert.equal(item.price_inr,99);assert.equal(item.is_veg,null);assert.equal(item.source_business_id,sourceKey);assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);}
 assert.notEqual(chains.businesses.find(b=>b.sourceKey===keys[0]).outlet_menu_set_id,chains.businesses.find(b=>b.sourceKey===keys[1]).outlet_menu_set_id);
});
test('Dominos Infiniti Mall Malad offer attaches only to the exact official branch identity',()=>{
 const sourceKey='official:sd-food-fa04671b2f35783ff36c',otherKey='official:sd-food-86d899de459faddee76b';
 const branch=chains.businesses.find(b=>b.sourceKey===sourceKey),other=chains.businesses.find(b=>b.sourceKey===otherKey);assert.ok(branch);assert.ok(other);
 const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,1);assert.equal(menu.menuItems[0].name,'2 Regular Pizzas');assert.equal(menu.menuItems[0].price_inr,99);assert.equal(menu.menuItems[0].is_veg,null);assert.equal(menu.menuItems[0].source_business_id,sourceKey);assert.equal(menu.menuItems[0].recommendation_eligible,false);
 assert.equal(chains.menuFor(other).menuScope,'brand_reference');assert.notEqual(other.source_store_id,branch.source_store_id);
});
test('Gajbandhan Patharli official branch keeps dated prices historical and non-recommendable',()=>{
 const branch=chains.businesses.find(b=>b.name==="Domino's Pizza - GAJBANDHAN PATHARLI - KALYAN");assert.ok(branch);assert.equal(branch.latitude,19.20780992016984);assert.equal(branch.longitude,73.09453913608242);assert.match(branch.directions_url,/destination=19\.20780992016984,73\.09453913608242/);
 const menu=chains.menuFor(branch);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.length,4);assert.deepEqual(menu.menuItems.map(x=>x.price_inr),[199,299,249,399]);
 for(const item of menu.menuItems){assert.equal(item.branch_availability,'historical_promotion_observed');assert.equal(item.observed_promotion_date,'2017-06-14');assert.equal(item.offer_end_date,'2017-12-31');assert.equal(item.recommendation_eligible,false);assert.equal(item.publish_ready,false);assert.equal(item.is_veg,null);}
});
