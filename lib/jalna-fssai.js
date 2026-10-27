'use strict';
const batch=JSON.parse(require('node:zlib').gunzipSync(require('node:fs').readFileSync(require('node:path').join(__dirname,'../api/source-batches/jalna-fssai-2026-10-27.json.gz'))).toString('utf8'));
const norm=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const identity=b=>[norm(b.name),norm(b.address),norm(b.city)].join('|');
function apply(existing){
 const result=existing.map(b=>({...b})),byIdentity=new Map(),byNumber=new Map();
 for(const b of result){
  const key=identity(b);if(b.name&&b.address){const rows=byIdentity.get(key)||[];rows.push(b);byIdentity.set(key,rows);}
  for(const r of b.fssai_records||[])byNumber.set(r.number,b);
  if(/^\d{14}$/.test(b.fssai_license_number||''))byNumber.set(b.fssai_license_number,b);
 }
 let added=0,enriched=0;
 for(const entry of batch.businesses){
  const numberMatch=entry.fssai_records.map(r=>byNumber.get(r.number)).filter(Boolean);
  const exact=byIdentity.get(identity(entry))||[];
  // Never merge a shared name, approximate address or nearby map pin alone.
  const matches=[...new Set(numberMatch.length?numberMatch:exact)];
  const matched=matches.length===1?matches[0]:null;
  if(matched){
   const records=new Map((matched.fssai_records||[]).map(r=>[r.number,r]));
   for(const r of entry.fssai_records)records.set(r.number,r);
   matched.fssai_records=[...records.values()];enriched++;
  }else{const fresh={...entry};result.push(fresh);byIdentity.set(identity(fresh),[fresh]);for(const r of fresh.fssai_records)byNumber.set(r.number,fresh);added++;}
 }
 return {businesses:result,summary:{...batch.summary,profilesAdded:added,existingProfilesEnriched:enriched}};
}
function menuFor(b){
 if(!b.sourceKey.startsWith('official:fssai-'))return null;
 return {menuScope:'none',menuItems:[],menuNotice:'This registry record does not include a menu. No dishes, prices or dietary labels have been inferred.'};
}
function publicRecords(b){return b?.fssai_records?.map(({number,type,status,checkedOn,district,localityTag,sourceUrl})=>({number,type,status,checkedOn,district,localityTag,sourceUrl}))||[];}
module.exports={batch,apply,menuFor,publicRecords};
