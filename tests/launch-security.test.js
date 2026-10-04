'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const security = require('../lib/launch-security');

async function fixture(env, run) {
  const app=express(); let time=1000; security(app,{env,now:()=>time});
  app.get('/api/ai-recommend',(req,res)=>res.json({success:true}));
  app.get('/api/db-test',(req,res)=>res.json({success:true}));
  app.post('/api/razorpay-webhook',(req,res)=>res.status(401).json({success:false}));
  const server=app.listen(0); const url=`http://127.0.0.1:${server.address().port}`;
  try {await run(url,()=>{time+=60001;});} finally {server.close();}
}
test('production denies foreign origins and private diagnostics; no caching', async()=>fixture({NODE_ENV:'production',BUSINESS_REVIEW_KEY:'x'.repeat(32)},async url=>{
  assert.equal((await fetch(url+'/api/ai-recommend',{headers:{Origin:'https://evil.example'}})).status,403);
  const allowed=await fetch(url+'/api/ai-recommend',{headers:{Origin:'https://www.suggestdish.com'}});
  assert.equal(allowed.status,200); assert.equal(allowed.headers.get('access-control-allow-origin'),'https://www.suggestdish.com');
  assert.equal(allowed.headers.get('cache-control'),'no-store'); assert.equal(allowed.headers.get('x-powered-by'),null);
  assert.equal((await fetch(url+'/api/db-test')).status,403);
  assert.equal((await fetch(url+'/api/db-test',{headers:{Authorization:'Bearer '+ 'x'.repeat(32)}})).status,200);
  assert.equal((await fetch(url+'/api/db-test',{headers:{Authorization:'Bearer wrong'}})).status,403);
}));
test('discovery limit expires; webhook signature handler is still reached',async()=>fixture({},async(url,expire)=>{
  for(let i=0;i<30;i++)assert.equal((await fetch(url+'/api/ai-recommend')).status,200);
  const limited=await fetch(url+'/api/ai-recommend');assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');
  expire();assert.equal((await fetch(url+'/api/ai-recommend')).status,200);
  assert.equal((await fetch(url+'/api/razorpay-webhook',{method:'POST'})).status,401);
}));
test('allowed preflight succeeds and unrecognised preview domains are denied',async()=>fixture({VERCEL:'1',VERCEL_URL:'preview.example.vercel.app'},async url=>{
  assert.equal((await fetch(url+'/api/ai-recommend',{method:'OPTIONS',headers:{Origin:'https://preview.example.vercel.app'}})).status,204);
  assert.equal((await fetch(url+'/api/ai-recommend',{headers:{Origin:'https://attacker.vercel.app'}})).status,403);
  assert.equal((await fetch(url+'/api/db-test')).status,403);
}));
