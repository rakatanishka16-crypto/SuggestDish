'use strict';
const crypto=require('node:crypto');const filters=require('./search-filters');const {coordinates,distanceKm}=require('./outlet-distance');
const normal=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
const safeURL=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
function dietMatches(d,f){const t=d.diet_type;if(f==='any'||!f)return true;if(f==='vegetarian')return t==='vegetarian'||(['jain','vegan'].includes(t)&&d.ingredients_verified===true);if(['jain','vegan'].includes(f))return t===f&&d.ingredients_verified===true;return t===f;}
function rank(rows,f,{origin=null,radius=5,now=Date.now()}={}){
 const tasteWords={light:/\b(poha|idli|upma|khichdi|salad|soup|steamed)\b/i,spicy:/\b(misal|spicy|schezwan|chilli|kolhapuri)\b/i,sweet:/\b(jalebi|sweet|cake|gulab|halwa|ice cream|waffle)\b/i,crispy:/\b(crispy|dosa|pakora|vada)\b/i,tangy:/\b(chaat|pani puri|bhel|tangy)\b/i,rich:/\b(butter|cream|makhani|cheese)\b/i};
 return rows.flatMap(d=>{
  if(!f.dishName && (/^(extra|add[ -]?on|packaging|cutlery|disposable|tissue|spoon|service charge|delivery charge)\b/i.test(d.name)||/\b(water bottle|packaged (?:drinking )?water|mineral water)\b/i.test(d.name)))return[];
  if(!Number.isFinite(d.price)||d.price<=0||!dietMatches(d,f.diet)||(f.maxPrice&&d.price>f.maxPrice))return[];
  if(f.dishName&&!normal(f.dishName).split(' ').every(word=>normal(d.name).includes(word)))return[];
  const meal=d.meal_type||( /\b(poha|idli|dosa|upma|misal|breakfast)\b/i.test(d.name)?'breakfast':null);
  if(f.mealType&&['breakfast','lunch','dinner','snack'].includes(f.mealType)&&meal!==f.mealType)return[];
  if(f.dining&&!(d.dining_options||[]).includes(f.dining)&&!(f.dining==='delivery'&&(safeURL(d.zomato_url)||safeURL(d.swiggy_url))))return[];
  const distance=origin?distanceKm(origin,d):null;if(origin&&(distance===null||distance>radius))return[];
  const taste=f.taste&&f.taste!=='any'&&((d.taste_tags||[]).includes(f.taste)||tasteWords[f.taste]?.test(d.name));
  const cuisine=f.cuisine&&normal(d.cuisine).includes(normal(f.cuisine));
  const rating=Number.isFinite(d.rating)?d.rating:0;const age=d.last_verified_at?(now-Date.parse(d.last_verified_at))/86400000:Infinity;
  const recency=Number.isFinite(age)&&age>=0?Math.max(0,1-age/180):0;
  const votes=Number(d.vote_count||0),ratio=votes?Number(d.up_votes||0)/votes:0;
  const score=(taste?30:0)+(cuisine?25:0)+(f.maxPrice?15*(1-d.price/(f.maxPrice*2)):0)+rating*2+recency*10+ratio*10;
  const reasons=[];if(taste)reasons.push(f.taste+' menu match');if(cuisine)reasons.push(d.cuisine);if(f.maxPrice)reasons.push('₹'+d.price+' within ₹'+f.maxPrice);if(f.diet&&f.diet!=='any')reasons.push(f.diet==='vegetarian'?'pure veg':f.diet);if(rating)reasons.push(rating+'/5');if(d.order_count>0)reasons.push(d.order_count+' recorded orders');if(!reasons.length)reasons.push('Listed in '+d.city+' at ₹'+d.price);
  return[{...d,distanceKm:distance,score:Math.round(score*100)/100,reason:reasons.slice(0,3).join(' · ')}];
 }).sort((a,b)=>b.score-a.score||a.id-b.id);
}
function publicDish(d){
 const mapped=coordinates(d.latitude,d.longitude);const phone=typeof d.call_phone==='string'&&/^\+?[\d ()-]{7,20}$/.test(d.call_phone)?d.call_phone.replace(/[ ()-]/g,''):null;
 return {dishId:d.id,dishName:d.name,restaurant:d.restaurant,city:d.city,area:d.area||null,address:d.area||null,cuisine:d.cuisine||null,dietType:d.diet_type,vegetarian:['vegetarian','jain','vegan'].includes(d.diet_type),price:d.price,forTwo:d.price*2,distanceKm:d.distanceKm??null,latitude:mapped?d.latitude:null,longitude:mapped?d.longitude:null,reason:d.reason,score:d.score,lastVerifiedAt:d.last_verified_at||null,photoUrl:d.photo_permission?safeURL(d.photo_url):null,photoCredit:d.photo_permission?d.photo_credit:null,sourceUrls:(d.source_urls||[]).map(safeURL).filter(Boolean),rating:d.rating??null,orderCount:d.order_count??null,sponsored:d.is_sponsored===true,dishOfWeek:d.dish_of_week===true,actions:{zomato:safeURL(d.zomato_url),swiggy:safeURL(d.swiggy_url),call:phone?'tel:'+phone:null,directions:mapped?'https://www.google.com/maps/search/?api=1&query='+d.latitude+','+d.longitude:null}};
}
module.exports=function register(app,sql,{ai,env=process.env}={}){
 async function inventory(city){
   const rowsPromise=sql`SELECT d.*,r.name AS restaurant,COALESCE(d.city,r.city) AS city,COALESCE(d.area,r.address) AS area,r.latitude,r.longitude,
    votes.up_votes,votes.vote_count
    FROM public."Dish" d JOIN public."Restaurant" r ON r.id=d."restaurantId"
    LEFT JOIN LATERAL (SELECT COUNT(*) FILTER(WHERE vote=1)::integer AS up_votes,COUNT(*)::integer AS vote_count FROM public."DishVote" v WHERE v.dish_id=d.id) votes ON TRUE
    WHERE (${city}='' OR LOWER(TRIM(COALESCE(d.city,r.city)))=LOWER(${city})) AND d.price>0 AND d.price<'Infinity'::double precision
     AND LOWER(r.name) !~ '(^|[^a-z])tejal[''’]?s?[[:space:]]+kitchen([^a-z]|$)'
     AND NOT EXISTS(SELECT 1 FROM public."BusinessSubmission" s WHERE s."restaurantId"=r.id AND s.status IN ('rejected','needs_information') AND s."verificationNotes" LIKE 'owner_self_published_v1%')
     AND (NOT EXISTS(SELECT 1 FROM public."RestaurantStarDish" star WHERE star."restaurantId"=r.id) OR EXISTS(SELECT 1 FROM public."RestaurantStarDish" star WHERE star."dishId"=d.id AND star.slot<=public.restaurant_star_limit(r.id)))
    ORDER BY d.id LIMIT 15000`;
   const promotionsPromise=sql`SELECT promotion.id AS "promotionId",promotion.name AS "dishName",promotion.price,promotion."isVeg",promotion."businessName",promotion."businessInfo",promotion."menuUrl",s.city FROM public."PaidDishPromotion" promotion JOIN public."BusinessSubmission" s ON s.id=promotion."submissionId"
    WHERE promotion.photo IS NOT NULL AND (${city}='' OR LOWER(s.city)=LOWER(${city})) AND (s.status='approved' OR (s.status='pending' AND s."verificationNotes" LIKE 'owner_self_published_v1%'))
    AND EXISTS(SELECT 1 FROM public."BusinessPlanPayment" p WHERE p."submissionId"=s.id AND p.status='captured' AND LEFT(p."keyId",9)='rzp_live_' AND p.currency='INR' AND p."startsAt"<=NOW() AND p."endsAt">NOW() AND ((p.plan='monthly' AND p.amount IN (49900,79900)) OR (p.plan='annual' AND p.amount IN (399900,499900)))) ORDER BY promotion."updatedAt" DESC,promotion.slot LIMIT 12`;
  return Promise.all([rowsPromise,promotionsPromise]);
 }
 async function search(req,res){
  res.set('Cache-Control','no-store');const b=req.body||{};let city,text,explicit;
  try{city=typeof b.city==='string'?b.city.trim():'Jalna';text=typeof b.text==='string'?b.text.trim():'';if(city.length>100||text.length>500)throw Error('Shorten your search.');explicit=filters.sanitize(b.filters||{});}catch(e){return res.status(400).json({success:false,error:e.message});}
  const pendingInventory=inventory(city).then(data=>({data}),error=>({error}));
  const surprise=b.surprise===true;let f=surprise?{}:{...filters.parse(text),...explicit};let parser='rules',parserFailed=false;
  // The model sees only text. It can extract filters, never invent or select dishes.
  if(text&&!surprise&&ai){try{
   const timeout=new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('parser_timeout')),1200);t.unref?.();});
   const response=await Promise.race([ai.models.generateContent({model:env.GEMINI_MODEL||'gemini-3.6-flash',contents:'Extract only explicitly requested food filters as JSON: cuisine, maxPrice (per dish, halve budgets for two), diet (any,vegetarian,egg,nonveg,jain,vegan), mealType, dishName, taste (light,spicy,sweet,tangy,crispy,rich). Omit missing fields. Never suggest dishes. User text: '+JSON.stringify(text),config:{responseMimeType:'application/json',temperature:0}}),timeout]);
   const parsed=filters.sanitize(JSON.parse(response.text));if(parsed.dishName&&!normal(text).includes(normal(parsed.dishName)))delete parsed.dishName;f={...parsed,...filters.parse(text),...explicit};parser='gemini';
  }catch{parserFailed=true;}}
  if(b.removeDiet===true)f.diet='any';
  let origin=null,radius=5;if(!surprise&&(b.lat!==undefined||b.lon!==undefined)){if(!coordinates(b.lat,b.lon))return res.status(400).json({success:false,error:'Location is unavailable. Select a city instead.'});origin={latitude:b.lat,longitude:b.lon};radius=Number(b.radius||5);if(!Number.isFinite(radius)||radius<.5||radius>50)return res.status(400).json({success:false,error:'Choose a distance up to 50 km.'});}
  try{
   const loaded=await pendingInventory;if(loaded.error)throw loaded.error;const [rows,promotions]=loaded.data;
   let ranked=rank(rows,f,{origin,radius});if(surprise&&ranked.length){const top=ranked.slice(0,Math.min(10,ranked.length));ranked=[top[crypto.randomInt(top.length)]];}
   const results=ranked.slice(0,12).map(publicDish);const searchId=crypto.randomUUID();
   const logFilters={diet:f.diet||'any',maxPrice:f.maxPrice||null,taste:f.taste||'any',nearby:Boolean(origin),surprise};
   await sql`INSERT INTO public."DishSearch"(id,city,filters,"dishIds") VALUES(${searchId}::uuid,${rows[0]?.city||(city?'unlisted':'nearby')},${JSON.stringify(logFilters)}::jsonb,${results.map(d=>d.dishId)}::integer[])`;
   const weekly=rank(rows.filter(d=>d.dish_of_week),f,{origin,radius}).map(publicDish)[0]||null;
   // Paid promotions are kept in a separate row, never mixed into the score.

   const sponsored=promotions.filter(p=>!origin&&(!f.taste||f.taste==='any')&&!f.cuisine&&!f.mealType&&!f.dining&&(!f.maxPrice||p.price<=f.maxPrice)&&(!f.diet||f.diet==='any'||(f.diet==='vegetarian'&&p.isVeg===true)||(f.diet==='nonveg'&&p.isVeg===false))&&(!f.dishName||normal(p.dishName).includes(normal(f.dishName)))).slice(0,2).map(p=>({...p,restaurant:p.businessName,area:p.businessInfo,dietType:p.isVeg?'vegetarian':'nonveg',photoUrl:'/api/promotion-photo/'+p.promotionId,sponsored:true,forTwo:p.price*2,reason:'Paid promotion · '+p.city,actions:{menu:safeURL(p.menuUrl)}}));
   return res.json({success:true,searchId,city,filters:f,precise:Boolean(origin),radius:origin?radius:null,parser,parserFailed,dishes:results,recommendations:results,sponsored:surprise?[]:sponsored,dishOfWeek:weekly});
  }catch(err){console.error('Dish search failed',{code:err.code||'search_failed'});return res.status(503).json({success:false,error:'Dish search is temporarily unavailable. Please try again.'});}
 }
 app.post('/api/dish-search',search);
 app.get('/api/ai-recommend',(req,res)=>{const q=req.query;req.body={city:q.city||(q.lat&&q.lon?'':'Jalna'),text:q.customPreferences||q.request||q.q||'',filters:{...(q.budget?{maxPrice:Number(q.budget)}:{}),...(q.diet?{diet:q.diet==='nonvegetarian'?'nonveg':q.diet}:q.vegetarian==='true'?{diet:'vegetarian'}:q.vegetarian==='false'?{diet:'nonveg'}:{}),...(q.taste?{taste:q.taste}:{}),...(q.cuisine?{cuisine:q.cuisine}:{}),...(q.mood?{mealType:q.mood}:{})},...(q.lat&&q.lon?{lat:Number(q.lat),lon:Number(q.lon),radius:Number(q.radiusKm||5)}:{})};return search(req,res);});
 app.get('/api/search-cities',async(req,res)=>{try{const rows=await sql`SELECT DISTINCT TRIM(COALESCE(d.city,r.city)) AS city FROM public."Dish" d JOIN public."Restaurant" r ON r.id=d."restaurantId" WHERE d.price>0 AND COALESCE(d.city,r.city) IS NOT NULL ORDER BY city`;res.json({success:true,cities:rows.map(r=>r.city)});}catch{res.json({success:true,cities:['Jalna','Mumbai']});}});
 app.post('/api/search-nearby',async(req,res)=>{const {lat,lon}=req.body||{};if(!coordinates(lat,lon))return res.status(400).json({success:false});try{const rows=await sql`SELECT DISTINCT city,latitude,longitude FROM public."Restaurant" WHERE city IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180`;const cities=rows.map(r=>({...r,km:distanceKm({latitude:lat,longitude:lon},r)})).sort((a,b)=>a.km-b.km);res.json({success:true,city:cities[0]?.km<=50?cities[0].city:null});}catch{res.json({success:true,city:null});}});
 app.post('/api/dish-vote',async(req,res)=>{const b=req.body||{};if(!uuid(b.search_id)||!Number.isSafeInteger(b.dish_id)||![-1,1].includes(b.vote))return res.status(400).json({success:false});try{const r=await sql`INSERT INTO public."DishVote"(search_id,dish_id,vote) SELECT ${b.search_id}::uuid,${b.dish_id},${b.vote} WHERE EXISTS(SELECT 1 FROM public."DishSearch" WHERE id=${b.search_id}::uuid AND ${b.dish_id}=ANY("dishIds")) ON CONFLICT(search_id,dish_id) DO UPDATE SET vote=EXCLUDED.vote RETURNING dish_id`;res.status(r.length?200:404).json({success:Boolean(r.length)});}catch{res.status(503).json({success:false});}});
 app.post('/api/search-click',async(req,res)=>{const b=req.body||{};if(!uuid(b.search_id)||!Number.isSafeInteger(b.dish_id)||!['zomato','swiggy','call','directions','share','save','map'].includes(b.action))return res.status(400).json({success:false});try{await sql`INSERT INTO public."DishSearchClick"(id,search_id,dish_id,action) SELECT ${crypto.randomUUID()}::uuid,${b.search_id}::uuid,${b.dish_id},${b.action} WHERE EXISTS(SELECT 1 FROM public."DishSearch" WHERE id=${b.search_id}::uuid AND ${b.dish_id}=ANY("dishIds"))`;res.json({success:true});}catch{res.status(503).json({success:false});}});
};
Object.assign(module.exports,{rank,publicDish,dietMatches,normal});
