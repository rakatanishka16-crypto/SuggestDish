module.exports=function registerDishEvents(app,sql){
 let ready;
 const init=()=>ready || (ready=sql`CREATE TABLE IF NOT EXISTS public."DishEventTotals" ("dishId" integer NOT NULL REFERENCES public."Dish"(id),day date NOT NULL DEFAULT CURRENT_DATE,event text NOT NULL,total bigint NOT NULL DEFAULT 0,PRIMARY KEY("dishId",day,event))`.catch(e=>{ready=null;throw e;}));
 const attempts=new Map();
 app.post('/api/dish-events',async(req,res)=>{
  const b=req.body || {};res.set('Cache-Control','no-store');
  if(!['recommendation_shown','maps_click','menu_click','share_click'].includes(b.event) || !Array.isArray(b.dishIds)||b.dishIds.length<1||b.dishIds.length>3||b.dishIds.some(x=>!Number.isSafeInteger(x)||x<1))return res.status(400).json({success:false,error:'Invalid event.'});
  const now=Date.now();for(const [k,v] of attempts)if(v.ends<now)attempts.delete(k);const key=String(req.ip || 'unknown'),count=attempts.get(key)||{n:0,ends:now+60000};count.n++;attempts.set(key,count);if(count.n>120 || attempts.size>1000)return res.status(429).json({success:false,error:'Event limit reached.'});
  try{await init();let recorded=0;for(const id of [...new Set(b.dishIds)]){const rows=await sql`INSERT INTO public."DishEventTotals"("dishId",day,event,total) SELECT id,CURRENT_DATE,${b.event},1 FROM public."Dish" WHERE id=${id} ON CONFLICT("dishId",day,event) DO UPDATE SET total=public."DishEventTotals".total+1 RETURNING "dishId"`;recorded+=rows.length;}if(!recorded)return res.status(404).json({success:false,error:'No matching dish event was recorded.'});res.json({success:true,recorded});}catch{res.status(503).json({success:false,error:'Event collection unavailable.'});}
 });
 return async restaurantId=>{await init();return sql`SELECT d.id,d.name,e.event,COALESCE(SUM(e.total),0)::text AS total FROM public."Dish" d LEFT JOIN public."DishEventTotals" e ON e."dishId"=d.id WHERE d."restaurantId"=${restaurantId} GROUP BY d.id,d.name,e.event ORDER BY d.name`;};
};
