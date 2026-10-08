'use strict';
require('dotenv').config({quiet:true});
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {plan,apply}=require('../lib/source-acquisition-import');
async function main(){
 const args=process.argv.slice(2);if(args.some(a=>a!=='--apply'))throw Error('Use no arguments for dry-run or --apply to persist staging observations');
 const file=path.join(__dirname,'../api/source-batches/mumbai-acquisition-0001-0002.json.gz');
 const p=plan(JSON.parse(zlib.gunzipSync(fs.readFileSync(file))));
 if(!args.includes('--apply')){console.log(JSON.stringify({mode:'dry_run',snapshotHash:p.snapshotHash,counts:p.counts,totalObservations:p.records.length,recommendationTablesModified:false},null,2));return;}
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required for apply; configure it securely in this environment');
 const {Client}=require('pg');const client=new Client({connectionString:process.env.DATABASE_URL});
 try{await client.connect();console.log(JSON.stringify(await apply(client,p),null,2));}finally{await client.end();}
}
main().catch(()=>{console.error('Source staging import failed. No successful import is claimed. Check private database connectivity and permissions; retry the same command after resolving the issue.');process.exitCode=1;});
