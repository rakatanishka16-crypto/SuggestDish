const crypto = require('node:crypto');
const PLANS = Object.freeze({monthly:{amount:49900,dishes:3,label:'3 dishes / 1 month'},annual:{amount:499900,dishes:2,label:'2 dishes / 1 year'}});
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function equalHex(a,b) {
 if (typeof a!=='string' || typeof b!=='string' || !/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
 return crypto.timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
function signature(message,secret) { return crypto.createHmac('sha256',secret).update(message).digest('hex'); }
function config(env=process.env, paymentsPaused=true) {
 const testing=env.RAZORPAY_TEST_ENABLED==='true';
 const key=testing ? env.RAZORPAY_TEST_KEY_ID : env.RAZORPAY_KEY_ID;
 const secret=testing ? env.RAZORPAY_TEST_KEY_SECRET : env.RAZORPAY_KEY_SECRET;
 const webhook=testing ? env.RAZORPAY_TEST_WEBHOOK_SECRET : env.RAZORPAY_WEBHOOK_SECRET;
 const enabled=testing || (!paymentsPaused && env.RAZORPAY_ENABLED==='true');
 const validKey=testing ? /^rzp_test_\w+$/.test(key || '') : /^rzp_(live|test)_\w+$/.test(key || '');
 return {enabled,ready:enabled && validKey && Boolean(secret && webhook),key,secret,webhook};
}

const uuid = v => typeof v==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
function register(app,sql,{env=process.env,fetchImpl=fetch,paymentsPaused=true}={}) {
 const cfg=()=>config(env,paymentsPaused);
 async function gateway(path,method='GET',body) {
  const c=cfg();
  const response=await fetchImpl('https://api.razorpay.com/v1/'+path,{method,headers:{Authorization:'Basic '+Buffer.from(c.key+':'+c.secret).toString('base64'),'Content-Type':'application/json'},...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error('gateway_unavailable');
  return response.json();
 }
 async function owner(body) {
  if (!uuid(body?.submissionId) || typeof body?.accessCode!=='string' || !/^[a-f0-9]{64}$/.test(body.accessCode)) return null;
  const rows=await sql`SELECT id,status,"restaurantId","checkoutTokenHash" FROM public."BusinessSubmission" WHERE id=${body.submissionId}`;
  const s=rows[0];
  return s && equalHex(s.checkoutTokenHash || '',sha(body.accessCode)) ? s : null;
 }
 async function reconcile(paymentId) {
  if(typeof paymentId!=='string' || !/^pay_\w+$/.test(paymentId)) throw new Error('payment_mismatch');
  const payment=await gateway('payments/'+paymentId);
  const rows=await sql`SELECT * FROM public."BusinessPlanPayment" WHERE "orderId"=${payment.order_id || ''}`;
  const p=rows[0]; const c=cfg();
  if(!p) return null;
  if(p.keyId!==c.key || payment.id!==paymentId || payment.order_id!==p.orderId || payment.currency!==p.currency || payment.amount!==p.amount || !PLANS[p.plan] || p.amount!==PLANS[p.plan].amount) throw new Error('payment_mismatch');
  if (payment.status!=='captured' && payment.status!=='refunded') return {pending:true};
  const saved=await sql`SELECT * FROM public.confirm_business_payment(${p.id}::uuid,${paymentId},${payment.status==='refunded' || Number(payment.amount_refunded || 0)>0})`;
  return saved[0];
 }
 app.get('/api/billing/config',(req,res)=>{res.set('Cache-Control','no-store');const c=cfg();res.json({success:true,available:c.ready,mode:c.ready ? (c.key.startsWith('rzp_live_')?'live':'test') : 'unconfigured'});});
 app.post('/api/billing/orders',async(req,res)=>{
  res.set('Cache-Control','no-store');
  const c=cfg(); if(!c.ready) return res.status(503).json({success:false,error:'Online payments are being connected. Please check back soon.'});
  const plan=PLANS[req.body?.plan]; if(!plan) return res.status(400).json({success:false,error:'Choose the monthly or annual plan.'});
  try {
   const s=await owner(req.body);if(!s) return res.status(403).json({success:false,error:'Enter your business reference and private access code.'});
   if(s.status!=='approved' || !s.restaurantId) return res.status(409).json({success:false,error:'Your business must be approved before you can pay. No payment has been taken.'});
   // One open checkout or active paid plan per restaurant. Reuse a recent order on retries.
   const id=crypto.randomUUID();
   const reserved=await sql`SELECT id FROM public.reserve_business_payment(${id}::uuid,${s.id}::uuid,${s.restaurantId},${req.body.plan},${plan.amount},${c.key})`;
   let order;
   if(!reserved.length) {
    const previous=await sql`SELECT * FROM public."BusinessPlanPayment" WHERE "restaurantId"=${s.restaurantId} AND "keyId"=${c.key} AND ((status='captured' AND "endsAt">NOW()) OR (status='created' OR (status='creating' AND "createdAt">NOW()-INTERVAL '30 minutes'))) ORDER BY "createdAt" DESC LIMIT 1`;
    const p=previous[0];
    if(p?.status==='created' && p.plan===req.body.plan && p.submissionId===s.id) order=await gateway('orders/'+p.orderId);
    else return res.status(409).json({success:false,error:p?.status==='captured'?'You already have an active paid plan.':'A checkout is already pending. Use the same plan or contact SuggestDish to change it.'});
   } else {
    order=await gateway('orders','POST',{amount:plan.amount,currency:'INR',receipt:id,partial_payment:false,notes:{submission_id:s.id,plan:req.body.plan}});
    if(!/^order_\w+$/.test(order.id || '') || order.amount!==plan.amount || order.currency!=='INR') throw new Error('payment_mismatch');
    await sql`UPDATE public."BusinessPlanPayment" SET "orderId"=${order.id},status='created' WHERE id=${id}::uuid AND status='creating'`;
   }
   if(!/^order_\w+$/.test(order.id || '') || order.amount!==plan.amount || order.currency!=='INR') throw new Error('payment_mismatch');
   if(order.status==='paid') return res.status(409).json({success:false,error:'This order has already been paid. Use Check payment status below.'});
   return res.json({success:true,keyId:c.key,orderId:order.id,amount:plan.amount,currency:'INR',description:plan.label,mode:c.key.startsWith('rzp_live_')?'live':'test'});
  } catch(err){console.error('Razorpay order failed',{code:'order_failed'});return res.status(503).json({success:false,error:'Checkout could not be prepared. Please try again later.'});}
 });
 app.post('/api/billing/verify',async(req,res)=>{
  res.set('Cache-Control','no-store'); if(!cfg().ready) return res.status(503).json({success:false,error:'Payments are not configured.'});
  try {
   const s=await owner(req.body);if(!s) return res.status(403).json({success:false,error:'Invalid business reference or access code.'});
   const rows=await sql`SELECT * FROM public."BusinessPlanPayment" WHERE "orderId"=${String(req.body.razorpay_order_id || '')} AND "submissionId"=${s.id}::uuid`;
   const p=rows[0];
   if(!p || p.keyId!==cfg().key || !/^pay_\w+$/.test(req.body.razorpay_payment_id || '') || !equalHex(signature(p.orderId+'|'+req.body.razorpay_payment_id,cfg().secret),req.body.razorpay_signature)) return res.status(400).json({success:false,error:'Payment verification failed. Contact SuggestDish with your payment ID.'});
   const result=await reconcile(req.body.razorpay_payment_id);
   if(result?.pending) return res.status(202).json({success:true,status:'pending',message:'Payment is awaiting capture. Your plan will activate after confirmation.'});
   return res.json({success:true,status:result.status,mode:p.keyId.startsWith('rzp_live_')?'live':'test',endsAt:result.endsAt,dishes:PLANS[p.plan].dishes});
  }catch(err){return res.status(503).json({success:false,error:'We could not confirm payment yet. Do not pay again; use Check payment status or contact SuggestDish with your payment ID.'});}
 });
 app.post('/api/billing/status',async(req,res)=>{
  res.set('Cache-Control','no-store');try {
   const s=await owner(req.body);if(!s) return res.status(403).json({success:false,error:'Invalid business reference or access code.'});
   const rows=await sql`SELECT plan,status,"endsAt","keyId" FROM public."BusinessPlanPayment" WHERE "submissionId"=${s.id}::uuid ORDER BY "createdAt" DESC LIMIT 1`;
   let p=rows[0];
   if(cfg().ready && p?.keyId===cfg().key) {
    const orders=await sql`SELECT "orderId","paymentId" FROM public."BusinessPlanPayment" WHERE "submissionId"=${s.id}::uuid ORDER BY "createdAt" DESC LIMIT 1`;
    const last=orders[0];
    if(last?.paymentId) await reconcile(last.paymentId);
    else if(last?.orderId) {
     const payments=await gateway('orders/'+last.orderId+'/payments');
     const payment=payments.items?.find(x=>x.status==='captured' || x.status==='refunded');
     if(payment) await reconcile(payment.id);
    }
    const refreshed=await sql`SELECT plan,status,"endsAt","keyId" FROM public."BusinessPlanPayment" WHERE "submissionId"=${s.id}::uuid ORDER BY "createdAt" DESC LIMIT 1`;p=refreshed[0];
   }
   return res.json({success:true,approval:s.status,status:p?.status || 'unpaid',endsAt:p?.endsAt || null,dishes:p?.status==='captured' && new Date(p.endsAt)>new Date() && p.keyId.startsWith('rzp_live_') ? PLANS[p.plan].dishes : 1,mode:p?.keyId ? (p.keyId.startsWith('rzp_live_')?'live':'test') : 'unconfigured'});
  }catch{res.status(503).json({success:false,error:'Could not check payment status. Please try again later.'});}
 });
 app.post('/api/razorpay-webhook',async(req,res)=>{
  const c=cfg();if(!c.ready) return res.status(503).json({success:false});
  if(!Buffer.isBuffer(req.rawBody) || !equalHex(signature(req.rawBody,c.webhook),req.get('X-Razorpay-Signature'))) return res.status(400).json({success:false});
  try {
   const event=req.body;
   if(!['payment.captured','order.paid','refund.processed'].includes(event.event)) return res.json({success:true});
   const paymentId=event.event==='refund.processed' ? event.payload?.refund?.entity?.payment_id : event.payload?.payment?.entity?.id;
   await reconcile(paymentId);return res.json({success:true});
  }catch{res.status(503).json({success:false});}
 });
}
module.exports=register;
Object.assign(module.exports,{PLANS,signature,equalHex,config,sha});
