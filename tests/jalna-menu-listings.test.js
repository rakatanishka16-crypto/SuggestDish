'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const listing=require('../lib/jalna-menu-listings');
const catalog=require('../lib/source-catalog');
test('Jalna menu links preserve provenance without inventing dishes, verification or licensed photos',()=>{
 assert.equal(listing.batch.summary.menuListedSourceRecords,264);
 assert.equal(listing.batch.summary.selectedNames,257);
 assert.deepEqual(listing.batch.menu_items,[]);
 assert.equal(new Set(listing.batch.businesses.map(b=>b.sourceKey)).size,listing.batch.businesses.length);
 for(const b of listing.batch.businesses){
  assert.equal(b.city,'Jalna');assert.equal(b.recommendation_eligible,false);assert.equal(b.operating_status,null);
  assert.equal(b.restaurant_rating,null);assert.equal(b.phone,null);assert.equal(b.source_license,null);
  assert.ok(b.menu_source_urls.length);for(const url of b.menu_source_urls)assert.equal(new URL(url).protocol,'https:');
  assert.equal(b.photo_url,undefined);assert.equal(b.price_inr,undefined);
 }
});
test('known profiles retain their stronger identity, coordinates and menu when supplemented',()=>{
 const known=listing.batch.businesses.find(b=>b.matched_source_key);
 const old={sourceKey:known.matched_source_key,name:'Authoritative name',address:'Existing address',latitude:19.84,longitude:75.9,source_urls:['https://owner.example/'],menu_source_urls:['https://owner.example/menu']};
 const otherMatches=listing.batch.businesses.filter(b=>b.matched_source_key&&b!==known).map(b=>({sourceKey:b.matched_source_key}));
 const result=listing.apply([old,...otherMatches]);const merged=result.find(b=>b.sourceKey===old.sourceKey);
 assert.equal(merged.name,old.name);assert.equal(merged.address,old.address);assert.equal(merged.latitude,old.latitude);
 assert.deepEqual(merged.source_urls,old.source_urls);assert.ok(merged.menu_source_urls.includes(known.menu_source_urls[0]));
 assert.equal(result.filter(b=>b.sourceKey===old.sourceKey).length,1);
 assert.equal(old.menu_source_urls.length,1,'source input must not be mutated');
});
test('new directory profiles expose links, keep menus external and do not borrow chain menus',()=>{
 const entry=listing.batch.businesses.find(b=>!b.matched_source_key&&!b.existingBusinessId);
 assert.ok(catalog.listingRows.find(b=>b.id===entry.sourceKey)?.menuUrl);
 assert.equal(catalog.importData.menuFor(entry).menuScope,'external_link');
 assert.deepEqual(catalog.importData.menuFor(entry).menuItems,[]);
 const routes=new Map();catalog({get:(p,h)=>routes.set(p,h)});let result;
 routes.get('/api/business-source')({query:{businessId:entry.sourceKey}},{set(){},json(d){result=d;}});
 assert.equal(result.business.sourceKey,entry.sourceKey);assert.ok(result.business.menu_source_urls.length);
 assert.deepEqual(result.menuItems,[]);assert.match(result.notice,/not owner verification/);
});
test('closed, unclear and conflicting Jalna listings stay held instead of adding duplicate businesses',()=>{
 for(const name of ['cb','Pizza & Grill - Permanently Closed','Satpute family restaurant jalna']){
  assert.ok(listing.batch.held_records.some(r=>r.name===name));
  assert.ok(!listing.batch.businesses.some(r=>r.name===name));
 }
 for(const r of listing.batch.held_records.filter(r=>r.possible_matches))assert.ok(!listing.batch.businesses.some(b=>b.source_urls.includes(r.source_url)));
 const kitchen=listing.batch.businesses.find(b=>b.name==='Krishna Kitchen');
 assert.equal(kitchen.existingBusinessId,undefined,'co-located kitchens with different brand names stay distinct');
 for(const b of listing.batch.businesses.filter(b=>b.retrieval_method==='public_search_index'))assert.doesNotMatch(b.directory_attribution,/IndiaRestros/);
});
test('city directory queries serialize only relevant source profiles',async()=>{
 let handler,values;require('../lib/business-directory')({get:(p,h)=>{handler=h;}},async(s,...v)=>{values=v;return [];});
 await handler({query:{city:'Jalna'}},{set(){},json(){}});
 const rows=JSON.parse(values[0]);assert.ok(rows.length>200);assert.ok(rows.every(b=>b.city.toLowerCase()==='jalna'));
 assert.ok(rows.length<catalog.listingRows.length/10);
});
test('directory query returns matched menu links without overwriting owner-submitted menu links',async()=>{
 const register=require('../lib/business-directory'),entry=catalog.listingRows.find(b=>b.id.startsWith('directory:jalna-menu-'));
 let handler,body;register({get:(p,h)=>{handler=h;}},async()=>[
  {id:'restaurant:1',sourceProfileId:entry.id,matchCount:2,menuUrl:null},
  {id:'submission:1',sourceProfileId:entry.id,matchCount:2,menuUrl:'https://owner.example/menu'}]);
 await handler({query:{city:'Jalna'}},{set(){},json(d){body=d;}});
 assert.equal(body.businesses[0].menuUrl,entry.menuUrl);
 assert.equal(body.businesses[1].menuUrl,'https://owner.example/menu');
});
