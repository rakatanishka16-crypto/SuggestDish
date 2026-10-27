'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const imported=require('../lib/jalna-priced-menus');
const catalog=require('../lib/source-catalog');

test('remaining exact source branches add priced menus without claiming a legacy restaurant identity',()=>{
 assert.equal(imported.original.businesses.length,35);
 assert.equal(imported.followup.businesses.length,10);
 assert.equal(imported.followup.menu_items.length,572);
 assert.equal(imported.batch.summary.publishedMenuProfiles,45);
 assert.equal(imported.batch.summary.pricedMenuItems,2743);
 assert.equal(imported.batch.summary.pendingOrHeldListings,19);
 for(const b of imported.followup.businesses){
  assert.equal(b.existing_database_association,'unresolved_not_merged');assert.equal(b.existingBusinessId,undefined);
  assert.equal(b.latitude,null);assert.equal(b.longitude,null);
  assert.equal(b.address,b.branch_review.expected_address);assert.equal(b.menu_upstream_url,b.branch_review.expected_upstream_url);
  assert.ok(b.name.includes(b.branch_review.branch_label));
  const row=catalog.listingRows.find(r=>r.id===b.sourceKey);assert.ok(row?.hasPricedMenu);
  for(const item of imported.menuFor(b).menuItems){assert.equal(item.source_business_id,b.sourceKey);assert.ok(item.price_inr>0);assert.equal(item.upstream_source_url,b.menu_upstream_url);}
 }
 const stock=imported.followup.businesses.find(b=>b.external_id==='IRR-S0EQ9HMBD6');
 assert.match(stock.menu_upstream_url,/stock-cafe-1-jalna-locality/);
 assert.match(stock.address,/Krishna Mall/);
 const goli=imported.followup.businesses.find(b=>b.external_id==='IRR-TPD0MHXYN4');
 assert.match(goli.menu_upstream_url,/goli-vada-pav-no-1-1-jalna-locality/);assert.match(goli.address,/Old Mondha/);
});

test('new branch menus never overwrite an incomplete same-name legacy record',()=>{
 const legacy={sourceKey:'restaurant:12',name:'Atithi Veg',address:'Legacy area',source_urls:['https://owner.example/'],ownerVerified:true};
 const result=imported.apply([legacy]);assert.deepEqual(result.find(b=>b.sourceKey===legacy.sourceKey),legacy);
 assert.ok(result.some(b=>b.sourceKey!==legacy.sourceKey&&b.name==='Atithi Veg — Ring Road'));
 assert.equal(imported.menuFor(legacy),null);assert.equal(imported.apply(result).length,result.length);
});
