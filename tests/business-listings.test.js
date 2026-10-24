const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const register = require('../lib/business-listings');
const valid = {businessName:'Example Cafe',category:'Cafe',city:'Mumbai',address:'Example address',contactName:'Example Owner',email:'owner@example.com',phone:'9999999999',profileUrl:'https://maps.app.goo.gl/example',dishName:'Poha',dishPrice:'65',diet:'vegetarian',menuOnProfile:true,consent:true};
test('rejects spoofed profiles, invalid prices and missing consent', () => {
 for(const profileUrl of ['http://google.com/maps','https://google.com.evil.test/maps','https://google.com@evil.test/maps','javascript:alert(1)']) assert.throws(()=>register.validate({...valid,profileUrl}));
 for(const dishPrice of ['NaN',0,-1,100001]) assert.throws(()=>register.validate({...valid,dishPrice}));
 assert.throws(()=>register.validate({...valid,consent:false}));
 assert.equal(register.validate(valid).isVeg,true);
});
test('submission immediately publishes an owner-declared business and dish; invalid and duplicate requests handled', async () => {
 const calls=[]; const sql=async (strings,...values)=> { calls.push({query:strings.join('?'),values}); if(calls.length>1){const e=new Error('duplicate');e.code='23505';throw e;}return [{id:'saved'}]; };
 const app=express();app.use(express.json());register(app,sql);
 const server=app.listen(0); const url=`http://127.0.0.1:${server.address().port}/api/business-listings`;
 try {
  const post=body=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({...valid,profileUrl:'https://evil.test'})).status,400);assert.equal(calls.length,0);
  const response=await post(valid);assert.equal(response.status,201);const result=await response.json();assert.equal(result.status,'published');assert.equal(result.published,true);assert.match(result.directoryUrl,/outletCity=Mumbai/);
  assert.match(calls[0].query,/BusinessSubmission/);assert.match(calls[0].query,/INSERT INTO public\."Restaurant"/);assert.match(calls[0].query,/INSERT INTO public\."Dish"/);
  assert.equal((await post(valid)).status,409);
 } finally {server.close();}
});

test('accepts Google shared business links and rejects lookalike domains', () => {
 for(const profileUrl of ['https://share.google/exampleBusiness','https://maps.app.goo.gl/exampleBusiness','https://www.google.com/maps/place/Example','https://www.zomato.com/mumbai/example']) assert.equal(register.validate({...valid,profileUrl}).profileUrl,profileUrl);
 for(const profileUrl of ['https://share.google.evil.test/example','https://share.google@evil.test/example','http://share.google/example']) assert.throws(()=>register.validate({...valid,profileUrl}));
});

test('business submissions preserve rupee decimals but reject boolean and structured prices',()=>{for(const dishPrice of [true,false,[100],{value:100},'1e2','100.001',1.001,null,'  '])assert.throws(()=>register.validate({...valid,dishPrice}));assert.equal(register.validate({...valid,dishPrice:'65.50'}).dishPrice,65.5);});

test('new listings accept website and social evidence without manual approval',async()=>{
 const calls=[],app=express();app.use(express.json());register(app,async(strings,...values)=>{calls.push({query:strings.join('?'),values});return [{id:values[0]}];});const server=app.listen(0),url=`http://127.0.0.1:${server.address().port}/api/business-listings`;
 try{for(const profileUrl of ['https://example.com/','https://www.instagram.com/examplecafe/','https://www.facebook.com/examplecafe']){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...valid,profileUrl})});assert.equal(r.status,201);assert.equal((await r.json()).status,'published');const q=calls.at(-1);assert.ok(q.values.includes(profileUrl));assert.match(q.query,/INSERT INTO public\."Dish"/);assert.doesNotMatch(q.query,/approve_business/);}}
 finally{server.close();}
});
test('new business evidence rejects non-public addresses, credentials and oversized input',()=>{for(const profileUrl of ['https://127.0.0.1/','https://[::1]/','https://localhost/','https://owner:secret@example.com/','https://example.com/'+ 'a'.repeat(2000)])assert.throws(()=>register.validate({...valid,profileUrl}));});

test('home bakers and food outlets publish with menu evidence, but no fake verified ownership',()=>{
 for(const category of ['Home baker','Catering','Hotel','Restaurant','Cafe','Cloud kitchen','Food outlet','Other'])assert.equal(register.validate({...valid,category}).category,category);
 assert.throws(()=>register.validate({...valid,menuOnProfile:false}),/menu link/);
 assert.equal(register.validate({...valid,menuOnProfile:false,menuUrl:'https://example.com/menu'}).menuUrl,'https://example.com/menu');
});
