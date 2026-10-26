'use strict';
const diets=['any','vegetarian','egg','nonveg','jain','vegan'];
const tastes=['any','light','spicy','sweet','tangy','crispy','rich'];
function parse(text=''){
 const q=String(text).toLowerCase().normalize('NFKC').trim();const f={};
 const money=q.match(/(?:under|below|within|less than|upto|up to|budget|ke andar|chya aat|पर्यंत|खाली)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{1,2})?)/)||q.match(/(?:₹|rs\.?|inr)\s*(\d+)/);
 if(money)f.maxPrice=Number(money[1]);else if(/\b(sasta|swasta|cheap|budget friendly)\b/.test(q))f.maxPrice=100;
 if(/\b(for (?:two|2)|2 people|do logo|doghansathi)\b/.test(q)&&f.maxPrice)f.maxPrice/=2;
 if(/\b(jain)\b/.test(q))f.diet='jain';else if(/\bvegan\b/.test(q))f.diet='vegan';else if(/\b(pure veg|vegetarian|shakahari|shakahar)\b/.test(q))f.diet='vegetarian';else if(/\b(non[ -]?veg|chicken|mutton|fish)\b/.test(q))f.diet='nonveg';else if(/\b(egg|anda)\b/.test(q))f.diet='egg';else if(/\b(pure veg|veg|vegetarian|shakahari|shakahar)\b/.test(q))f.diet='vegetarian';
 if(/\b(light|halka|halke|halkech|healthy|halka khana)\b/.test(q))f.taste='light';
 else if(/\b(spicy|tikhat|teekha|tikkhat|tikkaat)\b/.test(q))f.taste='spicy';else if(/\b(sweet|meetha|goad|god)\b/.test(q))f.taste='sweet';else if(/\btangy\b/.test(q))f.taste='tangy';else if(/\bcrispy\b/.test(q))f.taste='crispy';
 for(const meal of ['breakfast','lunch','dinner','snack'])if(q.includes(meal))f.mealType=meal;
 if(/\b(nashta|nasta|nashtyala)\b/.test(q))f.mealType='breakfast';
 for(const cuisine of ['South Indian','North Indian','Maharashtrian','Chinese','Italian','Indian'])if(q.includes(cuisine.toLowerCase())){f.cuisine=cuisine;break;}
 const known=['masala dosa','pav bhaji','pani puri','paneer','dosa','idli','poha','upma','khichdi','sandwich','pizza','burger','biryani','misal','vada pav','cake','jalebi','gulab jamun','momos','noodles','thali'];
 const named=known.find(n=>q.includes(n));if(named)f.dishName=named;
 // A short plain dish name is a request, not an invitation for the model to invent one.
 if(!named&&!Object.keys(f).length&&q&&!/\b(something|anything|surprise|food|khana|jevan)\b/.test(q)&&q.split(/\s+/).length<=5)f.dishName=q.replace(/^(i want|i want to eat|craving|please suggest)\s+/,'').trim();
 return f;
}
function sanitize(input={}){
 const f={};if(input.maxPrice!==undefined){const n=Number(input.maxPrice);if(!Number.isFinite(n)||n<.5||n>100000)throw Error('Choose a budget between ₹1 and ₹100,000.');f.maxPrice=n;}
 if(input.diet!==undefined){if(!diets.includes(input.diet))throw Error('Choose a valid diet.');f.diet=input.diet;}
 if(input.taste!==undefined){if(!tastes.includes(input.taste))throw Error('Choose a valid taste.');f.taste=input.taste;}
 for(const key of ['cuisine','mealType','dishName','dining'])if(typeof input[key]==='string'&&input[key].length<=160&&input[key]!=='any')f[key]=input[key].trim();
 return f;
}
module.exports={parse,sanitize,diets,tastes};
