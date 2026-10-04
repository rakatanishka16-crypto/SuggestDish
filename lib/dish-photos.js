const types = ['pav bhaji','vada pav','pani puri','paneer tikka','paneer masala','butter chicken','gulab jamun','masala dosa','fried rice','ice cream','chocolate cake','paniyaram','uttapam','khichdi','khichadi','biryani','paratha','sandwich','noodles','manchurian','momos','samosa','kachori','dhokla','jalebi','rasgulla','brownie','waffle','pancake','pizza','burger','pasta','poha','idli','dosa','upma','chaat','thepla','modak','spud','fries','dal','thali','cake'];
const clean = value => String(value || '').replace(/<[^>]*>/g,'').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim().slice(0,250);
const safe = (value,host) => {try{const u=new URL(value);return u.protocol==='https:' && u.hostname===host && !u.username && !u.password ? u.href:null;}catch{return null;}};
const typeFor = name => {const n=String(name).toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ');return types.find(t=>(' '+n+' ').includes(' '+t+' ')) || null;};
module.exports=function(app,{fetchImpl=fetch,now=Date.now}={}){
 const cache=new Map(),pending=new Map();
 async function lookup(type){
  const q=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:type+' filetype:bitmap',gsrnamespace:'6',gsrlimit:'5',prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'640'});
  const response=await fetchImpl('https://commons.wikimedia.org/w/api.php?'+q,{signal:AbortSignal.timeout(6000),headers:{'User-Agent':'SuggestDish/1.0 (https://www.suggestdish.com; representative dish photos)'}});
  if(!response.ok)throw new Error('Photo source unavailable');
  const data=await response.json();
  for(const page of Object.values(data.query?.pages || {}).sort((a,b)=>a.index-b.index)){
   if(!String(page.title).toLowerCase().includes(type))continue;
   const info=page.imageinfo?.[0],m=info?.extmetadata || {};
   const license=clean(m.LicenseShortName?.value);
   if(!/^(CC BY(?:-SA)? [\d.]+|CC0|Public domain)$/i.test(license) || m.Restrictions?.value || !/^image\/(jpeg|png|webp)$/.test(info?.mime || ''))continue;
   const url=(safe(info.thumburl,'thumb.wikimedia.org') || safe(info.thumburl,'upload.wikimedia.org') || safe(info.url,'upload.wikimedia.org')),sourceUrl=safe(info.descriptionurl,'commons.wikimedia.org');
   if(url && sourceUrl)return {url,sourceUrl,artist:clean(m.Artist?.value) || 'See source for author',license,label:'Representative '+type+' photo — restaurant presentation may differ.'};
  }
  return null;
 }
 app.get('/api/dish-photo',async(req,res)=>{
  const dish=String(req.query.dish || '').trim();
  if(!dish || dish.length>160)return res.status(400).json({success:false,error:'Provide a dish name up to 160 characters.'});
  // Public search images have no verified ingredient/diet evidence.
  // Fail closed for vegetarian requests and older clients that omit the diet.
  if (String(req.query.vegetarian) !== 'false') {
   res.set('Cache-Control','no-store');
   return res.json({success:true,photo:null,reason:'No verified vegetarian photo available.'});
  }
  const type=typeFor(dish);res.set('Cache-Control','public, max-age=3600');
  if(!type)return res.json({success:true,photo:null});
  try{
   let entry=cache.get(type);
   if(!entry || entry.expires<now()){
    if(!pending.has(type))pending.set(type,lookup(type).finally(()=>pending.delete(type)));
    const photo=await pending.get(type);entry={photo,expires:now()+3600000};cache.set(type,entry);
   }
   return res.json({success:true,photo:entry.photo});
  }catch{res.set('Cache-Control','no-store');return res.json({success:true,photo:null});}
 });
};
module.exports.typeFor=typeFor;
