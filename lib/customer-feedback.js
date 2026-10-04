const crypto = require('node:crypto');
const reasons = {dislike:['too_far','too_expensive','not_my_craving','not_my_diet','want_variety'],correction:['wrong_photo','wrong_price','wrong_diet','closed_outlet','wrong_address','missing_information'],review:['tried_it']};
module.exports=function registerCustomerFeedback(app,sql,{env=process.env}={}){
 let ready;
 const attempts=new Map();
 function limited(req){const now=Date.now();for(const [key,v] of attempts)if(v.ends<now)attempts.delete(key);const key=String(req.ip || 'unknown');const v=attempts.get(key)||{count:0,ends:now+900000};v.count++;attempts.set(key,v);return v.count>30 || attempts.size>1000;}
 function initialise(){if(!ready)ready=(async()=>{await sql`CREATE TABLE IF NOT EXISTS public."CustomerFeedback" (id uuid PRIMARY KEY,"dishId" integer NOT NULL REFERENCES public."Dish"(id),kind text NOT NULL,reason text NOT NULL,note text NOT NULL DEFAULT '',taste integer,portion integer,value integer,status text NOT NULL DEFAULT 'pending',"dedupeKey" text NOT NULL UNIQUE,"createdAt" timestamptz NOT NULL DEFAULT NOW(),"reviewedAt" timestamptz)`;})().catch(e=>{ready=null;throw e;});return ready;}
 function reviewer(req,res){res.set('Cache-Control','no-store');const secret=env.BUSINESS_REVIEW_KEY;const h=s=>crypto.createHash('sha256').update(s).digest();if(!secret || secret.length<32){res.status(503).json({success:false,error:'Private review access has not been configured.'});return false;}if(!crypto.timingSafeEqual(h(req.headers.authorization || ''),h('Bearer '+secret))){res.status(403).json({success:false,error:'Private reviewer access required.'});return false;}return true;}
 app.post('/api/customer-feedback',async(req,res)=>{
  res.set('Cache-Control','no-store');if(limited(req))return res.status(429).json({success:false,error:'Too many feedback attempts. Please try again later.'});const b=req.body || {};
  if(b.website || !Number.isSafeInteger(b.dishId) || b.dishId<1 || !reasons[b.kind]?.includes(b.reason) || typeof b.note!=='string' || b.note.length>1000 || b.consent!==true || (b.kind==='review' && b.tried!==true))return res.status(400).json({success:false,error:'Choose a valid dish and feedback reason, and confirm your submission.'});
  const ratings=['taste','portion','value'].map(k=>b[k]==null || b[k]==='' ? null : b[k]);
  if(ratings.some(x=>x!==null && (!Number.isInteger(x) || x<1 || x>5)) || (b.kind!=='review' && ratings.some(x=>x!==null)))return res.status(400).json({success:false,error:'Ratings must be 1–5, or left unanswered, and require a tried-it review.'});
  try{
   const dish=await sql`SELECT id FROM public."Dish" WHERE id=${b.dishId} LIMIT 1`;
   if(!dish.length)return res.status(404).json({success:false,error:'This dish is no longer available for feedback.'});
   await initialise();
   const id=crypto.randomUUID(),note=b.note.trim();
   const dedupe=crypto.createHash('sha256').update(JSON.stringify([b.dishId,b.kind,b.reason,note,ratings,new Date().toISOString().slice(0,10)])).digest('hex');
   const saved=await sql`INSERT INTO public."CustomerFeedback" (id,"dishId",kind,reason,note,taste,portion,value,"dedupeKey") VALUES(${id}::uuid,${b.dishId},${b.kind},${b.reason},${note},${ratings[0]},${ratings[1]},${ratings[2]},${dedupe}) ON CONFLICT ("dedupeKey") DO NOTHING RETURNING id`;
   res.status(saved.length?201:200).json({success:true,message:saved.length?'Feedback saved for review. It does not immediately change menus, ratings or recommendations.':'This feedback was already received today.'});
  }catch{res.status(503).json({success:false,error:'Feedback could not be saved. Please try again later.'});}
 });
 app.post('/api/customer-feedback/queue',async(req,res)=>{if(!reviewer(req,res))return;try{await initialise();const feedback=await sql`SELECT f.id,f.kind,f.reason,f.note,f.taste,f.portion,f.value,f."createdAt",d.name AS "dishName",r.name AS restaurant FROM public."CustomerFeedback" f JOIN public."Dish" d ON d.id=f."dishId" JOIN public."Restaurant" r ON r.id=d."restaurantId" WHERE f.status='pending' ORDER BY f."createdAt" LIMIT 100`;res.json({success:true,feedback});}catch{res.status(503).json({success:false,error:'Feedback queue is unavailable.'});}});
 app.post('/api/customer-feedback/review',async(req,res)=>{if(!reviewer(req,res))return;const b=req.body || {};if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(b.id || '') || !['approved','rejected'].includes(b.status))return res.status(400).json({success:false,error:'Choose a valid feedback review decision.'});try{await initialise();const changed=await sql`UPDATE public."CustomerFeedback" SET status=${b.status},"reviewedAt"=NOW() WHERE id=${b.id}::uuid AND status='pending' RETURNING id`;if(!changed.length)return res.status(409).json({success:false,error:'This feedback is already reviewed or unavailable.'});res.json({success:true,message:'Feedback review saved. Menu corrections require separate source verification.'});}catch{res.status(503).json({success:false,error:'Could not save the review.'});}});
};
