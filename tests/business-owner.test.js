const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const register=require('../lib/business-listings');
const code='a'.repeat(64),id='11111111-1111-4111-8111-111111111111';
const row={id,status:'pending',checkoutTokenHash:crypto.createHash('sha256').update(code).digest('hex'),businessName:'Cafe',category:'Cafe',city:'Mumbai',address:'Example street',contactName:'Owner',email:'owner@example.com',phone:'9999999999',profileUrl:'https://google.com/maps/example',dishName:'Poha',dishPrice:65,isVeg:true};
async function request(path,body,state=row,changed=true){
 const routes=new Map(),queries=[];
 register({post:(p,h)=>routes.set(p,h)},async(strings,...values)=>{queries.push(strings.join('?'));return strings.join('').startsWith('SELECT')?[state]:(changed?[{id}]:[]);});
 let result,status=200;const res={set(){},status(s){status=s;return this;},json(b){result=b;return this;}};
 await routes.get(path)({body},res);return {status,result,queries};
}
const owner={submissionId:id,accessCode:code};
test('owner status requires private code and exposes no contacts or hash',async()=>{
 assert.equal((await request('/api/business-listings/status',{...owner,accessCode:'b'.repeat(64)})).status,403);
 const r=await request('/api/business-listings/status',owner);assert.equal(r.result.canEdit,true);for(const key of ['email','phone','checkoutTokenHash','verificationNotes'])assert.equal(key in r.result,false);
});
test('dish corrections stay pending and never write live menus',async()=>{
 const r=await request('/api/business-listings/dish',{...owner,dishName:'Idli',dishPrice:80,diet:'vegetarian',menuUrl:'https://example.com/menu',consent:true});
 assert.equal(r.status,200);assert.match(r.queries[1],/status='pending'/);assert.doesNotMatch(r.queries[1],/UPDATE.*"Dish"|INSERT.*"Dish"/);
});
test('approved listings, missing consent and review races reject edits',async()=>{
 const data={...owner,dishName:'Idli',dishPrice:80,diet:'vegetarian',consent:true};
 assert.equal((await request('/api/business-listings/dish',data,{...row,status:'approved'})).status,409);
 assert.equal((await request('/api/business-listings/dish',{...data,consent:false})).status,400);
 assert.equal((await request('/api/business-listings/dish',data,row,false)).status,409);
});

test('authenticated listing status returns saved profile evidence but no private review notes',async()=>{const r=await request('/api/business-listings/status',owner,{...row,verificationNotes:'Private notes'});assert.equal(r.result.profileUrl,row.profileUrl);assert.equal(r.result.verificationNotes,undefined);});
test('pending profile correction remains bounded to saved business identity and private owner credentials',async()=>{
 const routes=new Map(),queries=[];register({post:(p,h)=>routes.set(p,h)},async(strings,...values)=>{const query=strings.join('?');queries.push({query,values});return query.startsWith('SELECT')?[{...row,status:'needs_information'}]:[{id}];});
 const response={code:200,set(){},status(n){this.code=n;return this;},json(d){this.data=d;return this;}};
 await routes.get('/api/business-listings/dish')({body:{...owner,profileUrl:'https://www.instagram.com/examplecafe/',businessName:'Another business',address:'Other address',email:'attacker@example.com',dishName:'Idli',dishPrice:80,diet:'vegetarian',consent:true}},response);
 assert.equal(response.code,200);assert.equal(queries.length,2);assert.ok(queries[1].values.includes('https://www.instagram.com/examplecafe/'));assert.match(queries[1].query,/"profileUrl"=\?/);assert.match(queries[1].query,/status IN \('pending','needs_information'\)/);assert.doesNotMatch(queries[1].query,/"businessName"=|address=|email=|"Restaurant"|"Dish"/);
});
test('invalid profile, wrong owner code, missing consent and reviewed submissions cannot save corrections',async()=>{
 const b={...owner,profileUrl:'https://www.instagram.com/examplecafe/',dishName:'Idli',dishPrice:80,diet:'vegetarian',consent:true};
 for(const patch of [{profileUrl:'http://example.com/'},{profileUrl:'https://localhost/'},{profileUrl:null},{profileUrl:true},{consent:false}]){const r=await request('/api/business-listings/dish',{...b,...patch});assert.equal(r.status,400);assert.equal(r.queries.length,1);}
 const wrong=await request('/api/business-listings/dish',{...b,accessCode:'b'.repeat(64)});assert.equal(wrong.status,403);assert.equal(wrong.queries.length,1);
 for(const status of ['approved','rejected']){const r=await request('/api/business-listings/dish',b,{...row,status});assert.equal(r.status,409);assert.equal(r.queries.length,1);}
});
