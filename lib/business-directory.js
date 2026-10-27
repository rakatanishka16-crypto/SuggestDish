const {marker}=require('./self-published-business');
const {distanceKm,queryOrigin}=require('./outlet-distance');
const FILTERS=Object.freeze({restaurant:['amenity:restaurant'],cafe:['amenity:cafe'],fast_food:['amenity:fast_food','amenity:food_court','amenity:ice_cream'],bakery:['shop:bakery','shop:pastry','shop:confectionery','craft:confectionery'],catering:['craft:caterer','shop:catering'],hotel:['tourism:hotel','tourism:motel','tourism:guest_house','tourism:resort'],other:['amenity:bar','amenity:pub','shop:deli']});
const sourceRows=require('./source-catalog').listingRows;
const sourceMetadata=new Map(sourceRows.map(r=>[r.id,r]));
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
   // Match the city before serializing the national source catalogue. The final
   // SQL city filter still applies to stored and owner-submitted records.
   const sourceCandidates=city ? sourceRows.filter(r=>String(r.city || '').toLowerCase().includes(city.toLowerCase())) : sourceRows;
   const sourceInput=sourceCandidates.map(({fssaiRecords,...r})=>r);
   const rows=await sql`WITH sources AS (
    SELECT * FROM jsonb_to_recordset(${JSON.stringify(sourceInput)}::jsonb) AS s(id TEXT,name TEXT,brand TEXT,category TEXT,address TEXT,city TEXT,"sourceUrl" TEXT,"reviewStatus" TEXT,"restaurantId" INTEGER,"existingBusinessId" TEXT,latitude DOUBLE PRECISION,longitude DOUBLE PRECISION)
   ), existing AS (
    SELECT c."sourceKey" AS id,c.name,c.category,c.address,c.city,c."sourceUrl",c."reviewStatus",c."restaurantId",c.latitude,c.longitude FROM public."HorecaCandidate" c
    UNION ALL
    SELECT 'restaurant:'||r.id::text,r.name,'amenity:restaurant',r.address,COALESCE(r.city,''),NULL::text,CASE WHEN EXISTS(SELECT 1 FROM public."Dish" d WHERE d."restaurantId"=r.id) THEN 'menu_available' ELSE 'business_record' END,r.id,r.latitude,r.longitude FROM public."Restaurant" r WHERE NOT EXISTS(SELECT 1 FROM public."HorecaCandidate" c WHERE c."restaurantId"=r.id) AND NOT EXISTS(SELECT 1 FROM public."BusinessSubmission" b WHERE b."restaurantId"=r.id AND b."verificationNotes" LIKE ${marker+'%'})
    UNION ALL
    SELECT 'submission:'||b.id::text,b."businessName",CASE b.category WHEN 'Restaurant' THEN 'amenity:restaurant' WHEN 'Cafe' THEN 'amenity:cafe' WHEN 'Hotel' THEN 'tourism:hotel' WHEN 'Bakery' THEN 'shop:bakery' WHEN 'Home baker' THEN 'shop:bakery' WHEN 'Catering' THEN 'craft:caterer' WHEN 'Cloud kitchen' THEN 'amenity:fast_food' WHEN 'Food outlet' THEN 'amenity:fast_food' ELSE 'shop:deli' END,b.address,b.city,b."profileUrl",'owner_submitted',b."restaurantId",r.latitude,r.longitude
    FROM public."BusinessSubmission" b JOIN public."Restaurant" r ON r.id=b."restaurantId"
    WHERE b.status='pending' AND b."verificationNotes" LIKE ${marker+'%'}
   ), source_matches AS (
    SELECT e.id AS existing_id,s.id AS source_id,0 AS priority FROM existing e JOIN sources s ON e.id=s."existingBusinessId"
    UNION ALL SELECT e.id,s.id,1 FROM existing e JOIN sources s ON LOWER(TRIM(e.name))=LOWER(TRIM(s.name)) AND LOWER(TRIM(COALESCE(e.address,'')))=LOWER(TRIM(s.address)) WHERE s.address<>''
    UNION ALL SELECT e.id,s.id,1 FROM existing e JOIN sources s ON e.id LIKE 'submission:%' AND e."sourceUrl"=s."sourceUrl" AND COALESCE(s.address,'')='' AND LOWER(TRIM(e.name))=LOWER(TRIM(s.name)) AND LOWER(TRIM(e.city))=LOWER(TRIM(s.city))
    UNION ALL SELECT e.id,s.id,2 FROM existing e JOIN sources s ON regexp_replace(LOWER(e.name),'[^a-z0-9]','','g')=regexp_replace(LOWER(s.brand),'[^a-z0-9]','','g') WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL AND ABS(e.latitude-s.latitude)<0.00025 AND ABS(e.longitude-s.longitude)<0.00025
   ), ranked_matches AS (
    SELECT existing_id,source_id,ROW_NUMBER() OVER(PARTITION BY existing_id ORDER BY priority,source_id) AS match_rank FROM source_matches
   ), directory AS (
    SELECT e.id,COALESCE(s.name,e.name) AS name,CASE WHEN e."reviewStatus"='owner_submitted' THEN e.category ELSE COALESCE(s.category,e.category) END AS category,COALESCE(s.address,e.address) AS address,COALESCE(s.city,e.city) AS city,CASE WHEN e."reviewStatus"='owner_submitted' THEN e."sourceUrl" ELSE COALESCE(s."sourceUrl",e."sourceUrl") END AS "sourceUrl",CASE WHEN e."reviewStatus"='owner_submitted' THEN e."reviewStatus" ELSE COALESCE(s."reviewStatus",e."reviewStatus") END AS "reviewStatus",e."restaurantId",COALESCE(s.latitude,e.latitude) AS latitude,COALESCE(s.longitude,e.longitude) AS longitude,s.id AS "sourceProfileId" FROM existing e LEFT JOIN ranked_matches m ON m.existing_id=e.id AND m.match_rank=1 LEFT JOIN sources s ON s.id=m.source_id
    UNION ALL SELECT s.id,s.name,s.category,s.address,s.city,s."sourceUrl",s."reviewStatus",s."restaurantId",s.latitude,s.longitude,s.id AS "sourceProfileId" FROM sources s WHERE NOT EXISTS(SELECT 1 FROM ranked_matches m WHERE m.source_id=s.id AND m.match_rank=1)
   ) SELECT *, (SELECT b."menuUrl" FROM public."BusinessSubmission" b WHERE 'submission:'||b.id::text=directory.id AND b."verificationNotes" LIKE ${marker+'%'}) AS "menuUrl",COUNT(*) OVER()::integer AS "matchCount" FROM directory WHERE LOWER(name) !~ '(^|[^a-z])tejal[''’]?s?[[:space:]]+kitchen([^a-z]|$)' AND (name ILIKE ${pattern} OR COALESCE(address,'') ILIKE ${pattern}) AND city ILIKE ${cityPattern} AND (${category}='' OR category=ANY(${cats}::text[])) ORDER BY LOWER(name),id LIMIT ${limit} OFFSET ${offset}`;
   const total=rows[0]?.matchCount || 0;
   res.json({success:true,businesses:rows.map(({matchCount,...r})=>({...r,fssaiRecords:sourceMetadata.get(r.sourceProfileId)?.fssaiRecords || [],menuUrl:r.menuUrl || sourceMetadata.get(r.sourceProfileId)?.menuUrl || null,...(sourceMetadata.get(r.sourceProfileId)?.sourceLicense ? {sourceLicense:sourceMetadata.get(r.sourceProfileId).sourceLicense,attribution:sourceMetadata.get(r.sourceProfileId).attribution,coordinateType:sourceMetadata.get(r.sourceProfileId).coordinateType}:{}),distanceKm:distanceKm(origin,r),distanceBasis:origin ? 'straight_line' : null})),total,offset,hasMore:rows.length===limit && offset+rows.length<total,coverage:'Partial source coverage; this is not a complete census. Mapped hotel or pub records do not confirm food service. Menus and operating status may need verification.'});
  }catch{res.status(503).json({success:false,error:'Business directory is temporarily unavailable.'});}
 });
};
