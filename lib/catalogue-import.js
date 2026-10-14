'use strict';
const crypto=require('node:crypto');
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const norm=v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const https=v=>{try{return new URL(v).protocol==='https:';}catch{return false;}};
function hold(b,m,scope){
 if(scope!=='outlet_page'||m.source_business_id!==b.sourceKey)return 'not_outlet_menu';
 if(!b.name||!b.city||!b.address)return 'missing_outlet_identity';
 if(b.possibly_closed===true||b.currently_operating===false)return 'possibly_closed';
 if(b.data_conflict||m.data_conflict||/review|ambiguous|conflict/i.test(m.verification_status||''))return 'source_conflict';
 if(!Number.isFinite(m.price_inr)||m.price_inr<=0||m.price_inr>100000)return 'missing_explicit_price';
 if(m.price_min_inr!=null||m.price_max_inr!=null)return 'variant_price_range';
 if(typeof m.is_veg!=='boolean')return 'unknown_diet';
 if(!https(m.source_url)||!/^\d{4}-\d{2}-\d{2}$/.test(m.retrieved_on||''))return 'missing_provenance';
 return null;
}
function plan(data){
 const records=new Map(),outlets=[],held={},cityCounts={};
 const add=(kind,id,payload)=>{const h=hash(payload);records.set(kind+':'+id+':'+h,{kind,id,hash:h,payload});};
 for(const b of data.businesses){
  add('outlet',b.sourceKey,b);const menu=data.menuFor(b)||{menuScope:'none',menuItems:[]};const dishes=[];
  if(menu.menuScope!=='outlet_page'){held.reference_or_directory_profiles=(held.reference_or_directory_profiles||0)+1;continue;}
  for(const m of menu.menuItems){
   add('menu_association',b.sourceKey+':'+(m.external_id||hash(m)),{businessId:b.sourceKey,scope:menu.menuScope,item:m});
   const reason=hold(b,m,menu.menuScope);if(reason){held[reason]=(held[reason]||0)+1;continue;}
   const name=m.portion&&!norm(m.name).includes(norm(m.portion))?`${m.name} (${m.portion})`:m.name;
   dishes.push({key:m.external_id||hash(m),name,price:m.price_inr,isVeg:m.is_veg,sourceUrl:m.source_url,checkedOn:m.retrieved_on,payload:m});
  }
  const identities=new Map();for(const d of dishes){const key=norm(d.name);const prev=identities.get(key);if(prev&&(prev.price!==d.price||prev.isVeg!==d.isVeg)){prev.conflict=true;d.conflict=true;}else if(!prev)identities.set(key,d);}
  const safe=[...identities.values()].filter(d=>!d.conflict);held.duplicate_or_conflicting_dish=(held.duplicate_or_conflicting_dish||0)+dishes.length-safe.length;
  if(safe.length){outlets.push({business:b,dishes:safe});cityCounts[b.city]=(cityCounts[b.city]||0)+1;}
 }
 for(const m of data.menuItems)add('menu_reference',m.external_id||hash(m),m);
 for(const kind of ['businesses','outlets','dishes','dish_signals','social_profiles','sources'])for(const row of data.acquisition?.[kind]||[])add('acquisition_'+kind,hash(row),row);
 const observations=[...records.values()].sort((a,b)=>(a.kind+a.id+a.hash).localeCompare(b.kind+b.id+b.hash));
 const digest=hash(observations.map(r=>[r.kind,r.id,r.hash]));
 return {digest,observations,outlets,summary:{outletProfiles:data.businesses.length,observations:observations.length,promotionOutlets:outlets.length,promotionDishes:outlets.reduce((n,o)=>n+o.dishes.length,0),promotionOutletCities:cityCounts,heldAssociations:held}};
}
const schema=`CREATE TABLE IF NOT EXISTS public."CatalogueObservation" (kind TEXT NOT NULL,"sourceId" TEXT NOT NULL,"payloadHash" TEXT NOT NULL,payload JSONB NOT NULL,"importedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(kind,"sourceId","payloadHash"));
CREATE TABLE IF NOT EXISTS public."CatalogueRestaurant" ("sourceKey" TEXT PRIMARY KEY,"restaurantId" INTEGER NOT NULL REFERENCES public."Restaurant"(id));
CREATE TABLE IF NOT EXISTS public."CatalogueDish" ("sourceKey" TEXT NOT NULL,"sourceDishId" TEXT NOT NULL,"dishId" INTEGER NOT NULL REFERENCES public."Dish"(id),"sourceUrl" TEXT NOT NULL,"checkedOn" DATE NOT NULL,payload JSONB NOT NULL,PRIMARY KEY("sourceKey","sourceDishId"));
CREATE TABLE IF NOT EXISTS public."CatalogueImportRun" (digest TEXT NOT NULL,stage TEXT NOT NULL,"batchOffset" INTEGER NOT NULL,result JSONB NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(digest,stage,"batchOffset"));`;
async function applyBatch(client,p,stage,offset){
 const size=stage==='archive'?500:5;
 const rows=(stage==='archive'?p.observations:p.outlets).slice(offset,offset+size);
 const result={stage,offset,nextOffset:offset+rows.length,done:offset+rows.length>=(stage==='archive'?p.observations:p.outlets).length,observationsInserted:0,restaurantsInserted:0,dishesInserted:0,dishesLinked:0,conflicts:[],digest:p.digest};
 await client.query('BEGIN');
 try{
  await client.query('SELECT pg_advisory_xact_lock(74199322)');await client.query(schema);
  const prior=await client.query('SELECT result FROM public."CatalogueImportRun" WHERE digest=$1 AND stage=$2 AND "batchOffset"=$3',[p.digest,stage,offset]);
  if(prior.rows.length){await client.query('COMMIT');return {...prior.rows[0].result,replayed:true};}
  if(stage==='archive'){
   const r=await client.query(`INSERT INTO public."CatalogueObservation"(kind,"sourceId","payloadHash",payload) SELECT kind,id,hash,payload FROM jsonb_to_recordset($1::jsonb) AS x(kind TEXT,id TEXT,hash TEXT,payload JSONB) ON CONFLICT DO NOTHING`,[JSON.stringify(rows)]);result.observationsInserted=r.rowCount;
  }else for(const o of rows){
   const b=o.business;
   const linked=await client.query('SELECT "restaurantId" AS id FROM public."CatalogueRestaurant" WHERE "sourceKey"=$1',[b.sourceKey]);let rid=linked.rows[0]?.id;
   if(!rid){
    const matched=await client.query('SELECT id FROM public."Restaurant" WHERE LOWER(TRIM(name))=LOWER(TRIM($1)) AND LOWER(TRIM(city))=LOWER(TRIM($2)) AND LOWER(TRIM(address))=LOWER(TRIM($3))',[b.name,b.city,b.address]);
    if(matched.rows.length>1){result.conflicts.push({sourceKey:b.sourceKey,reason:'ambiguous_existing_outlet'});continue;}
    rid=matched.rows[0]?.id;
    if(!rid){const r=await client.query('INSERT INTO public."Restaurant"(name,address,city,latitude,longitude,"updatedAt") VALUES($1,$2,$3,$4,$5,NOW()) RETURNING id',[b.name,b.address,b.city,Number.isFinite(b.latitude)&&Math.abs(b.latitude)<=90?b.latitude:null,Number.isFinite(b.longitude)&&Math.abs(b.longitude)<=180?b.longitude:null]);rid=r.rows[0].id;result.restaurantsInserted++;}
    await client.query('INSERT INTO public."CatalogueRestaurant"("sourceKey","restaurantId") VALUES($1,$2)',[b.sourceKey,rid]);
   }
   for(const d of o.dishes){
    const linked=await client.query('SELECT "dishId" FROM public."CatalogueDish" WHERE "sourceKey"=$1 AND "sourceDishId"=$2',[b.sourceKey,d.key]);if(linked.rows.length)continue;
    const matches=await client.query('SELECT id,price,"isVeg" FROM public."Dish" WHERE "restaurantId"=$1 AND LOWER(TRIM(name))=LOWER(TRIM($2))',[rid,d.name]);let did;
    if(matches.rows.length){if(matches.rows.length!==1||Number(matches.rows[0].price)!==d.price||matches.rows[0].isVeg!==d.isVeg){result.conflicts.push({sourceKey:b.sourceKey,sourceDishId:d.key,reason:'existing_price_or_diet_conflict'});continue;}did=matches.rows[0].id;}
    else{const r=await client.query('INSERT INTO public."Dish"(name,price,"isVeg","restaurantId","updatedAt") VALUES($1,$2,$3,$4,NOW()) RETURNING id',[d.name,d.price,d.isVeg,rid]);did=r.rows[0].id;result.dishesInserted++;}
    await client.query('INSERT INTO public."CatalogueDish"("sourceKey","sourceDishId","dishId","sourceUrl","checkedOn",payload) VALUES($1,$2,$3,$4,$5::date,$6::jsonb)',[b.sourceKey,d.key,did,d.sourceUrl,d.checkedOn,JSON.stringify(d.payload)]);result.dishesLinked++;
    await client.query('INSERT INTO public."DishSignal"("dishId",source) SELECT $1,$2 WHERE NOT EXISTS(SELECT 1 FROM public."DishSignal" WHERE "dishId"=$1 AND source=$2)',[did,d.sourceUrl]);
   }
  }
  await client.query('INSERT INTO public."CatalogueImportRun"(digest,stage,"batchOffset",result) VALUES($1,$2,$3,$4::jsonb)',[p.digest,stage,offset,JSON.stringify(result)]);await client.query('COMMIT');return result;
 }catch(e){await client.query('ROLLBACK');throw e;}
}
function register(app,{env=process.env,connect,load=()=>require('./source-catalog').importData,loadScoped=()=>require('./mumbai-menu-import-scope').load()}={}){
 const cache=new Map();
 app.post('/api/catalogue-import',async(req,res)=>{
  const key=env.SOURCE_CATALOG_IMPORT_KEY,sha=s=>crypto.createHash('sha256').update(s).digest();
  if(!key||key.length<32||!crypto.timingSafeEqual(sha(req.headers.authorization||''),sha('Bearer '+key)))return res.status(403).json({success:false,error:'Private catalogue import access required.'});
  const stage=req.body?.stage||'plan',offset=req.body?.offset??0;
  const scope=req.body?.scope??'all';
  if(!['all','mumbai-400001-expansion-2026-10-14','mumbai-hopleaf-samraj-2026-10-14','mumbai-400001-2026-10-14','mumbai-400001-followup-2026-10-14'].includes(scope))return res.status(400).json({success:false,error:'Unknown import scope.'});
  if(!['plan','archive','publish'].includes(stage)||!Number.isSafeInteger(offset)||offset<0)return res.status(400).json({success:false,error:'Invalid import batch.'});
  try{
   if(!cache.has(scope))cache.set(scope,plan(scope==='all'?load():scope==='mumbai-400001-expansion-2026-10-14'?require('./mumbai-postal-expansion').load():scope==='mumbai-400001-followup-2026-10-14'?require('./mumbai-postal-followup').load():scope==='mumbai-400001-2026-10-14'?require('./mumbai-postal-import-scope').load():loadScoped()));
   const cached=cache.get(scope);
   if(stage==='plan')return res.json({success:true,digest:cached.digest,...cached.summary});
   if(req.body?.digest!==cached.digest)return res.status(409).json({success:false,error:'Confirm the current import plan digest.'});
   const client=connect?await connect():new(require('pg').Client)({connectionString:env.DATABASE_URL,connectionTimeoutMillis:10000,query_timeout:25000});
   if(!connect)await client.connect();try{res.json({success:true,...await applyBatch(client,cached,stage,offset)});}finally{await client.end();}
  }catch{return res.status(503).json({success:false,error:'Import batch failed and rolled back. Retry after checking private database connectivity and schema.'});}
 });
}
module.exports={plan,hold,applyBatch,register};
