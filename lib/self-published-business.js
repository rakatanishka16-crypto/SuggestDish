'use strict';
// Keep legacy review states for schema compatibility. This marker distinguishes
// public owner declarations from independently reviewed ownership and menus.
const marker='owner_self_published_v1';
const isPublished=s=>s?.status==='pending' && typeof s?.verificationNotes==='string' && s.verificationNotes.startsWith(marker);
const directoryUrl=s=>'/?'+new URLSearchParams({outletCity:s.city,outletName:s.businessName})+'#business-directory';
async function create(sql,d,{id,duplicateKey,checkoutTokenHash}) {
 // A single statement makes business, dish and submission atomic. A duplicate
 // submission raises 23505 and rolls back the new restaurant and dish too.
 return sql`WITH restaurant AS (
  INSERT INTO public."Restaurant" (name,address,city,"updatedAt")
  VALUES (${d.businessName},${d.address},${d.city},NOW()) RETURNING id
 ), dish AS (
  INSERT INTO public."Dish" (name,price,"isVeg","restaurantId","updatedAt")
  SELECT ${d.dishName},${d.dishPrice},${d.isVeg},id,NOW() FROM restaurant RETURNING id
 ) INSERT INTO public."BusinessSubmission" (id,"duplicateKey","businessName",category,city,address,"contactName",email,phone,"profileUrl","menuUrl","dishName","dishPrice","isVeg","checkoutTokenHash","restaurantId","verificationNotes")
 SELECT ${id}::uuid,${duplicateKey},${d.businessName},${d.category},${d.city},${d.address},${d.contactName},${d.email.toLowerCase()},${d.phone},${d.profileUrl},${d.menuUrl || d.profileUrl},${d.dishName},${d.dishPrice},${d.isVeg},${checkoutTokenHash},restaurant.id,${marker}
 FROM restaurant CROSS JOIN dish RETURNING id,"restaurantId"`;
}
async function update(sql,s,d) {
 // Authenticated owners can publish a legacy unlinked submission or update only
 // the menu created by this self-publication path. Never overwrite a claimed or
 // independently imported restaurant's menu.
 return sql`WITH locked AS (
  SELECT * FROM public."BusinessSubmission" WHERE id=${s.id}::uuid
  AND status IN ('pending','needs_information')
  AND ("restaurantId" IS NULL OR "verificationNotes" LIKE ${marker+'%'}) FOR UPDATE
 ), created_restaurant AS (
  INSERT INTO public."Restaurant" (name,address,city,"updatedAt")
  SELECT "businessName",address,city,NOW() FROM locked WHERE "restaurantId" IS NULL RETURNING id
 ), target AS (
  SELECT id FROM created_restaurant UNION ALL SELECT "restaurantId" FROM locked WHERE "restaurantId" IS NOT NULL
 ), changed_dish AS (
  UPDATE public."Dish" SET name=${d.dishName},price=${d.dishPrice},"isVeg"=${d.isVeg},"updatedAt"=NOW()
  WHERE "restaurantId" IN (SELECT id FROM target) AND name IN (SELECT "dishName" FROM locked)
  RETURNING id
 ), created_dish AS (
  INSERT INTO public."Dish" (name,price,"isVeg","restaurantId","updatedAt")
  SELECT ${d.dishName},${d.dishPrice},${d.isVeg},id,NOW() FROM created_restaurant RETURNING id
 ) UPDATE public."BusinessSubmission" SET "profileUrl"=${d.profileUrl},"dishName"=${d.dishName},"dishPrice"=${d.dishPrice},"isVeg"=${d.isVeg},"menuUrl"=${d.menuUrl || d.profileUrl},status='pending',"verificationNotes"=${marker},"restaurantId"=target.id
 FROM target WHERE "BusinessSubmission".id=${s.id}::uuid
 AND (EXISTS(SELECT 1 FROM changed_dish) OR EXISTS(SELECT 1 FROM created_dish)) RETURNING "BusinessSubmission".id`;
}
module.exports={marker,isPublished,directoryUrl,create,update};
