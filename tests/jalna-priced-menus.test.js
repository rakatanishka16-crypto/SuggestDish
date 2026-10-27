'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const imported=require('../lib/jalna-priced-menus');
const catalog=require('../lib/source-catalog');
const {metadata}=require('../lib/priced-menu-policy');
const scope=require('../api/source-batches/jalna-menu-request-scope-2026-10-27.json');

test('every requested Jalna listing has an explicit import outcome, with no invented missing prices',()=>{
 assert.equal(scope.listings.length,64);
 assert.equal(imported.batch.request_outcomes.length,64);
 assert.equal(imported.batch.summary.requestedListings,64);
 assert.equal(imported.batch.summary.publishedMenuProfiles,imported.batch.businesses.length);
 assert.equal(imported.batch.summary.pricedMenuItems,imported.batch.menu_items.length);
 assert.equal(imported.batch.summary.pendingOrHeldListings,64-imported.batch.businesses.length);
 assert.ok(imported.batch.businesses.length>0);
 assert.equal(new Set(imported.batch.businesses.map(b=>b.requested_outlet_url)).size,imported.batch.businesses.length);
 assert.equal(new Set(imported.batch.menu_items.map(m=>m.external_id)).size,imported.batch.menu_items.length);
 const requested=new Set(scope.listings.map(([,p])=>'jalna/'+p.replace(/\/(order|menu|info|reviews)$/,'')));
 for(const b of imported.batch.businesses){
  assert.ok(requested.has(b.requested_outlet_url));assert.equal(b.city,'Jalna');
  assert.equal(b.recommendation_eligible,false);assert.equal(b.photo_url,undefined);assert.equal(b.phone,undefined);
  const menu=imported.menuFor(b);assert.ok(menu.menuItems.length);assert.equal(menu.menuScope,'outlet_observed');
  assert.equal(menu.menuProvider,'IndiaRestros API');assert.match(menu.menuNotice,/Source updated:/);
  for(const item of menu.menuItems){
   assert.ok(Number.isFinite(item.price_inr)&&item.price_inr>0&&item.price_inr<=100000);
   assert.equal(item.source_business_id,b.sourceKey);assert.equal(item.retrieved_on,'2026-10-27');
   assert.equal(new URL(item.source_url).hostname,'indiarestros.com');assert.equal(item.upstream_source_url,b.menu_upstream_url);
   assert.equal(item.photo_url,undefined);assert.equal(item.description,undefined);assert.equal(item.recommendation_eligible,false);
  }
 }
});

test('priced-menu overlays preserve prior identity and licence/owner facts and replay without duplicates',()=>{
 const entry=imported.batch.businesses[0];
 const current={sourceKey:entry.sourceKey,name:'Owner identity',address:'Owner address',latitude:19.84,ownerVerified:true,fssai_records:[{number:'12345678901234'}],source_urls:['https://owner.example/'],menu_source_urls:['https://owner.example/menu']};
 const applied=imported.apply([current]);const row=applied.find(b=>b.sourceKey===entry.sourceKey);
 assert.equal(row.name,current.name);assert.equal(row.address,current.address);assert.equal(row.latitude,current.latitude);assert.equal(row.ownerVerified,true);
 assert.deepEqual(row.fssai_records,current.fssai_records);assert.deepEqual(row.source_urls,current.source_urls);assert.equal(current.menu_source_urls.length,1);
 assert.equal(imported.apply(applied).length,applied.length);
 assert.equal(new Set(applied.map(b=>b.sourceKey)).size,applied.length);
});

test('directory exposes full priced menus with provenance while held listings stay unpromoted',()=>{
 const routes=new Map();catalog({get:(p,h)=>routes.set(p,h)});
 for(const b of imported.batch.businesses){
  const row=catalog.listingRows.find(r=>r.id===b.sourceKey);assert.ok(row?.hasPricedMenu);
  const menu=catalog.importData.menuFor(b);assert.equal(row.pricedMenuCount,menu.menuItems.length);
  assert.equal(metadata(b,menu).hasPricedMenu,true);
  let result;routes.get('/api/business-source')({query:{businessId:b.sourceKey}},{set(){},json(d){result=d;}});
  assert.equal(result.menuItems.length,menu.menuItems.length);assert.equal(result.menuProvider,'IndiaRestros API');
 }
 assert.equal(imported.menuFor({sourceKey:'official:other-branch',brand:imported.batch.businesses[0].brand}),null);
 const plan=require('../lib/catalogue-import').plan({businesses:imported.batch.businesses,menuItems:imported.batch.menu_items,menuFor:imported.menuFor});
 assert.equal(plan.summary.promotionDishes,0,'third-party menus must not silently bypass recommendation import review');
});
