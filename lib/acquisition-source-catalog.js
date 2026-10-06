const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const data=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches/mumbai-acquisition-0001-0002.json.gz'))).toString('utf8'));
const norm=value=>String(value || '').replace(/&amp;/g,'&').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
const addressIdentity=value=>norm(String(value || '').replace(/^\s*(?:shop|gala|unit)\s*(?:no\.?|number)?\s*/i,'').replace(/\bMaharashtra\b/gi,''));
const canonical=value=>{try{const u=new URL(value);return u.origin+u.pathname.replace(/\/$/,'');}catch{return null;}};
const minted=id=>'official:sd-food-'+crypto.createHash('sha256').update(id).digest('hex').slice(0,20);
const menuByProfile=new Map(),outletProfiles=new Map(),rawOutlets=new Map(data.outlets.map(o=>[o.outlet_id,o]));
const byBrand=new Map(data.businesses.map(b=>[b.business_id,b]));
const signals=new Map();for(const signal of data.dish_signals){if(!signals.has(signal.dish_id))signals.set(signal.dish_id,[]);signals.get(signal.dish_id).push(signal);}
const dishItem=d=>({external_id:d.dish_id,acquisition_dish_id:d.dish_id,brand:byBrand.get(d.business_id).brand_name,name:d.dish_name,menu_category:d.category,portion:d.portion || null,price_inr:d.price,is_veg:d.vegetarian,veg_evidence:d.evidence,source_url:d.source_url,price_scope:d.price_scope || 'Published menu observation; current fulfilment unconfirmed',price_min_inr:d.price_min ?? null,price_max_inr:d.price_max ?? null,order_note:d.price_min!=null ? 'Published variant range: ₹'+d.price_min+'–₹'+d.price_max+'. Exact portion price is unconfirmed.' : null,tax_included:d.tax_included ?? null,branch_availability:'not_confirmed',retrieved_on:d.last_verified_date,publish_ready:false,recommendation_eligible:false,verification_status:d.verification_status,data_conflict:d.data_conflict,field_evidence:d.field_evidence,signature_dish:d.signature_dish,best_seller:d.best_seller,dish_signals:signals.get(d.dish_id) || []});
const menuItems=data.dishes.map(dishItem),itemsByOutlet=new Map(),itemsByBrand=new Map();
for(let i=0;i<data.dishes.length;i++){const d=data.dishes[i],map=d.outlet_id ? itemsByOutlet : itemsByBrand,key=d.outlet_id || d.business_id;if(!map.has(key))map.set(key,[]);map.get(key).push(menuItems[i]);}
function readableHours(h){if(h==null)return null;if(typeof h==='string')return h;if(h.source_text)return h.source_text;if(h.source_start_time || h.source_end_time)return [h.source_start_time,h.source_end_time].filter(Boolean).join(' – ')+' (published station hours; days unconfirmed)';return JSON.stringify(h);}
const publication={matchedExistingProfiles:0,newProfiles:0,unresolvedMatches:[]};
function apply(existing){
 const result=existing.map(b=>({...b})),byKey=new Map(result.map(b=>[b.sourceKey,b]));
 for(const o of data.outlets){
  let match=byKey.get(o.suggestdish_existing_source_key);
  if(!match){
   const exact=result.filter(b=>norm(b.brand)===norm(o.brand_name)&&addressIdentity(b.address)===addressIdentity(o.full_address));
   const branchURL=canonical(o.source_url),distinctSource=data.outlets.filter(other=>canonical(other.source_url)===branchURL).length===1;
   const urlMatches=distinctSource ? result.filter(b=>norm(b.brand)===norm(o.brand_name)&&(b.source_urls || []).some(u=>canonical(u)===branchURL)) : [];
   const matches=exact.length ? exact : urlMatches;
   if(matches.length===1)match=matches[0];
   else if(matches.length>1){publication.unresolvedMatches.push(o.outlet_id);continue;}
  }
  const key=match?.sourceKey || minted(o.outlet_id);
  const item={...(match || {}),sourceKey:key,external_id:match?.external_id || key.slice('official:'.length),name:match?.name || o.outlet_name,brand:o.brand_name,address:o.full_address,city:o.city,state:o.state,district:o.district,locality:o.locality,pincode:o.pincode,latitude:o.latitude,longitude:o.longitude,phone:o.phone,opening_hours:readableHours(o.opening_hours),category:match?.category || (['bakery'].includes(byBrand.get(o.business_id).business_type) ? 'shop:bakery' : byBrand.get(o.business_id).business_type==='cafe' ? 'amenity:cafe' : 'amenity:restaurant'),business_type:byBrand.get(o.business_id).business_type,address_scope:o.brand_name==='Cheftoon' ? 'published_locality_and_map_point' : 'published_full_address',source_urls:[...new Set([...o.source_urls,...(match?.source_urls || [])])],source_types:[...new Set(data.sources.filter(s=>(o.source_ids || []).includes(s.source_id)).map(s=>s.source_type))],retrieved_on:o.last_verified_date,license_status:'not_checked',recommendation_eligible:false,publish_ready:false,directory_publish_ready:true,google_maps_url:o.google_maps_url,google_listing_status:o.google_maps_url ? 'business_link_published' : null,restaurant_rating:o.rating,rating_source_url:o.rating_source_url,review_count:o.review_count,operating_status:o.operating_status,currently_operating:o.currently_operating,possibly_closed:o.possibly_closed,verification_status:o.verification_status,verification_scope:o.verification_scope,data_conflict:o.data_conflict,field_evidence:o.field_evidence,acquisition_business_id:o.business_id,acquisition_outlet_id:o.outlet_id,social_profiles:data.social_profiles.filter(s=>s.business_id===o.business_id),service_note:'Source listing observed. Current operation, stock, exact prices and dietary preparation require confirmation.'};
  if(match){Object.assign(match,item);publication.matchedExistingProfiles++;}else{result.push(item);byKey.set(key,item);publication.newProfiles++;}
  outletProfiles.set(o.outlet_id,key);
  const items=itemsByOutlet.get(o.outlet_id) || [],references=itemsByBrand.get(o.business_id) || [];
  if(items.length){const scoped=['outlet_page_observed','official_product_listing_observed'].includes(o.menu_coverage);menuByProfile.set(key,{menuScope:scoped ? 'outlet_page' : 'documented_references',menuItems:items.map(m=>({...m,source_business_id:scoped ? key : null})),menuNotice:scoped ? 'Dishes observed on this outlet’s public menu/storefront. Missing and conflicting dietary fields remain unknown. Prices and stock require confirmation.' : 'Documented promotional or testimonial dish references. These mentions do not establish a current menu or availability.'});}
  else if(references.length)menuByProfile.set(key,{menuScope:'brand_reference',menuItems:references.map(m=>({...m,source_business_id:null})),menuNotice:'Official brand-level dish references and owner-designated bestseller labels. No outlet-specific menu, sales ranking or availability is confirmed.'});
 }
 return result;
}
const coverage=()=>({...data.summary,publication:{...publication,unresolvedMatches:[...publication.unresolvedMatches]},verificationScope:'Publicly listed identity and published address',production_imported:undefined,productionImportedToNeon:false,sourceCatalogPublished:true,neonImport:false,coverageComplete:false});
function register(app){
 app.get('/api/acquisition-progress',(req,res)=>{res.set('Cache-Control','no-store');res.json({success:true,...coverage()});});
}
module.exports={apply,menuFor:b=>menuByProfile.get(b.sourceKey) || null,menuItems,coverage,register,outletProfiles,rawOutlets};
