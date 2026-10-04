const test=require('node:test'),assert=require('node:assert/strict'),register=require('../lib/dish-photos');
async function harness(fetchImpl){const routes=new Map();register({get:(p,h)=>routes.set(p,h)},{fetchImpl});return async dish=>{let body,status=200;const res={set(){},status(s){status=s;return this;},json(b){body=b;}};await routes.get('/api/dish-photo')({query:{dish}},res);return {body,status};};}
test('dish photo lookup preserves licence credit and caches one dish family',async()=>{
 let calls=0;const run=await harness(async()=>{calls++;return {ok:true,json:async()=>({query:{pages:{one:{title:'File:Poha.jpg',index:1,imageinfo:[{mime:'image/jpeg',thumburl:'https://thumb.wikimedia.org/poha.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Poha.jpg',extmetadata:{LicenseShortName:{value:'CC BY-SA 4.0'},Artist:{value:'<a>Author</a>'}}}]}}}})};});
 const first=await run('Batata Kanda Poha (500ml)');assert.equal(first.body.photo.artist,'Author');assert.match(first.body.photo.label,/Representative/);await run('Poha');assert.equal(calls,1);
});
test('unknown dishes, unsupported licence and source failure have honest empty photos',async()=>{
 const run=await harness(async()=>{throw Error('offline');});assert.equal((await run('Poha')).body.photo,null);assert.equal((await run('Mystery signature dish')).body.photo,null);assert.equal((await run('x'.repeat(161))).status,400);
 const no=await harness(async()=>({ok:true,json:async()=>({query:{pages:{a:{title:'File:Poha.jpg',imageinfo:[{mime:'image/jpeg',url:'https://evil.example/photo',extmetadata:{LicenseShortName:{value:'All rights reserved'}}}]}}}})}));assert.equal((await no('Poha')).body.photo,null);
});
