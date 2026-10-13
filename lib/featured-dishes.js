'use strict';
const plans={monthly:{amount:49900,slots:3},annual:{amount:499900,slots:2}};
function eligible(row,now=Date.now()){
 const plan=Object.hasOwn(plans,row.plan) ? plans[row.plan] : null;
 const starts=Date.parse(row.startsAt),ends=Date.parse(row.endsAt);
 return Boolean(plan && row.paymentStatus==='captured' && typeof row.keyId==='string' && row.keyId.startsWith('rzp_live_') &&
  row.currency==='INR' && row.amount===plan.amount && Number.isFinite(starts) && Number.isFinite(ends) && starts<=now && ends>now &&
  row.claimStatus==='approved' && row.revisionStatus==='approved' && row.submissionStatus==='approved' &&
  Number.isInteger(row.slot) && row.slot>=1 && row.slot<=plan.slots &&
  Number.isSafeInteger(row.dishId) && row.dishId>0 && Number.isFinite(row.price) && row.price>0 &&
  typeof row.dishName==='string' && row.dishName.trim() && typeof row.restaurant==='string' && row.restaurant.trim() &&
  typeof row.vegetarian==='boolean');
}
module.exports=function register(app,sql){
 app.get('/api/featured-dishes',async(req,res)=>{
  res.set('Cache-Control','no-store');
  try{
   const rows=await sql`SELECT d.id AS "dishId",d.name AS "dishName",d.price,d."isVeg" AS vegetarian,
    r.name AS restaurant,r.city,r.address,sr."menuUrl",sd.slot,
    bc.status AS "claimStatus",sr.status AS "revisionStatus",bs.status AS "submissionStatus",
    p.plan,p.amount,p.currency,p."keyId",p.status AS "paymentStatus",p."startsAt",p."endsAt"
    FROM public."RestaurantStarDish" sd
    JOIN public."Dish" d ON d.id=sd."dishId" AND d."restaurantId"=sd."restaurantId"
    JOIN public."Restaurant" r ON r.id=sd."restaurantId"
    JOIN public."StarDishRevision" sr ON sr.id=sd."revisionId" AND sr.status='approved'
    JOIN public."BusinessClaim" bc ON bc.id=sr."claimId" AND bc."restaurantId"=r.id AND bc.status='approved'
    JOIN LATERAL (
     SELECT payment.* FROM public."BusinessPlanPayment" payment
     JOIN public."BusinessSubmission" submission ON submission.id=payment."submissionId" AND submission."restaurantId"=r.id AND submission.status='approved'
     WHERE payment."restaurantId"=r.id AND payment.status='captured' AND LEFT(payment."keyId",9)='rzp_live_'
      AND payment."startsAt"<=NOW() AND payment."endsAt">NOW() AND payment.currency='INR'
      AND ((payment.plan='monthly' AND payment.amount=49900 AND sd.slot<=3) OR (payment.plan='annual' AND payment.amount=499900 AND sd.slot<=2))
     ORDER BY payment."endsAt" DESC LIMIT 1
    ) p ON true
    JOIN public."BusinessSubmission" bs ON bs.id=p."submissionId"
    WHERE LOWER(r.name) !~ '(^|[^a-z])tejal[''’]?s?[[:space:]]+kitchen([^a-z]|$)'
    ORDER BY sd."approvedAt" DESC,d.id ASC LIMIT 6`;
   const now=Date.now();
   const dishes=rows.filter(row=>eligible(row,now)).map(row=>({
    dishId:row.dishId,dishName:row.dishName,price:row.price,vegetarian:row.vegetarian,
    restaurant:row.restaurant,city:row.city || null,address:row.address || null,menuUrl:row.menuUrl || null,sponsored:true
   }));
   return res.json({success:true,dishes});
  }catch{return res.status(503).json({success:false,error:'Featured dishes are temporarily unavailable.'});}
 });
};
module.exports.eligible=eligible;
