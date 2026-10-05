const test=require('node:test'),assert=require('node:assert/strict'),catalog=require('../lib/chain-source-catalog');
test('viral-food additions preserve real branch locations and business-published Google links',()=>{
 const rows=catalog.businesses.filter(b=>['Kunafa World','Kunafa Bytes','Cafe 9 Story'].includes(b.brand));
 assert.equal(rows.length,41);assert.equal(rows.filter(b=>b.google_maps_url).length,22);
 const local=rows.find(b=>b.brand==='Kunafa Bytes' && b.city==='Aurangabad');assert.ok(local);assert.match(local.address,/Chhatrapati Sambhajinagar/);assert.match(local.google_maps_url,/share.google/);
 assert.ok(!rows.some(b=>b.brand==='Kunafa Bytes' && b.locality==='Adajan'));
 for(const b of rows){assert.equal(b.restaurant_rating,null);assert.equal(b.review_count,null);assert.equal(b.latitude,null);assert.equal(b.recommendation_eligible,false);}
});
test('Biscoff cheesecake price stays on its Surat cafe menu; kunafa catalog prices never become confirmed branch prices',()=>{
 const cafe=catalog.businesses.find(b=>b.brand==='Cafe 9 Story');assert.equal(cafe.city,'Surat');const menu=catalog.menuFor(cafe);assert.equal(menu.menuScope,'outlet_page');assert.equal(menu.menuItems.find(m=>m.name==='Biscoff Cheesecake').price_inr,310);assert.equal(menu.menuItems.length,26);
 for(const b of catalog.businesses.filter(b=>['Kunafa World','Kunafa Bytes'].includes(b.brand))){const reference=catalog.menuFor(b);assert.equal(reference.menuScope,'brand_reference');for(const m of reference.menuItems){if(m.name==='Dubai Kunafa Chocolate'){assert.equal(m.price_inr,320);assert.equal(m.portion,'55 g');assert.match(m.price_scope,/outlet price unconfirmed/);}else assert.equal(m.price_inr,null);assert.equal(m.branch_availability,'not_confirmed');assert.equal(m.source_business_id,null);}}
});
