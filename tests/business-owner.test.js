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
