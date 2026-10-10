const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../lib/acquisition-source-catalog.js'),'utf8');
function apply(existing,overrides={}){
 const outlet={outlet_id:'OUT_TEST',business_id:'BUS_TEST',brand_name:'Test Brand',outlet_name:'Test Branch',full_address:null,source_url:'https://example.com/new-branch',source_urls:['https://example.com/new-branch'],source_ids:[],last_verified_date:'2026-10-10',city:'Mumbai',...overrides};
 const data={outlets:[outlet],businesses:[{business_id:'BUS_TEST',business_type:'restaurant'}],dishes:[],dish_signals:[],social_profiles:[],sources:[],summary:{}};
 const module={exports:{}};
 vm.runInNewContext(code,{URL,module,exports:module.exports,__dirname:path.join(__dirname,'../lib'),require(name){if(name==='node:fs')return {readFileSync:()=>Buffer.from(JSON.stringify(data))};if(name==='node:zlib')return {gunzipSync:b=>b};return require(name);}});
 return {rows:module.exports.apply(existing),stats:module.exports.coverage().publication};
}
const profile=(overrides={})=>({sourceKey:'old:test',brand:'Test Brand',name:'Existing Branch',address:null,source_urls:['https://example.com/old-branch'],...overrides});
test('missing addresses do not merge same-brand branches',()=>{const r=apply([profile()]);assert.equal(r.rows.length,2);assert.equal(r.stats.matchedExistingProfiles,0);assert.equal(r.rows[0].name,'Existing Branch');});
test('empty normalized addresses and brands do not create exact matches',()=>{const r=apply([profile({address:'Maharashtra',brand:''})],{full_address:' ',brand_name:''});assert.equal(r.rows.length,2);assert.equal(r.stats.matchedExistingProfiles,0);});
test('nonempty normalized address still matches exact branch',()=>{const r=apply([profile({address:'Shop No. 2, Main Road, Maharashtra'})],{full_address:'2 Main Road'});assert.equal(r.rows.length,1);assert.equal(r.stats.matchedExistingProfiles,1);assert.equal(r.rows[0].sourceKey,'old:test');});
test('distinct exact source URL can match without address',()=>{const r=apply([profile({source_urls:['https://example.com/new-branch/']})]);assert.equal(r.rows.length,1);assert.equal(r.stats.matchedExistingProfiles,1);});
test('ambiguous valid addresses remain unresolved instead of auto-merging',()=>{const r=apply([profile({address:'2 Main Road'}),profile({sourceKey:'old:other',address:'2 Main Road'})],{full_address:'2 Main Road'});assert.equal(r.rows.length,2);assert.equal(r.stats.unresolvedMatches.length,1);assert.equal(r.stats.matchedExistingProfiles,0);});
