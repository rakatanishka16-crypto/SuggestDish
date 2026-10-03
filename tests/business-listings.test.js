const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const register = require('../lib/business-listings');
const valid = {businessName:'Example Cafe',category:'Cafe',city:'Mumbai',address:'Example address',contactName:'Example Owner',email:'owner@example.com',phone:'9999999999',profileUrl:'https://maps.app.goo.gl/example',dishName:'Poha',dishPrice:'65',diet:'vegetarian',consent:true};
test('rejects spoofed profiles, invalid prices and missing consent', () => {
 for(const profileUrl of ['http://google.com/maps','https://google.com.evil.test/maps','https://google.com@evil.test/maps','javascript:alert(1)']) assert.throws(()=>register.validate({...valid,profileUrl}));
 for(const dishPrice of ['NaN',0,-1,100001]) assert.throws(()=>register.validate({...valid,dishPrice}));
 assert.throws(()=>register.validate({...valid,consent:false}));
 assert.equal(register.validate(valid).isVeg,true);
});
test('submission stores pending data only; invalid and duplicate requests handled', async () => {
 const calls=[]; const sql=async (strings,...values)=> { calls.push({query:strings.join('?'),values}); return calls.length===1 ? [{id:values[0]}] : []; };
 const app=express();app.use(express.json());register(app,sql);
 const server=app.listen(0); const url=`http://127.0.0.1:${server.address().port}/api/business-listings`;
 try {
  const post=body=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({...valid,profileUrl:'https://evil.test'})).status,400);assert.equal(calls.length,0);
  const response=await post(valid);assert.equal(response.status,201);assert.equal((await response.json()).status,'pending');
  assert.match(calls[0].query,/BusinessSubmission/);assert.doesNotMatch(calls[0].query,/INSERT INTO public\."Restaurant"|INSERT INTO public\."Dish"/);
  assert.equal((await post(valid)).status,409);
 } finally {server.close();}
});

test('accepts Google shared business links and rejects lookalike domains', () => {
 for(const profileUrl of ['https://share.google/exampleBusiness','https://maps.app.goo.gl/exampleBusiness','https://www.google.com/maps/place/Example','https://www.zomato.com/mumbai/example']) assert.equal(register.validate({...valid,profileUrl}).profileUrl,profileUrl);
 for(const profileUrl of ['https://share.google.evil.test/example','https://share.google@evil.test/example','http://share.google/example']) assert.throws(()=>register.validate({...valid,profileUrl}));
});
