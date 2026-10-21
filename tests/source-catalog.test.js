const test=require('node:test'),assert=require('node:assert/strict'),register=require('../lib/source-catalog');
const batch=require('../api/source-batches/mumbai-2026-10-04.json');
const chains=require('../lib/chain-source-catalog');
function request(id){let handler,status=200,result;register({get:(p,h)=>{if(p==='/api/business-source')handler=h;}});handler({query:{businessId:id}},{set(){},status(c){status=c;return this;},json(d){result=d;}});return {status,result};}
test('catalog exposes only source-checked business profiles and rejects unknown identifiers',()=>{
 assert.equal(request("x'; DROP TABLE").status,400);assert.equal(request('official:sd-mumbai-'+'0'.repeat(20)).status,404);
 for(const b of batch.businesses){const r=request(b.sourceKey);if(b.brand==="Thepla House by Tejal's Kitchen")assert.equal(r.status,404);else assert.equal(r.result.business.name,b.name);}
 assert.equal('research_leads' in batch,false);
});
test('brand menus are kept separate from branch availability and budget recommendations',()=>{
 const b=batch.businesses.find(b=>b.name==='Oye Kake'),r=request(b.sourceKey);assert.equal(r.result.menuItems.length,105);
 for(const m of r.result.menuItems){assert.equal(m.price_inr,null);assert.equal(m.branch_availability,'not_confirmed');assert.equal(m.tax_included,null);}
 assert.match(r.result.notice,/not owner verification/);
});
test('source facts have no guessed licences, ratings or coordinates and preserve real menu price units',()=>{
 assert.equal(batch.businesses.length,73);assert.equal(batch.menu_items.length,512);
 for(const b of batch.businesses){assert.equal(b.license_status,'not_checked');assert.equal(b.restaurant_rating,null);assert.equal(b.latitude,null);assert.ok(b.address);for(const u of b.source_urls)assert.equal(new URL(u).protocol,'https:');}
 const m=batch.menu_items.find(m=>m.name==='Kadai Paneer');assert.equal(m.price_inr,399);assert.equal(m.portion,'500 ml');assert.equal(m.is_veg,true);
});

test('expanded catalog preserves menu variants, source dietary labels, and read-only eligibility',()=>{
 assert.equal(new Set(batch.businesses.map(b=>b.sourceKey)).size,batch.businesses.length);
 assert.equal(new Set(batch.menu_items.map(m=>m.external_id)).size,batch.menu_items.length);
 const pizza=batch.menu_items.filter(m=>m.brand==='PizzaExpress');assert.equal(pizza.length,130);
 assert.equal(pizza.find(m=>m.name==='American Pizza').is_veg,false);
 assert.equal(pizza.find(m=>m.name==='Margherita Pizza').is_veg,true);
 assert.ok(pizza.every(m=>m.price_inr===null));
 const thepla=batch.menu_items.filter(m=>m.brand==="Thepla House by Tejal's Kitchen");assert.equal(thepla.length,248);
 assert.deepEqual(thepla.filter(m=>m.name==='Methi Thepla - Vacuum Pack of 5 Piece').map(m=>m.price_inr).sort(),[122,137]);
 assert.equal(batch.menu_items.find(m=>m.name==='Lagan Nu Custard Tart').is_veg,null);
 for(const m of batch.menu_items){assert.equal(m.recommendation_eligible,false);assert.ok(m.price_inr===null || (Number.isFinite(m.price_inr)&&m.price_inr>0));}
});
test('coverage exposes honest counts without publishing unresolved research leads',()=>{
 const handlers={};register({get:(path,h)=>handlers[path]=h});let result;handlers['/api/data-coverage']({}, {set(){},json(d){result=d;}});
 assert.equal(result.completeCityCensus,false);assert.equal(result.businessProfiles,8032);assert.equal(result.cities['Chhatrapati Sambhajinagar'],87);assert.equal(result.menuEntries,15411);assert.equal(result.publishedPrices,7004);assert.equal(result.outletsWithSourceMenus,214);assert.equal(result.researchLeadsChecked,127);assert.equal(result.researchLeadsPending,107);assert.equal(result.licencesVerified,0);assert.equal('leads' in result,false);
});

test('Baglami BKC keeps directory address provenance while adding official profile corroboration',()=>{
 const r=request('listing:sd-mumbai-baglami-bandra-kurla-complex-20261007');assert.equal(r.status,200);
 const b=r.result.business;assert.equal(b.source_urls[0],'https://www.baglami.com/');assert.deepEqual(b.source_types,['business_website','restaurant_directory']);assert.match(b.directions_url,/destination=BKC%207%2C%20INS%20Tower/);assert.equal(b.recommendation_eligible,false);
 assert.equal(r.result.menuScope,'brand_reference');assert.ok(r.result.menuItems.every(m=>m.recommendation_eligible===false));
});

test('CinCin BKC gains current business-profile corroboration without cross-branch menu leakage',()=>{
 const r=request('listing:sd-mumbai-cincin-bandra-kurla-complex-20261007');assert.equal(r.status,200);
 const b=r.result.business;assert.ok(b.source_urls.includes('https://linktr.ee/cincinindia'));assert.match(b.directions_url,/destination=Ground%20Floor%2C%20Raheja%20Tower/);assert.equal(b.recommendation_eligible,false);
 assert.ok(!b.source_urls.some(u=>u.includes('drive.google.com')));assert.ok(r.result.menuItems.every(m=>m.recommendation_eligible===false));
});

test('Good Flippin Bandra preserves official branch facts without inventing menu availability or licence validity',()=>{
 const r=request('listing:sd-mumbai-good-flippin-burgers-pali-hill-bandra-west-20261007');assert.equal(r.status,200);
 const b=r.result.business;assert.equal(b.source_urls[0],'https://order.goodflippin.com/store-locator/mumbai/good-flippin-burgers-bandra-mumbai');assert.equal(b.phone,'9892201112');assert.equal(b.opening_hours,'Monday-Sunday 09:00-23:00');
 assert.equal(b.fssai_license_number,'11521006000592');assert.equal(b.license_status,'not_checked');assert.match(b.directions_url,/destination=Shop%203%2C%20Ground%20Floor/);assert.equal(b.recommendation_eligible,false);assert.equal(r.result.menuItems.length,0);
});

test('Mia Cucina Powai keeps conflicting hours and shared-menu availability unknown',()=>{
 const r=request('listing:sd-mumbai-mia-cucina-powai-20261007');assert.equal(r.status,200);
 const b=r.result.business;assert.equal(b.source_urls[0],'https://themiacucina.com/');assert.equal(b.phone,'+91-9595000200');assert.equal(b.opening_hours,null);assert.match(b.directions_url,/destination=G3%2C%20Transocean%20House/);assert.equal(b.recommendation_eligible,false);assert.equal(r.result.menuItems.length,0);
});

test('Olive Khar separates unlabelled dinner items from dietary-labelled all-day items',()=>{
 const r=request('listing:sd-mumbai-olive-bar-kitchen-khar-west-20261007');assert.equal(r.status,200);
 const b=r.result.business;assert.equal(b.phone,'+91 72084 78228');assert.equal(b.opening_hours,'Monday-Sunday 12:00-01:00');assert.match(b.directions_url,/destination=14%20Union%20Park/);assert.equal(r.result.menuScope,'outlet_observed');assert.equal(r.result.menuItems.length,61);
 for(const m of r.result.menuItems){assert.equal(m.source_business_id,b.sourceKey);assert.equal(m.branch_availability,'confirmed_on_outlet_page');assert.equal(m.tax_included,false);assert.ok(m.price_inr>0);}
 const allDay=r.result.menuItems.filter(m=>m.source_id==='olive_khar_all_day_8_20261015');assert.equal(allDay.length,9);assert.ok(allDay.every(m=>typeof m.is_veg==='boolean'&&m.recommendation_eligible===true));assert.equal(allDay.find(m=>m.name==='Prawns Ajillo').price_inr,845);
 const allDayPage9=r.result.menuItems.filter(m=>m.source_id==='olive_khar_all_day_9_20261021');assert.equal(allDayPage9.length,7);assert.ok(allDayPage9.every(m=>typeof m.is_veg==='boolean'&&m.recommendation_eligible===true));assert.equal(allDayPage9.find(m=>m.name==='Rotolo').price_inr,825);
 const brunchPage4=r.result.menuItems.filter(m=>m.source_id==='olive_khar_brunch_4_20261021');assert.equal(brunchPage4.length,12);assert.ok(brunchPage4.every(m=>typeof m.is_veg==='boolean'&&m.recommendation_eligible===true));assert.equal(brunchPage4.find(m=>m.name==='Seared Crisp Skin Salmon').price_inr,1575);assert.ok(!brunchPage4.some(m=>['Linguine Aglio Olio e Peperoncino','Spicy Rigatoni','Mushroom Risotto'].includes(m.name)));
 const brunchPage3=r.result.menuItems.filter(m=>m.source_id==='olive_khar_brunch_3_20261021');assert.equal(brunchPage3.length,13);assert.ok(brunchPage3.every(m=>typeof m.is_veg==='boolean'&&m.recommendation_eligible===true));assert.equal(brunchPage3.find(m=>m.name==='Steak and Eggs').price_inr,1175);assert.equal(brunchPage3.filter(m=>m.is_veg).length,8);
 const brunchPage2=r.result.menuItems.filter(m=>m.source_id==='olive_khar_brunch_2_20261021');assert.equal(brunchPage2.length,10);assert.ok(brunchPage2.every(m=>typeof m.is_veg==='boolean'&&m.recommendation_eligible===true));assert.equal(brunchPage2.find(m=>m.name==='Caesar Salad').price_inr,745);assert.equal(brunchPage2.filter(m=>m.is_veg).length,6);
 const dinner=r.result.menuItems.filter(m=>m.source_id==='olive_khar_dinner_1_20261015');assert.equal(dinner.length,10);assert.ok(dinner.every(m=>m.is_veg===null&&m.recommendation_eligible===false));
 assert.equal(r.result.menuItems.find(m=>m.name==='Boston Lobster').price_inr,1875);
});

const expansion=require('../api/source-batches/food-outlets-2026-10-05.json');
test('bakery catalog preserves priced variants, source locations and unknown regular cake ingredients',()=>{
 assert.equal(expansion.businesses.length,329);assert.equal(expansion.menu_items.length,384);
 const variants=expansion.menu_items.filter(m=>m.name==='Belgian Chocolate Cake');
 assert.ok(variants.some(m=>m.portion==='0.5 KG / Eggless' && m.price_inr===1550 && m.is_veg===true));
 assert.ok(variants.some(m=>m.portion==='0.5 KG / Regular' && m.price_inr===1550 && m.is_veg===null));
 for(const b of expansion.businesses){assert.equal(b.license_status,'not_checked');assert.equal(b.restaurant_rating,null);assert.ok(b.address);assert.equal(request(b.sourceKey).status,200);}
 for(const m of expansion.menu_items){assert.equal(m.branch_availability,'not_confirmed');assert.equal(m.recommendation_eligible,false);assert.ok(m.price_inr>0);}
 assert.equal(new Set([...batch.menu_items,...expansion.menu_items].map(m=>m.external_id)).size,batch.menu_items.length+expansion.menu_items.length);
});

const naturals=require('../api/source-batches/naturals-2026-10-05.json');
test('misaligned Naturals store fields cannot become addresses, hours or recommendation facts',()=>{
 assert.equal(naturals.businesses.length,185);
 for(const b of naturals.businesses){
  assert.equal(b.address,null);assert.equal(b.opening_hours,null);assert.equal(b.phone,null);
  assert.equal(b.latitude,null);assert.equal(b.longitude,null);assert.equal(b.recommendation_eligible,false);
  assert.equal(request(b.sourceKey).status,200);assert.ok(b.city);assert.ok(b.locality);
 }
 const all=[...batch.businesses,...expansion.businesses,...naturals.businesses];
 assert.equal(new Set(all.map(b=>b.sourceKey)).size,all.length);
 for(const m of naturals.menu_items){
  assert.equal(m.portion,null);assert.equal(m.price_inr,null);assert.equal(m.branch_availability,'not_confirmed');
  assert.equal(m.recommendation_eligible,false);assert.ok([true,null].includes(m.is_veg));
  if(m.is_veg===true) assert.match(m.veg_evidence,/100% Vegetarian/);
  assert.match(m.order_note,/does not identify a scoop or pack size/);
  assert.equal(new URL(m.source_url).hostname,'naturalicecreams.in');
 }
 const coconut=naturals.menu_items.find(m=>m.name==='Tender Coconut Ice Cream');
 assert.ok(coconut);assert.equal(coconut.price_inr,null);assert.equal(coconut.observed_price_inr,100);
});
