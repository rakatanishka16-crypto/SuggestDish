'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const fields={businesses:'business_id',outlets:'outlet_id',dishes:'dish_id',dish_signals:'signal_id',social_profiles:'social_profile_id',sources:'source_id'};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
function plan(data){
 const records=[],counts={},ids={};
 for(const [type,key] of Object.entries(fields)){
  if(!Array.isArray(data[type]))throw new Error('Missing table '+type);
  ids[type]=new Set();counts[type]=data[type].length;
  for(const payload of data[type]){
   const id=payload[key];if(typeof id!=='string'||!id||ids[type].has(id))throw new Error('Missing or duplicate '+key);ids[type].add(id);
   const date=payload.last_verified_date;if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Invalid observation date');
   if(type==='dishes'&&(payload.price!=null&&(!Number.isFinite(payload.price)||payload.price<0)))throw new Error('Invalid explicit dish price');
   if(type==='dishes'&&payload.vegetarian!==null&&typeof payload.vegetarian!=='boolean')throw new Error('Unknown diet must remain null');
   records.push({type,id,payloadHash:hash(payload),payload,observedOn:date});
  }
 }
 for(const r of data.outlets)if(!ids.businesses.has(r.business_id))throw new Error('Orphan outlet');
 for(const r of data.dishes)if(!ids.businesses.has(r.business_id)||(r.outlet_id!=null&&!ids.outlets.has(r.outlet_id)))throw new Error('Orphan dish');
 for(const r of data.dish_signals)if(!ids.dishes.has(r.dish_id))throw new Error('Orphan signal');
 for(const r of data.social_profiles)if(!ids.businesses.has(r.business_id)||(r.outlet_id!=null&&!ids.outlets.has(r.outlet_id)))throw new Error('Orphan social profile');
 for(const r of records)for(const sourceId of r.payload.source_ids||[])if(!ids.sources.has(sourceId))throw new Error('Missing evidence source');
 records.sort((a,b)=>(a.type+':'+a.id).localeCompare(b.type+':'+b.id));
 return {snapshotHash:hash(records.map(r=>[r.type,r.id,r.payloadHash])),counts,records,recommendationTablesModified:false};
}
async function apply(client,p){
 let inserted=0;
 await client.query('BEGIN');
 try{
  await client.query(fs.readFileSync(path.join(__dirname,'../migrations/source-acquisition-staging.sql'),'utf8'));
  // Serializes cooperating imports without deleting or overwriting evidence.
  await client.query("SELECT pg_advisory_xact_lock(74199321)");
  for(let i=0;i<p.records.length;i+=250){
   const rows=p.records.slice(i,i+250).map(r=>({recordType:r.type,sourceId:r.id,payloadHash:r.payloadHash,payload:r.payload,observedOn:r.observedOn}));
   const result=await client.query(`INSERT INTO public."SourceAcquisitionObservation" ("recordType","sourceId","payloadHash","payload","observedOn") SELECT "recordType","sourceId","payloadHash","payload","observedOn"::date FROM jsonb_to_recordset($1::jsonb) AS x("recordType" text,"sourceId" text,"payloadHash" text,"payload" jsonb,"observedOn" text) ON CONFLICT DO NOTHING`,[JSON.stringify(rows)]);inserted+=result.rowCount;
  }
  await client.query('INSERT INTO public."SourceAcquisitionImport" ("snapshotHash","counts") VALUES ($1,$2::jsonb) ON CONFLICT DO NOTHING',[p.snapshotHash,JSON.stringify(p.counts)]);
  await client.query('COMMIT');return {inserted,unchanged:p.records.length-inserted,snapshotHash:p.snapshotHash,counts:p.counts,recommendationTablesModified:false};
 }catch(e){await client.query('ROLLBACK');throw e;}
}
module.exports={plan,apply};
