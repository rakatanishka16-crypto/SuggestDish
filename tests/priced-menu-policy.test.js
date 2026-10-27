'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {metadata}=require('../lib/priced-menu-policy');
const business={sourceKey:'official:branch'},item={name:'Dosa',price_inr:100,source_business_id:'official:branch',source_url:'https://restaurant.example/menu',is_veg:null};
test('outlet price evidence qualifies without guessing diet or borrowing national menus',()=>{
 const priced=metadata(business,{menuScope:'outlet_page',menuItems:[item]});assert.equal(priced.hasPricedMenu,true);assert.deepEqual(priced.pricedMenuItems[0],{name:'Dosa',price:100,portion:null,sourceUrl:item.source_url});
 for(const scope of ['none','external_link','brand_reference','documented_references'])assert.equal(metadata(business,{menuScope:scope,menuItems:[item]}).hasPricedMenu,false);
 assert.equal(metadata(business,{menuScope:'outlet_page',menuItems:[{...item,source_business_id:'official:other-branch'}]}).hasPricedMenu,false);
});
test('unpriced, non-finite, conflicting or unsupported observations do not keep a listing public',()=>{
 for(const patch of [{price_inr:null},{price_inr:0},{price_inr:NaN},{price_inr:Infinity},{price_inr:-5},{price_inr:'100'},{source_url:'javascript:alert(1)'},{source_url:'https://user:secret@example.com/menu'},{data_conflict:true},{price_min_inr:80,price_max_inr:120},{name:''}])assert.equal(metadata(business,{menuScope:'outlet_observed',menuItems:[{...item,...patch}]}).hasPricedMenu,false);
 const mixed=metadata(business,{menuScope:'outlet_page',menuItems:[{...item,price_inr:null},item]});assert.equal(mixed.pricedMenuCount,1);
});
