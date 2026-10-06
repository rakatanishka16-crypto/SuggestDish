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
