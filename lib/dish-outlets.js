const shortlist=require('../api/source-batches/top-100-foods-2026-10-05.json');

function buildCatalog({businesses,menu_items,menuFor}) {
 const byId=new Map(menu_items.map(m=>[m.external_id,m]));
 const rows=shortlist.dishes.map(dish=>{
  const ids=new Set(dish.menu_item_ids);
  const items=dish.menu_item_ids.map(id=>byId.get(id));
  if(items.some(item=>!item))throw new Error('Missing reviewed dish menu evidence');
  const brands=new Set(items.map(m=>m.brand));
  const outlets=[];
  for(const business of businesses) {
   if(!brands.has(business.brand))continue;
   const menu=menuFor(business);
   // A refreshed branch snapshot has new evidence IDs. Keep a reviewed dish
   // linked only when its exact brand, product name and portion still match.
   const matches=menu.menuItems.filter(m=>ids.has(m.external_id) || items.some(old=>
    old.brand===m.brand && old.name===m.name && (old.portion || null)===(m.portion || null) &&
    (old.is_veg==null || m.is_veg==null || old.is_veg===m.is_veg)));
   if(!matches.length)continue;
   outlets.push({id:business.sourceKey,name:business.name,brand:business.brand,city:business.city,state:business.state,address:business.address,latitude:business.latitude,longitude:business.longitude,menuScope:menu.menuScope,sourceUrl:business.source_urls[0],sourceTypes:business.source_types,menuItems:matches,availabilityConfirmed:false});
  }
  return {...dish,outlets};
 });
 const summary=rows.map(({outlets,menu_item_ids,...dish})=>({...dish,outletCount:outlets.length,outletMenuCount:outlets.filter(o=>o.menuScope==='outlet_page').length,referenceOutletCount:outlets.filter(o=>o.menuScope==='brand_reference').length,brands:[...new Set(outlets.map(o=>o.brand))]}));
 return {rows,summary,coverage:{dishes:rows.length,dishesWithMenuMatches:rows.filter(r=>r.outlets.length).length,pendingDishes:rows.filter(r=>!r.outlets.length).map(r=>r.name),measuredRanking:false,availabilityConfirmed:false}};
}
function register(app,data,catalog=buildCatalog(data)) {
 app.get('/api/dish-outlets',(req,res)=>{
  res.set('Cache-Control','no-store');
  const id=String(req.query.dishId || '');
  if(!id)return res.json({success:true,checkedOn:shortlist.checked_on,notice:shortlist.notice,coverage:catalog.coverage,dishes:catalog.summary});
  if(!/^\d{1,3}$/.test(id))return res.status(400).json({success:false,error:'Select a dish from the shortlist.'});
  const row=catalog.rows.find(r=>r.id===Number(id));
  if(!row)return res.status(404).json({success:false,error:'Dish not found.'});
  const city=String(req.query.city || '').trim();
  if(city.length>100)return res.status(400).json({success:false,error:'City must be at most 100 characters.'});
  const offset=Number(req.query.offset || 0),limit=Number(req.query.limit || 20);
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000||!Number.isSafeInteger(limit)||limit<1||limit>50)return res.status(400).json({success:false,error:'Invalid page.'});
  const outlets=row.outlets.filter(o=>!city||o.city?.toLowerCase()===city.toLowerCase());
  res.json({success:true,dish:catalog.summary.find(d=>d.id===row.id),checkedOn:shortlist.checked_on,notice:shortlist.notice,city,total:outlets.length,offset,hasMore:offset+limit<outlets.length,outlets:outlets.slice(offset,offset+limit)});
 });
 return catalog.coverage;
}
module.exports=register;
module.exports.buildCatalog=buildCatalog;
