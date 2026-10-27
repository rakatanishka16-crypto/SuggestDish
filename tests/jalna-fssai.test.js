'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fssai=require('../lib/jalna-fssai'),catalog=require('../lib/source-catalog');

test('FoSCoS import preserves all approved numbers and holds non-outlets and district conflicts',()=>{
 assert.equal(fssai.batch.registry_records.length,3346);
 assert.equal(new Set(fssai.batch.registry_records.map(r=>r.number)).size,3346);
 assert.equal(fssai.batch.businesses.length,3324);
 assert.equal(fssai.batch.businesses.reduce((n,b)=>n+b.fssai_records.length,0),3329);
 assert.deepEqual(fssai.batch.summary.heldReasons,{institution_not_public_food_outlet:10,medical_store_not_public_food_outlet:5,conflicting_district_locality:2});
 for(const held of fssai.batch.held_records)assert.ok(!catalog.listingRows.some(b=>b.id==='official:fssai-'+held.record.number));
 const alcohol=/\b(?:beer|baar|permit\s*room|wines?|liquor|restrobar|restobar|pub)\b/i;
 for(const b of fssai.batch.businesses){
  assert.doesNotMatch(b.name,alcohol);assert.equal(b.recommendation_eligible,false);
  assert.equal(b.latitude,null);assert.equal(b.longitude,null);assert.equal(b.phone,null);assert.equal(b.restaurant_rating,null);assert.equal(b.operating_status,null);
  for(const r of b.fssai_records){assert.match(r.number,/^\d{14}$/);assert.equal(r.status,'Active');assert.match(r.checkedOn,/^2026-10-2[67]$/);assert.equal(new URL(r.sourceUrl).hostname,'foscos.fssai.gov.in');}
 }
 assert.equal(fssai.batch.menu_items.length,0);
});

test('district towns stay separate and ambiguous physical venues are not merged by name alone',()=>{
 assert.equal(fssai.batch.businesses.filter(b=>b.city==='Jalna').length,1316);
 for(const b of fssai.batch.businesses.filter(b=>b.fssai_records[0].localityTag==='Partur'))assert.equal(b.city,'Partur');
 const entry=fssai.batch.businesses[0];
 const known={sourceKey:'official:known',name:entry.name,address:entry.address,city:entry.city,latitude:19.8,longitude:75.9,source_urls:['https://owner.example/menu'],ownerVerified:true};
 const merged=fssai.apply([known]);const enriched=merged.businesses.find(b=>b.sourceKey===known.sourceKey);
 assert.equal(merged.summary.existingProfilesEnriched,1);assert.equal(enriched.latitude,19.8);assert.equal(enriched.ownerVerified,true);assert.deepEqual(enriched.source_urls,known.source_urls);assert.equal(enriched.fssai_records[0].number,entry.fssai_records[0].number);assert.equal(known.fssai_records,undefined);
 const replay=fssai.apply(merged.businesses);assert.equal(replay.businesses.length,merged.businesses.length);assert.equal(new Set(replay.businesses.flatMap(b=>(b.fssai_records||[]).map(r=>r.number))).size,3329);
 const different=fssai.apply([{...known,address:'A different branch'}]);assert.ok(different.businesses.some(b=>b.sourceKey===entry.sourceKey));
});

test('registry profiles cannot borrow brand menus and source responses expose dated status honestly',()=>{
 const entry=fssai.batch.businesses.find(b=>b.category==='shop:bakery');
 const menu=catalog.importData.menuFor({...entry,brand:'PizzaExpress'});assert.equal(menu.menuScope,'none');assert.deepEqual(menu.menuItems,[]);
 const routes=new Map();catalog({get:(p,h)=>routes.set(p,h)});let body;
 routes.get('/api/business-source')({query:{businessId:entry.sourceKey}},{set(){},json(v){body=v;}});
 assert.equal(body.business.fssai_records[0].status,'Active');assert.match(body.notice,/does not verify/);assert.deepEqual(body.menuItems,[]);
 assert.equal(catalog.coverage.registryRecordsChecked,3329);
});

test('real PostgreSQL directory queries find FSSAI bakeries with metadata and preserve town and category filters',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE "Restaurant" (id integer,name text,address text,city text,latitude double precision,longitude double precision);
   CREATE TABLE "Dish" (id integer,"restaurantId" integer);
   CREATE TABLE "HorecaCandidate" ("sourceKey" text,name text,category text,address text,city text,"sourceUrl" text,"reviewStatus" text,"restaurantId" integer,latitude double precision,longitude double precision);
   CREATE TABLE "BusinessSubmission" (id integer,"businessName" text,category text,address text,city text,"profileUrl" text,status text,"restaurantId" integer,"verificationNotes" text,"menuUrl" text);`);
  let handler;require('../lib/business-directory')({get:(p,h)=>handler=h},async(parts,...values)=>{
   const sql=parts.reduce((text,part,i)=>text+(i?'$'+i:'')+part,'');return (await db.query(sql,values)).rows;
  });
  const run=async query=>{let body,status=200;await handler({query},{set(){},status(n){status=n;return this;},json(v){body=v;}});assert.equal(status,200);return body;};
  const result=await run({city:'Jalna',q:'NEW MAHARAJA BAKERY',category:'bakery'});
  assert.equal(result.total,1);const b=result.businesses[0];assert.equal(b.city,'Jalna');assert.equal(b.fssaiRecords[0].number,'11519045000079');assert.equal(b.reviewStatus,'fssai_registry');assert.equal(b.distanceKm,null);assert.equal(b.menuUrl,null);
  assert.equal((await run({city:'Partur',q:'NEW MAHARAJA BAKERY'})).total,0);
  assert.equal((await run({city:'Jalna',q:'NEW MAHARAJA BAKERY',category:'hotel'})).total,0);
  const first=await run({city:'Bhokardan',limit:'2'}),next=await run({city:'Bhokardan',limit:'2',offset:'2'});
  assert.equal(first.hasMore,true);assert.equal(first.total,next.total);assert.ok(first.businesses.every(a=>!next.businesses.some(b=>a.id===b.id)));
 }finally{await db.close();}
});
