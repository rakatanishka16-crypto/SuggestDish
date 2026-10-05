const {distanceKm,queryOrigin}=require('./outlet-distance');
const FILTERS=Object.freeze({restaurant:['amenity:restaurant'],cafe:['amenity:cafe'],fast_food:['amenity:fast_food','amenity:food_court','amenity:ice_cream'],bakery:['shop:bakery','shop:pastry','shop:confectionery'],catering:['craft:caterer','shop:catering'],hotel:['tourism:hotel','tourism:motel','tourism:guest_house','tourism:resort'],other:['amenity:bar','amenity:pub','shop:deli']});
const sourceRows=require('./source-catalog').listingRows;
module.exports=function(app,sql){
 app.get('/api/business-directory',async(req,res)=>{
  res.set('Cache-Control','no-store');
  const q=String(req.query.q || '').trim(),city=String(req.query.city || '').trim(),category=String(req.query.category || '');
  const offset=Number(req.query.offset || 0),limit=Number(req.query.limit || 20);
  if(q.length>100 || city.length>100 || (category && !FILTERS[category]) || !Number.isInteger(offset) || offset<0 || offset>100000 || !Number.isInteger(limit) || limit<1 || limit>50)return res.status(400).json({success:false,error:'Enter valid search filters.'});
  let origin;try{origin=queryOrigin(req.query);}catch(error){return res.status(400).json({success:false,error:error.message});}
  // Escape LIKE wildcards: business text is data, never SQL or a wildcard expression.
  const escape=s=>s.replace(/[\\%_]/g,c=>'\\'+c),pattern='%'+escape(q)+'%',cityPattern='%'+escape(city)+'%',cats=FILTERS[category] || [];
  try{
   const rows=await sql`WITH sources AS (
    SELECT * FROM jsonb_to_recordset(${JSON.stringify(sourceRows)}::jsonb) AS s(id TEXT,name TEXT,category TEXT,address TEXT,city TEXT,"sourceUrl" TEXT,"reviewStatus" TEXT,"restaurantId" INTEGER,"existingBusinessId" TEXT,latitude DOUBLE PRECISION,longitude DOUBLE PRECISION)
   ), existing AS (
    SELECT c."sourceKey" AS id,c.name,c.category,c.address,c.city,c."sourceUrl",c."reviewStatus",c."restaurantId",c.latitude,c.longitude FROM public."HorecaCandidate" c
    UNION ALL
    SELECT 'restaurant:'||r.id::text,r.name,'amenity:restaurant',r.address,COALESCE(r.city,''),NULL::text,CASE WHEN EXISTS(SELECT 1 FROM public."Dish" d WHERE d."restaurantId"=r.id) THEN 'menu_available' ELSE 'business_record' END,r.id,r.latitude,r.longitude FROM public."Restaurant" r WHERE NOT EXISTS(SELECT 1 FROM public."HorecaCandidate" c WHERE c."restaurantId"=r.id)
   ), directory AS (
    SELECT e.id,e.name,e.category,e.address,e.city,e."sourceUrl",e."reviewStatus",e."restaurantId",COALESCE(s.latitude,e.latitude) AS latitude,COALESCE(s.longitude,e.longitude) AS longitude,s.id AS "sourceProfileId" FROM existing e LEFT JOIN sources s ON e.id=s."existingBusinessId" OR (LOWER(TRIM(e.name))=LOWER(TRIM(s.name)) AND LOWER(TRIM(COALESCE(e.address,'')))=LOWER(TRIM(s.address)) AND s.address<>'')
    UNION ALL SELECT s.id,s.name,s.category,s.address,s.city,s."sourceUrl",s."reviewStatus",s."restaurantId",s.latitude,s.longitude,s.id AS "sourceProfileId" FROM sources s WHERE NOT EXISTS(SELECT 1 FROM existing e WHERE e.id=s."existingBusinessId" OR (LOWER(TRIM(e.name))=LOWER(TRIM(s.name)) AND LOWER(TRIM(COALESCE(e.address,'')))=LOWER(TRIM(s.address)) AND s.address<>''))
   ) SELECT *,COUNT(*) OVER()::integer AS "matchCount" FROM directory WHERE (name ILIKE ${pattern} OR COALESCE(address,'') ILIKE ${pattern}) AND (city ILIKE ${cityPattern} OR COALESCE(address,'') ILIKE ${cityPattern}) AND (${category}='' OR category=ANY(${cats}::text[])) ORDER BY LOWER(name),id LIMIT ${limit} OFFSET ${offset}`;
   const total=rows[0]?.matchCount || 0;
   res.json({success:true,businesses:rows.map(({matchCount,...r})=>({...r,distanceKm:distanceKm(origin,r),distanceBasis:origin ? 'straight_line' : null})),total,offset,hasMore:rows.length===limit && offset+rows.length<total,coverage:'Partial source coverage; this is not a complete census. Mapped hotel or pub records do not confirm food service. Menus and operating status may need verification.'});
  }catch{res.status(503).json({success:false,error:'Business directory is temporarily unavailable.'});}
 });
};
