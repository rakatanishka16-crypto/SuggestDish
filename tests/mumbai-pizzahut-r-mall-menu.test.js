const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const chains=require('../lib/chain-source-catalog');
const file=path.join(__dirname,'../api/source-batches/mumbai-pizzahut-r-mall-menu-2026-10-13.json.gz');
const data=JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
const items=Object.values(data.menu_sets).flatMap(set=>set.items);
const sourceKey='official:sd-food-cd832e85898cd156a795';
const source=require('../lib/source-catalog');

test('R Mall Mulund keeps 135 exact official branch-menu entries',()=>{
  assert.equal(data.businesses.length,0);
  assert.equal(items.length,135);
  assert.equal(new Set(items.map(item=>item.external_id)).size,135);
  assert.ok(items.every(item=>item.price_inr===null&&item.recommendation_eligible===false));
  assert.ok(items.every(item=>item.source_url.includes('mulund-west-mumbai-1135/Menu')));
});

test('R Mall menu attaches only to the existing exact branch identity',()=>{
  const business=chains.businesses.find(item=>item.sourceKey===sourceKey);
  assert.ok(business);
  assert.equal(business.name,'Pizza Hut - R Mall Mulund, Mumbai');
  const menu=chains.menuFor(business);
  assert.equal(menu.menuScope,'outlet_page');
  assert.equal(menu.menuItems.length,135);
  assert.ok(menu.menuItems.every(item=>item.source_business_id===sourceKey));
  assert.equal(menu.menuItems.find(item=>item.name==='My Box Pasta Veg').is_veg,true);
  assert.equal(menu.menuItems.find(item=>item.name==='My Box Pasta Non Veg').is_veg,false);
});

test('public source API selects the newer exact branch menu',()=>{
  let handler,result;
  source({get(route,fn){if(route==='/api/business-source')handler=fn;}});
  handler({query:{businessId:sourceKey}},{set(){},json(value){result=value;}});
  assert.equal(result.menuScope,'outlet_page');
  assert.equal(result.menuItems.length,135);
  assert.ok(result.menuItems.every(item=>item.source_business_id===sourceKey));
  assert.ok(result.menuItems.every(item=>item.price_inr===null&&item.recommendation_eligible===false));
});
