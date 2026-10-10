// Read-only aggregate supply audit. Counts do not assert menu freshness or ownership.
module.exports=function register(app,sql){
 app.get('/api/recommendation-coverage',async(req,res)=>{
  res.set('Cache-Control','no-store');
  const city=String(req.query.city||'').trim();
  if(!city||city.length>120)return res.status(400).json({success:false,error:'Provide a city of at most 120 characters.'});
  try{
   const rows=await sql`WITH supply AS (
    SELECT d.id,d."restaurantId",d.price,d."isVeg",r.latitude,r.longitude,
     (EXISTS(SELECT 1 FROM "RestaurantStarDish" sd WHERE sd."dishId"=d.id AND sd.slot<=public.restaurant_star_limit(r.id))
      OR (NOT EXISTS(SELECT 1 FROM "RestaurantStarDish" sd WHERE sd."restaurantId"=r.id)
          AND EXISTS(SELECT 1 FROM "SourceStarDish" cs WHERE cs."dishId"=d.id AND cs."restaurantId"=r.id AND cs."expiresAt">NOW()))
      OR (NOT EXISTS(SELECT 1 FROM "RestaurantStarDish" sd WHERE sd."restaurantId"=r.id)
          AND NOT EXISTS(SELECT 1 FROM "SourceStarDish" cs WHERE cs."restaurantId"=r.id AND cs."expiresAt">NOW()))) AS selected
    FROM "Dish" d JOIN "Restaurant" r ON r.id=d."restaurantId"
    WHERE LOWER(TRIM(r.city))=LOWER(${city})
   ), candidates AS (
    SELECT *, (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180) AS mapped
    FROM supply WHERE selected AND price>=0 AND price<'Infinity'::double precision
   )
   SELECT (SELECT COUNT(*) FROM supply WHERE price IS NOT NULL)::integer AS priced_records,
    COUNT(*)::integer AS candidate_records,COUNT(DISTINCT "restaurantId")::integer AS candidate_restaurants,
    COUNT(*) FILTER(WHERE mapped)::integer AS mapped_candidates,
    COUNT(DISTINCT "restaurantId") FILTER(WHERE mapped)::integer AS mapped_restaurants,
    COUNT(*) FILTER(WHERE "isVeg"=true)::integer AS vegetarian_candidates,
    COUNT(*) FILTER(WHERE "isVeg"=false)::integer AS nonvegetarian_candidates,
    COUNT(*) FILTER(WHERE "isVeg" IS NULL)::integer AS unknown_diet_candidates FROM candidates`;
   const counts=Object.fromEntries(Object.entries(rows[0]||{}).map(([k,v])=>[k,Number(v)]));
   res.json({success:true,city,observedAt:new Date().toISOString(),counts,scope:'Database candidates after active star selection and finite nonnegative price checks, before budget, radius, cuisine and requested-dish filters.',locationAccuracyVerified:false,currentAvailabilityVerified:false,dietaryPreparationVerified:false,notice:'Coordinates are present and in range, not independently verified. Counts are dish records, not unique recipes, orders or popularity.'});
  }catch{return res.status(503).json({success:false,error:'Recommendation coverage is temporarily unavailable.'});}
 });
};
