'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const links=require('../lib/jalna-menu-link-listings'),catalog=require('../lib/source-catalog');
test('exactly the 19 requested missing menus are visible as links without invented dishes or prices',()=>{
 assert.equal(links.businesses.length,19);
 const requested=links.businesses.map(b=>b.name).sort();
 const publicLinks=catalog.listingRows.filter(b=>b.menuLinkOnly);
 assert.equal(publicLinks.length,19);assert.deepEqual(publicLinks.map(b=>b.name).sort(),requested);
 for(const row of publicLinks){
  assert.equal(row.city,'Jalna');assert.equal(row.hasPricedMenu,false);assert.equal(row.pricedMenuCount,0);assert.deepEqual(row.pricedMenuItems,[]);
  assert.match(row.menuUrl,/^https:\/\/www\.zomato\.com\/jalna\//);
  const business=catalog.importData.businesses.find(b=>b.sourceKey===row.id);
  assert.equal(business.publish_ready,false);assert.equal(business.recommendation_eligible,false);
  const menu=catalog.importData.menuFor(business);assert.equal(menu.menuScope,'external_link');assert.deepEqual(menu.menuItems,[]);assert.match(menu.menuNotice,/Prices unavailable/);
 }
 const original=[{sourceKey:'directory:existing',name:'Owner title',city:'Jalna',address:'Owner address',source_urls:[links.businesses[0].source_urls[0]]}];
 const once=links.apply(original),twice=links.apply(once);
 assert.equal(once.length,19);assert.deepEqual(twice,once);assert.equal(once[0].name,'Owner title');assert.equal(once[0].address,'Owner address');assert.equal(original[0].menu_link_only,undefined);
});
test('directory binds only priced profiles or the explicit exceptions and returns honest price availability',async()=>{
 let handler,body,bound;
 const rows=catalog.listingRows.filter(b=>b.menuLinkOnly);
 require('../lib/business-directory')({get:(p,h)=>handler=h},async(parts,...values)=>{
  bound=JSON.parse(values.find(v=>typeof v==='string'&&v.startsWith('[')));
  return rows.map(b=>({id:b.id,name:b.name,sourceProfileId:b.id,pricedMenuCount:0,pricedMenuItems:null,matchCount:19}));
 });
 await handler({query:{city:'Jalna'}},{set(){},json(v){body=v;}});
 assert.equal(body.businesses.length,19);assert.equal(body.total,19);
 assert.ok(bound.every(b=>b.hasPricedMenu||b.menuLinkOnly));assert.equal(bound.filter(b=>b.menuLinkOnly).length,19);
 for(const b of body.businesses){assert.equal(b.hasPricedMenu,false);assert.equal(b.menuLinkOnly,true);assert.equal(b.pricedMenuCount,0);assert.deepEqual(b.pricedMenuItems,[]);assert.ok(b.menuUrl);}
 const routes=new Map();catalog({get:(p,h)=>routes.set(p,h)});let coverage;
 routes.get('/api/data-coverage')({}, {set(){},json(v){coverage=v;}});
 assert.equal(coverage.unpricedRequestedMenuListings,19);assert.equal(coverage.jalnaPricedMenus.pricedMenuItems,2743);
});
