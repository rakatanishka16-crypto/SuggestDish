'use strict';
const crypto=require('node:crypto');
const {isPublished}=require('./self-published-business');
const {price:menuPrice}=require('./owner-menu-input');
const {sha,equalHex,validStoredAmount}=require('./razorpay-payments');
function active(p,now=Date.now()){
 return Boolean(p && p.status==='captured' && p.keyId?.startsWith('rzp_live_') && p.currency==='INR' && validStoredAmount(p) && Date.parse(p.startsAt)<=now && Date.parse(p.endsAt)>now);
}
function validate(b){
 const name=typeof b?.dishName==='string'?b.dishName.trim():'';
 const price=menuPrice(b?.dishPrice);
 if(!Number.isInteger(b?.slot)||b.slot<1||b.slot>2)throw Error('Choose dish slot 1 or 2.');
 if(!name||name.length>160||!Number.isFinite(price)||price<=0||price>100000)throw Error('Enter a dish name and a valid price in rupees.');
 if(!['vegetarian','non-vegetarian'].includes(b.diet))throw Error('Choose the dish dietary type.');
 let url;try{url=new URL(b.menuUrl);if(url.protocol!=='https:'||url.username||url.password||url.href.length>2000)throw 0;}catch{throw Error('Add an HTTPS link to your public menu.');}
 if(b.consent!==true)throw Error('Confirm your authority and the accuracy of the dish details.');
 const businessName=typeof b.businessName==='string'?b.businessName.trim():'';
 const businessInfo=typeof b.businessInfo==='string'?b.businessInfo.trim():'';
 if(!businessName||businessName.length>160||!businessInfo||businessInfo.length>500)throw Error('Add the food business name and its public location or business details.');
 let photo=null,photoMime=null;
 if(b.photo!==undefined){
  if(typeof b.photo!=='string'||b.photo.length>327680||!b.photo.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.photo))throw Error('Choose a valid dish photo under 240 KB after resizing.');
  photo=Buffer.from(b.photo,'base64');photoMime=b.photoMime;
  const jpeg=photo.length>3&&photo[0]===255&&photo[1]===216&&photo[2]===255;
  const png=photo.length>8&&photo.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(photo.length>245760||!((photoMime==='image/jpeg'&&jpeg)||(photoMime==='image/png'&&png)))throw Error('Choose a JPEG or PNG photo of this dish.');
 }
 return {slot:b.slot,name,price,isVeg:b.diet==='vegetarian',menuUrl:url.href,businessName,businessInfo,photo,photoMime};
}
module.exports=function register(app,sql){
 const fail=(res,code,error)=>res.status(code).json({success:false,error});
 async function owner(b){
  if(typeof b?.submissionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(b.submissionId)||typeof b.accessCode!=='string'||!/^[a-f0-9]{64}$/.test(b.accessCode))return null;
  const rows=await sql`SELECT id,status,"restaurantId","verificationNotes","checkoutTokenHash","businessName",city,address FROM public."BusinessSubmission" WHERE id=${b.submissionId}::uuid`;
  const s=rows[0];return s&&equalHex(s.checkoutTokenHash||'',sha(b.accessCode))?s:null;
 }
 async function plan(s){
  if(!s.restaurantId||!(s.status==='approved'||isPublished(s)))return null;
  const rows=await sql`SELECT id,plan,amount,currency,"keyId",status,"startsAt","endsAt" FROM public."BusinessPlanPayment" WHERE "submissionId"=${s.id}::uuid AND "restaurantId"=${s.restaurantId} AND status='captured' AND LEFT("keyId",9)='rzp_live_' AND "startsAt"<=NOW() AND "endsAt">NOW() ORDER BY "endsAt" DESC LIMIT 1`;
  return active(rows[0])?rows[0]:null;
 }
 app.get('/api/promotion-photo/:id',async(req,res)=>{
  if(!/^[a-f0-9-]{36}$/i.test(req.params.id||''))return res.status(404).end();
  try{const rows=await sql`SELECT promotion.photo,promotion."photoMime" FROM public."PaidDishPromotion" promotion
   JOIN public."BusinessSubmission" submission ON submission.id=promotion."submissionId"
   WHERE promotion.id=${req.params.id}::uuid AND promotion.photo IS NOT NULL
    AND (submission.status='approved' OR (submission.status='pending' AND submission."verificationNotes" LIKE 'owner_self_published_v1%'))
    AND EXISTS(SELECT 1 FROM public."BusinessPlanPayment" p WHERE p."submissionId"=submission.id AND p."restaurantId"=submission."restaurantId" AND p.status='captured' AND LEFT(p."keyId",9)='rzp_live_' AND p.currency='INR' AND p."startsAt"<=NOW() AND p."endsAt">NOW() AND ((p.plan='monthly' AND p.amount IN (49900,79900)) OR (p.plan='annual' AND p.amount IN (399900,499900))))`;
   const row=rows[0];if(!row)return res.status(404).end();const bytes=Buffer.isBuffer(row.photo)?row.photo:typeof row.photo==='string'?Buffer.from(row.photo.replace(/^\\x/,''),'hex'):Buffer.from(row.photo);
   res.set('Cache-Control','no-store');res.set('Content-Type',row.photoMime);res.set('X-Content-Type-Options','nosniff');res.set('Content-Security-Policy',"default-src 'none'; sandbox");res.send(bytes);
  }catch{return res.status(404).end();}
 });
 app.post('/api/business-promotions/status',async(req,res)=>{
  res.set('Cache-Control','no-store');try{
   const s=await owner(req.body);if(!s)return fail(res,403,'Enter the correct business reference and private access code.');
   const p=await plan(s);if(!p)return res.json({success:true,active:false,capacity:0,dishes:[],message:'Two promoted dish slots unlock after a confirmed live payment. Expired or refunded plans are inactive.'});
   const dishes=await sql`SELECT id,slot,name,price,"isVeg","menuUrl","businessName","businessInfo",(photo IS NOT NULL) AS "hasPhoto" FROM public."PaidDishPromotion" WHERE "submissionId"=${s.id}::uuid ORDER BY slot`;
   res.json({success:true,active:true,capacity:2,plan:p.plan,endsAt:p.endsAt,businessName:s.businessName,canReplace:p.plan==='annual',defaultBusinessName:s.businessName,defaultBusinessInfo:[s.address,s.city].filter(Boolean).join(', '),dishes:dishes.map(d=>({...d,photoUrl:d.hasPhoto?'/api/promotion-photo/'+d.id:null}))});
  }catch{return fail(res,503,'Your promotion details could not be loaded. Please try again.');}
 });
 app.post('/api/business-promotions/save',async(req,res)=>{
  res.set('Cache-Control','no-store');let d;try{d=validate(req.body);}catch(e){return fail(res,400,e.message);}
  try{
   const s=await owner(req.body);if(!s)return fail(res,403,'Enter the correct business reference and private access code.');
   const p=await plan(s);if(!p)return fail(res,409,'An active, confirmed live payment is required to promote two dishes.');
   // Recheck payment and listing inside the write. Serialize slots for this business.
   const saved=await sql`WITH eligible AS (
    SELECT payment.id,payment.plan FROM public."BusinessSubmission" submission
    JOIN public."BusinessPlanPayment" payment ON payment."submissionId"=submission.id AND payment."restaurantId"=submission."restaurantId"
    WHERE submission.id=${s.id}::uuid AND payment.id=${p.id}::uuid
     AND (submission.status='approved' OR (submission.status='pending' AND submission."verificationNotes" LIKE 'owner_self_published_v1%'))
     AND payment.status='captured' AND LEFT(payment."keyId",9)='rzp_live_' AND payment.currency='INR'
     AND payment."startsAt"<=NOW() AND payment."endsAt">NOW()
     AND ((payment.plan='monthly' AND payment.amount IN (49900,79900)) OR (payment.plan='annual' AND payment.amount IN (399900,499900)))
    FOR UPDATE OF submission,payment
   ) INSERT INTO public."PaidDishPromotion"(id,"submissionId","paymentId",slot,name,price,"isVeg","menuUrl","businessName","businessInfo",photo,"photoMime")
   SELECT ${crypto.randomUUID()}::uuid,${s.id}::uuid,id,${d.slot},${d.name},${d.price},${d.isVeg},${d.menuUrl},${d.businessName},${d.businessInfo},decode(${d.photo?d.photo.toString('hex'):null},'hex'),${d.photoMime} FROM eligible WHERE (${Boolean(d.photo)} OR EXISTS(SELECT 1 FROM public."PaidDishPromotion" WHERE "submissionId"=${s.id}::uuid AND slot=${d.slot} AND photo IS NOT NULL))
   ON CONFLICT("submissionId",slot) DO UPDATE SET name=EXCLUDED.name,price=EXCLUDED.price,"isVeg"=EXCLUDED."isVeg","menuUrl"=EXCLUDED."menuUrl","paymentId"=EXCLUDED."paymentId","businessName"=EXCLUDED."businessName","businessInfo"=EXCLUDED."businessInfo",photo=COALESCE(EXCLUDED.photo,"PaidDishPromotion".photo),"photoMime"=COALESCE(EXCLUDED."photoMime","PaidDishPromotion"."photoMime"),"updatedAt"=NOW()
   WHERE LOWER(TRIM("PaidDishPromotion".name))=LOWER(TRIM(EXCLUDED.name)) OR "PaidDishPromotion"."paymentId"<>EXCLUDED."paymentId" OR (SELECT plan FROM eligible)='annual'
   RETURNING slot,name,price,"isVeg","menuUrl"`;
   if(!saved.length)return fail(res,409,'A dish photo is required to publish. An existing dish cannot be replaced during the current monthly plan. Annual plans include dish replacements. Check your payment status if your plan changed.');
   res.json({success:true,dish:saved[0],message:'Your promoted dish is published. It is labelled Sponsored and owner-submitted.'});
  }catch{return fail(res,503,'Your promoted dish could not be saved. Please try again.');}
 });
};
Object.assign(module.exports,{active,validate});
