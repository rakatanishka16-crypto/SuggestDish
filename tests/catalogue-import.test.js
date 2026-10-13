const test=require('node:test'),assert=require('node:assert/strict');
const {plan,hold,register,applyBatch}=require('../lib/catalogue-import');
const b={sourceKey:'outlet:a',name:'A',city:'Mumbai',address:'A street'};
const m={external_id:'dish:a',name:'Poha',price_inr:60,is_veg:true,source_business_id:b.sourceKey,source_url:'https://example.org/menu',retrieved_on:'2026-10-13',data_conflict:false};
test('only exact outlet menus with explicit prices and diets enter recommendations',()=>{
 assert.equal(hold(b,m,'outlet_page'),null);
 for(const [patch,scope,reason] of [[{},'brand_reference','not_outlet_menu'],[{source_business_id:'other'},'outlet_page','not_outlet_menu'],[{is_veg:null},'outlet_page','unknown_diet'],[{price_inr:null},'outlet_page','missing_explicit_price'],[{data_conflict:true},'outlet_page','source_conflict'],[{price_min_inr:50},'outlet_page','variant_price_range']])assert.equal(hold(b,{...m,...patch},scope),reason);
});
test('all observations are preserved while unknown diets and conflicts are held',()=>{
 const menus=[m,{...m,external_id:'unknown',is_veg:null},{...m,external_id:'conflict',data_conflict:true}];const p=plan({businesses:[b],menuItems:menus,menuFor:()=>({menuScope:'outlet_page',menuItems:menus})});assert.equal(p.summary.observations,7);assert.equal(p.summary.promotionDishes,1);assert.equal(p.summary.heldAssociations.unknown_diet,1);assert.equal(p.summary.heldAssociations.source_conflict,1);
 assert.equal(p.digest,plan({businesses:[b],menuItems:[...menus].reverse(),menuFor:()=>({menuScope:'outlet_page',menuItems:[...menus].reverse()})}).digest);
});
test('conflicting prices for the same dish are held and distinct portions survive',()=>{
 const p=plan({businesses:[b],menuItems:[],menuFor:()=>({menuScope:'outlet_page',menuItems:[m,{...m,external_id:'other',price_inr:70},{...m,external_id:'portion',portion:'500 ml'}]})});assert.equal(p.summary.promotionDishes,1);assert.match(p.outlets[0].dishes[0].name,/500 ml/);
});
test('maintenance endpoint fails closed and does not create a database client',async()=>{
 let h,connected=false;register({post:(path,fn)=>h=fn},{env:{},connect:async()=>{connected=true;}});let status,body;await h({headers:{},body:{}},{status:n=>{status=n;return {json:b=>body=b};}});assert.equal(status,403);assert.equal(connected,false);
});
test('plan is read only and applying requires the exact current digest',async()=>{
 let h;const key='a'.repeat(40);register({post:(path,fn)=>h=fn},{env:{SOURCE_CATALOG_IMPORT_KEY:key},load:()=>({businesses:[],menuItems:[],menuFor:()=>null}),connect:async()=>{throw Error('Must not connect');}});
 const res={json:b=>res.body=b,status:n=>{res.statusCode=n;return res;}};await h({headers:{authorization:'Bearer '+key},body:{stage:'plan'}},res);assert.equal(res.body.success,true);await h({headers:{authorization:'Bearer '+key},body:{stage:'publish',digest:'wrong'}},res);assert.equal(res.statusCode,409);
});
test('archive failure rolls back and never marks the batch successful',async()=>{
 const calls=[];const client={query:async(q)=>{calls.push(q);if(q.startsWith('INSERT INTO public."CatalogueObservation"'))throw Error('fail');return {rows:[]};}};
 await assert.rejects(applyBatch(client,{digest:'x',observations:[{}],outlets:[]},'archive',0));assert.equal(calls.at(-1),'ROLLBACK');assert.ok(!calls.some(q=>q.startsWith('INSERT INTO public."CatalogueImportRun"')));
});
test('completed batches replay without duplicate writes',async()=>{
 const calls=[];const client={query:async(q)=>{calls.push(q);return {rows:q.startsWith('SELECT result')?[{result:{done:true}}]:[]};}};assert.equal((await applyBatch(client,{digest:'x',observations:[],outlets:[]},'archive',0)).replayed,true);assert.equal(calls.at(-1),'COMMIT');assert.ok(!calls.some(q=>q.startsWith('INSERT')));
});
