const test=require('node:test'),assert=require('node:assert/strict');
const {load,batch,sourceKey}=require('../lib/mumbai-sudama-import-scope');
const {plan}=require('../lib/catalogue-import');
test('Sudama plan contains thirteen priced vegetarian dosa variants at one exact outlet',()=>{
 const p=plan(load());assert.equal(p.summary.promotionDishes,13);assert.equal(p.outlets.length,1);assert.equal(p.outlets[0].business.sourceKey,sourceKey);
 assert.ok(p.outlets[0].dishes.every(d=>d.isVeg&&d.price>=150&&d.price<=269&&d.payload.tax_included===false));
 assert.equal(p.outlets[0].business.latitude,null);assert.equal(p.outlets[0].business.longitude,null);
 assert.equal(p.outlets[0].dishes.find(d=>d.name==='Dosa - Masala').price,190);
 assert.equal(p.outlets[0].dishes.find(d=>d.name==='Neer Dosa (4 pcs)').price,150);
});
test('Sudama scope rejects unrelated branches, incomplete rows and missing dietary evidence',()=>{
 for(const mutate of [d=>d.menu_items.pop(),d=>d.menu_items[0].source_business_id='other',d=>d.menu_items[0].is_veg=null,d=>d.menu_items[0].source_url='https://example.com/menu',d=>d.businesses[0].city='Jalna']) {
  const d=JSON.parse(JSON.stringify(batch));mutate(d);assert.throws(()=>load(d));
 }
});
test('Sudama endpoint plans only this outlet and rejects writes with the wrong digest',async()=>{
 let handler;require('../lib/catalogue-import').register({post:(p,h)=>{handler=h;}},{env:{SOURCE_CATALOG_IMPORT_KEY:'x'.repeat(40)},load:()=>{throw Error('Full catalog must not load');},connect:()=>{throw Error('Must not write');}});
 const res={status(n){this.code=n;return this;},json(d){this.body=d;return this;}};
 await handler({headers:{},body:{scope:'mumbai-sudama-dosa-2026-10-23'}},res);assert.equal(res.code,403);
 const headers={authorization:'Bearer '+'x'.repeat(40)};
 await handler({headers,body:{scope:'mumbai-sudama-dosa-2026-10-23',stage:'plan'}},res);assert.equal(res.body.promotionDishes,13);assert.equal(res.body.promotionOutlets,1);
 await handler({headers,body:{scope:'mumbai-sudama-dosa-2026-10-23',stage:'publish',digest:'wrong'}},res);assert.equal(res.code,409);
});
