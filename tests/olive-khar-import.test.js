const test=require('node:test'),assert=require('node:assert/strict');
const {load,sourceKey}=require('../lib/olive-khar-import-scope');
const {plan,register}=require('../lib/catalogue-import');
const data=load();
test('Olive scoped plan promotes only 41 reviewed foods at the exact Khar outlet',()=>{
 const p=plan(data);assert.equal(p.outlets.length,1);assert.equal(p.summary.promotionDishes,41);assert.equal(p.observations.length,83);
 assert.equal(p.outlets[0].business.sourceKey,sourceKey);assert.equal(p.outlets[0].business.latitude,null);
 assert.equal(data.menuItems.filter(m=>m.is_veg===true).length,25);assert.equal(data.menuItems.filter(m=>m.is_veg===false).length,16);
 assert.ok(p.outlets[0].dishes.every(d=>d.payload.tax_included===false&&d.name.includes(d.payload.portion)));
 assert.ok(!p.outlets[0].dishes.some(d=>d.name.includes('Lamb Chop')));
});
test('reviewed item scope fails closed on wrong branch, missing evidence, duplicates or incomplete data',()=>{
 const mutate=fn=>{const b={...data.businesses[0]};const rows=data.menuItems.map(m=>({...m}));fn(b,rows);return ()=>load({businesses:[b],menuFor:()=>({menuScope:'outlet_observed',menuItems:rows})});};
 for(const fn of [(b,r)=>{b.city='Pune'},(b,r)=>r.pop(),(b,r)=>{r[0].is_veg=null},(b,r)=>{r[0].source_url='https://example.com/menu'},(b,r)=>{r[0].source_business_id='other'},(b,r)=>{r[0].recommendation_eligible=false},(b,r)=>{r[1]=r[0]}])assert.throws(mutate(fn));
});
test('scoped plan is read only and requires private access; digest cannot be reused for writes',async()=>{
 let handler;register({post:(p,h)=>handler=h},{env:{SOURCE_CATALOG_IMPORT_KEY:'x'.repeat(40)},load:()=>{throw Error('Must not load full catalog')},connect:()=>{throw Error('Must not connect')}});
 const res={status(n){this.code=n;return this},json(b){this.body=b;return this}};
 await handler({headers:{},body:{scope:'mumbai-olive-khar-2026-10-21'}},res);assert.equal(res.code,403);
 const headers={authorization:'Bearer '+'x'.repeat(40)};
 await handler({headers,body:{scope:'mumbai-olive-khar-2026-10-21',stage:'plan'}},res);assert.equal(res.body.promotionDishes,41);
 await handler({headers,body:{scope:'mumbai-olive-khar-2026-10-21',stage:'publish',digest:'wrong'}},res);assert.equal(res.code,409);
});
