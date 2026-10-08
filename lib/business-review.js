const reviewContact=require('./review-contact');
const reviewerKey=require('./reviewer-config');
const crypto=require('node:crypto');
const {profileUrl}=require('./business-listings');
module.exports=function(app,sql,{env=process.env}={}){
 function authorised(req,res){
  res.set('Cache-Control','no-store');
  const expected=reviewerKey(env);
  if(!expected || expected.length<32){res.status(503).json({success:false,error:'Private review access has not been configured.'});return false;}
  const supplied=req.headers.authorization || '';
  const hash=s=>crypto.createHash('sha256').update(s).digest();
  if(!crypto.timingSafeEqual(hash(supplied),hash('Bearer '+expected))){res.status(403).json({success:false,error:'Private reviewer access required.'});return false;}
  return true;
 }
 app.post('/api/business-review/queue',async(req,res)=>{
  if(!authorised(req,res))return;
  try{const rows=await sql`SELECT id,"businessName",category,city,address,"profileUrl","menuUrl","dishName","dishPrice","isVeg",status,"createdAt" FROM public."BusinessSubmission" WHERE status IN ('pending','needs_information') ORDER BY "createdAt" LIMIT 100`;res.json({success:true,submissions:rows});}
  catch{res.status(503).json({success:false,error:'Could not load review queue.'});}
 });
 app.post('/api/business-review/contact',async(req,res)=>{
  if(!authorised(req,res))return;
  const id=req.body?.id;if(!reviewContact.validId(id))return res.status(400).json({success:false,error:'Enter a valid review reference.'});
  try{const rows=await sql`SELECT "contactName",email,phone FROM public."BusinessSubmission" WHERE id=${id}::uuid AND status IN ('pending','needs_information')`;
   if(!rows.length)return res.status(404).json({success:false,error:'Pending review not found.'});
   res.json({success:true,contact:reviewContact.contact(rows[0])});
  }catch{res.status(503).json({success:false,error:'Submitted contact details are temporarily unavailable.'});}
 });
 app.post('/api/business-review/decision',async(req,res)=>{
  if(!authorised(req,res))return;
  const b=req.body || {};
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(b.submissionId || '') || !['approved','rejected','needs_information'].includes(b.status) || typeof b.notes!=='string' || b.notes.trim().length<20 || b.notes.length>2000)return res.status(400).json({success:false,error:'Choose a decision and record at least 20 characters of review notes.'});
  if(b.status==='approved' && (!profileUrl(b.evidenceUrl) || b.checked!==true))return res.status(400).json({success:false,error:'Confirm independent profile, ownership and menu checks, with a Google or Zomato evidence link.'});
  try{
   if(b.status==='approved'){const rows=await sql`SELECT public.approve_business_submission(${b.submissionId}::uuid,${b.evidenceUrl},${b.notes.trim()}) AS "restaurantId"`;return res.json({success:true,restaurantId:rows[0].restaurantId,message:'Business and signature dish approved. Nearby searches also require verified restaurant coordinates.'});}
   const rows=await sql`UPDATE public."BusinessSubmission" SET status=${b.status},"verificationNotes"=${b.notes.trim()},"reviewedAt"=NOW() WHERE id=${b.submissionId}::uuid AND status IN ('pending','needs_information') RETURNING id`;
   if(!rows.length)return res.status(409).json({success:false,error:'Submission is no longer awaiting review.'});
   res.json({success:true,message:'Review decision saved.'});
  }catch{res.status(409).json({success:false,error:'Review could not be saved. Check the submission and any existing dish conflicts in Neon.'});}
 });
};
