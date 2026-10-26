const {test}=require('node:test');const assert=require('node:assert/strict');
const express=require('express');const register=require('../lib/business-promotions');const featured=require('../lib/featured-dishes');
const {sha}=require('../lib/razorpay-payments');
const sid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',pid='cccccccc-cccc-4ccc-8ccc-cccccccccccc',accessCode='a'.repeat(64);
const owner={submissionId:sid,accessCode};const dish={...owner,businessName:'Fixture Cafe',businessInfo:'Public area, Jalna',photo:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6X8AAAAASUVORK5CYII=',photoMime:'image/png',slot:1,dishName:'Masala Dosa',dishPrice:'120.50',diet:'vegetarian',menuUrl:'https://example.com/menu',consent:true};
test('promotion inputs reject invalid slot, prices, diet, links and missing consent',()=>{
 assert.equal(register.validate(dish).price,120.5);
 for(const change of [{slot:3},{slot:'1'},{dishPrice:true},{dishPrice:0},{dishPrice:'1.234'},{diet:'unknown'},{menuUrl:'javascript:alert(1)'},{menuUrl:'https://user:pass@example.com/'},{consent:false},{photo:'bad',photoMime:'image/png'},{businessName:''}])assert.throws(()=>register.validate({...dish,...change}));
});
test('promotion entitlement rejects test, expired, refunded and incorrect-price payments',()=>{
 const p={status:'captured',keyId:'rzp_live_fixture',currency:'INR',plan:'monthly',amount:49900,startsAt:'2020-01-01',endsAt:'2099-01-01'};
 assert.equal(register.active(p),true);
 for(const c of [{keyId:'rzp_test_fixture'},{status:'refunded'},{status:'created'},{amount:1},{endsAt:'2000-01-01'},{startsAt:'2099-01-01'},{currency:'USD'}])assert.equal(register.active({...p,...c}),false);
});
test('paid owner publishes exactly two private-access-controlled promotions; annual replacements and expiry work in SQL',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs');const db=new PGlite();
 await db.exec(`CREATE TABLE "Restaurant"(id INTEGER PRIMARY KEY,name TEXT,city TEXT,address TEXT);
 CREATE TABLE "BusinessSubmission"(id UUID PRIMARY KEY,status TEXT,"restaurantId" INTEGER,"verificationNotes" TEXT,"checkoutTokenHash" TEXT,"businessName" TEXT,city TEXT,address TEXT);
 CREATE TABLE "BusinessPlanPayment"(id UUID PRIMARY KEY,"submissionId" UUID,"restaurantId" INTEGER,plan TEXT,amount INTEGER,currency TEXT,"keyId" TEXT,status TEXT,"startsAt" TIMESTAMPTZ,"endsAt" TIMESTAMPTZ);`);
 await db.exec(fs.readFileSync(require.resolve('../migrations/paid-dish-promotions-2026-10-26.sql'),'utf8'));
 await db.exec(`INSERT INTO "Restaurant" VALUES(12,'Fixture Cafe','Jalna','Public area');`);
 await db.query('INSERT INTO "BusinessSubmission" VALUES($1,\'pending\',12,\'owner_self_published_v1\',$2,\'Fixture Cafe\',\'Jalna\',\'Public area\')',[sid,sha(accessCode)]);
 await db.query('INSERT INTO "BusinessPlanPayment" VALUES($1,$2,12,\'monthly\',49900,\'INR\',\'rzp_test_fixture\',\'captured\',NOW()-INTERVAL \'1 day\',NOW()+INTERVAL \'1 month\')',[pid,sid]);
 const sql=async(strings,...values)=>{const query=strings.reduce((a,s,i)=>a+s+(i<values.length?'$'+(i+1):''),'');if(query.includes('FROM public."RestaurantStarDish"'))return[];return (await db.query(query,values)).rows;};
 const app=express();app.use(express.json());register(app,sql);featured(app,sql);const server=app.listen(0);const base='http://127.0.0.1:'+server.address().port;
 const post=async(path,b)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return {status:r.status,body:await r.json()};};
 const listed=async()=>{const r=await fetch(base+'/api/featured-dishes');assert.equal(r.status,200);return (await r.json()).dishes;};
 try{
  assert.equal((await post('/api/business-promotions/status',owner)).body.active,false);
  assert.equal((await post('/api/business-promotions/save',dish)).status,409);
  assert.equal((await post('/api/business-promotions/status',{...owner,accessCode:'f'.repeat(64)})).status,403);
  await db.exec(`UPDATE "BusinessPlanPayment" SET "keyId"='rzp_live_fixture'`);
  assert.equal((await post('/api/business-promotions/status',owner)).body.capacity,2);
  assert.equal((await post('/api/business-promotions/save',dish)).status,200);
  assert.equal((await post('/api/business-promotions/save',{...dish,slot:2,dishName:'Idli'})).status,200);
  assert.equal((await post('/api/business-promotions/save',{...dish,slot:3})).status,400);
  let publicDishes=await listed();assert.equal(publicDishes.length,2);assert.equal(publicDishes[0].sponsored,true);assert.equal(publicDishes[0].ownerSubmitted,true);assert.ok(publicDishes[0].photoUrl);const photo=await fetch(base+publicDishes[0].photoUrl);assert.equal(photo.status,200);assert.equal(photo.headers.get('content-type'),'image/png');assert.equal(JSON.stringify(publicDishes).includes(accessCode),false);assert.equal(JSON.stringify(publicDishes).includes('rzp_live'),false);
  assert.equal((await post('/api/business-promotions/save',{...dish,dishName:'Pizza'})).status,409);
  assert.equal((await post('/api/business-promotions/save',{...dish,dishPrice:'125'})).status,200);
  assert.equal((await post('/api/business-promotions/status',owner)).body.dishes.length,2);
  await db.exec(`UPDATE "BusinessPlanPayment" SET plan='annual',amount=399900`);
  assert.equal((await post('/api/business-promotions/save',{...dish,dishName:'Pizza'})).status,200);
  await db.exec(`UPDATE "BusinessPlanPayment" SET status='refunded'`);
  assert.equal((await post('/api/business-promotions/status',owner)).body.active,false);assert.equal((await listed()).length,0);assert.equal((await fetch(base+publicDishes[0].photoUrl)).status,404);
  assert.equal((await post('/api/business-promotions/save',dish)).status,409);
  await db.exec(`UPDATE "BusinessPlanPayment" SET status='captured',"endsAt"=NOW()-INTERVAL '1 second'`);
  assert.equal((await listed()).length,0);
  await db.exec(`UPDATE "BusinessPlanPayment" SET "endsAt"=NOW()+INTERVAL '1 month'; UPDATE "BusinessSubmission" SET status='rejected'`);
  assert.equal((await listed()).length,0);assert.equal((await post('/api/business-promotions/save',dish)).status,409);
 }finally{server.close();await db.close();}
});
