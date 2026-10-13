#!/usr/bin/env node
'use strict';
require('dotenv').config({quiet:true});
const fs=require('node:fs');
async function main(){
 const apply=process.argv.includes('--apply');if(process.argv.slice(2).some(a=>a!=='--apply'))throw Error('Use --apply or no arguments for a read-only plan.');
 const token=process.env.SOURCE_CATALOG_IMPORT_KEY;if(!token||token.length<32)throw Error('Configure the private import key in your environment. Never paste it into chat.');
 const endpoint='https://www.suggestdish.com/api/catalogue-import';
 const call=async body=>{const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});const data=await response.json();if(!response.ok||!data.success)throw Error(data.error||'Import failed');return data;};
 const plan=await call({stage:'plan'});console.log(JSON.stringify(plan,null,2));if(!apply)return;
 const report={plan,batches:[],completed:false};
 for(const stage of ['archive','publish']){let offset=0;while(true){const batch=await call({stage,offset,digest:plan.digest});report.batches.push(batch);fs.writeFileSync('catalogue-import-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({stage,offset,nextOffset:batch.nextOffset,done:batch.done,observationsInserted:batch.observationsInserted,restaurantsInserted:batch.restaurantsInserted,dishesInserted:batch.dishesInserted,conflicts:batch.conflicts.length,replayed:batch.replayed||false}));if(batch.done)break;if(batch.nextOffset<=offset)throw Error('Import did not advance');offset=batch.nextOffset;}}
 report.completed=true;fs.writeFileSync('catalogue-import-report.json',JSON.stringify(report,null,2));console.log('Import completed. Report: catalogue-import-report.json');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
