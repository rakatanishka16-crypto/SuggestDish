const chains = require('./chain-source-catalog');
const batches = [require('../api/source-batches/mumbai-2026-10-04.json'),require('../api/source-batches/food-outlets-2026-10-05.json'),require('../api/source-batches/naturals-2026-10-05.json'),require('../api/source-batches/kanjurmarg-cheftoon-2026-10-07.json'),require('../api/source-batches/kanjurmarg-simbly-dakshin-2026-10-07.json'),require('../api/source-batches/kanjurmarg-aagri-katta-2026-10-07.json'),require('../api/source-batches/mumbai-local-outlets-2026-10-07.json'),require('../api/source-batches/mumbai-bandra-public-sources-2026-10-07.json'),require('../api/source-batches/mumbai-pizza-by-the-bay-2026-10-07.json'),require('../api/source-batches/mumbai-dawat-ayubs-public-sources-2026-10-07.json'),require('../api/source-batches/mumbai-2026-10-07-research-completion.json'),require('../api/source-batches/mumbai-2026-10-07-pending-leads-final-pass.json'),require('../api/source-batches/mumbai-2026-10-07-safe-followup.json'),require('../api/source-batches/mumbai-dish-observations-2026-10-07.json'),require('../api/source-batches/mumbai-baglami-seasonal-dishes-2026-10-07.json'),require('../api/source-batches/mumbai-dadar-food-data-2026-10-07.json')];
const acquisition = require('./acquisition-source-catalog');
const sourceBusinesses=acquisition.apply([...batches.flatMap(b=>b.businesses),...chains.businesses]);
const batch = {batch_id:[...batches.map(b=>b.batch_id),chains.batchId,...acquisition.coverage().recorded_batches].join('+'),retrieved_on:[...batches.map(b=>b.retrieved_on),chains.checkedOn].sort().at(-1),businesses:sourceBusinesses,menu_items:[...batches.flatMap(b=>b.menu_items),...chains.menuItems,...acquisition.menuItems],coverage:'Partial published-source coverage. Brand menus and source map pins do not establish current branch availability, licence verification or travel distance.'};
const profiles = new Map(batch.businesses.map(b=>[b.sourceKey,b]));
const audit = require('../api/source-batches/mumbai-research-audit.json');
const coverage = Object.freeze({batchId:batch.batch_id,checkedOn:batch.retrieved_on,completeCityCensus:false,acquisition:acquisition.coverage(),businessProfiles:batch.businesses.length,menuEntries:batch.menu_items.length,publishedPrices:batch.menu_items.filter(m=>Number.isFinite(m.price_inr)).length,profilesWithCoordinates:batch.businesses.filter(b=>Number.isFinite(b.latitude)&&Number.isFinite(b.longitude)).length,sourceBatches:[...batches.map(b=>({id:b.batch_id,checkedOn:b.retrieved_on})),{id:chains.batchId,checkedOn:chains.checkedOn},...acquisition.coverage().recorded_batches.map(id=>({id,checkedOn:acquisition.coverage().last_verified_date}))],cities:batch.businesses.reduce((counts,b)=>(counts[b.city]=(counts[b.city]||0)+1,counts),{}),chainOutlets:chains.businesses.length,chainBrandCounts:chains.researchScope.brand_counts,chainResearchScope:chains.researchScope.batches,outletsWithSourceMenus:chains.businesses.filter(b=>b.outlet_menu_set_id).length,outletsWithReferenceMenus:chains.businesses.filter(b=>b.reference_menu_set_id).length,menuBrands:[...new Set(batch.menu_items.map(m=>m.brand))],researchLeadsChecked:audit.leads.length,researchLeadsPending:audit.leads.filter(l=>l.status!=='corroborated_official_profile').length,licencesVerified:0,notice:batch.coverage,platforms:[{name:'Official business websites and menus',status:'Published with source links and check dates'},{name:'OpenStreetMap via Geofabrik',status:'Existing map directory; menus and operations are not implied'},{name:'Reddit',status:'Discovery leads only; no reviews, ratings or posts republished'},{name:'Instagram',status:'No bulk dataset imported; business-linked pages used only where accessible'},{name:'Google Maps, Zomato, Swiggy, Justdial',status:'Dated public Zomato, Swiggy and directory observations; no bulk dataset imported from these platforms'},{name:'Maharashtra FDA and FSSAI FoSCoS',status:'Reference sources checked; individual licence status remains unverified'}]});
const listingRows = batch.businesses.map(b=>({id:b.sourceKey,name:b.name,brand:b.brand,category:b.category,address:b.address,city:b.city,sourceUrl:b.source_urls[0],reviewStatus:'source_observed',restaurantId:null,existingBusinessId:b.existingBusinessId || null,latitude:b.latitude,longitude:b.longitude}));
const registerDishOutlets=require('./dish-outlets');
function menuFor(business) {
 const observed=acquisition.menuFor(business);
 const legacy=chains.menuFor(business) || {menuScope:'brand_reference',menuItems:batch.menu_items.filter(m=>m.brand===business.brand && (!m.menu_cities || m.menu_cities.includes(business.city)) && !m.acquisition_dish_id)};
 if(!observed)return legacy;
 // An absent homepage mention does not withdraw an earlier documented dish.
 // Preserve reference variants with their own source dates, never mark them stocked.
 if(observed.menuScope==='documented_references' || observed.menuScope==='brand_reference'){
  const names=new Set(observed.menuItems.map(m=>m.name+'|'+(m.portion || '')));
  return {...observed,menuItems:[...legacy.menuItems.filter(m=>!names.has(m.name+'|'+(m.portion || ''))).map(m=>({...m,source_business_id:null})),...observed.menuItems]};
 }
 return observed;
}
const dishData={businesses:batch.businesses,menu_items:batch.menu_items,menuFor};
const dishCatalog=registerDishOutlets.buildCatalog(dishData);
module.exports = function register(app) {
  app.get('/api/import-progress', (req,res) => {
    res.set('Cache-Control','no-store');
    res.json({success:true,...require('../api/source-batches/state-import-progress.json')});
  });
  acquisition.register(app);
  require('./brand-catalog')(app);
  const dishCoverage=registerDishOutlets(app,dishData,dishCatalog);
  app.get('/api/data-coverage', (req,res) => {
    res.set('Cache-Control','no-store');
    res.json({success:true,...coverage,dishCoverage});
  });
  app.get('/api/business-source', (req,res) => {
    res.set('Cache-Control','no-store');
    const id = String(req.query.businessId || '');
    if (id.length > 120) return res.status(400).json({success:false,error:'Select a source business.'});
    const business = profiles.get(id);
    if (!business) return res.status(404).json({success:false,error:'Source business not found.'});
    res.json({success:true,business,...menuFor(business),notice:'Published-source observations, not owner verification. Brand menus do not confirm availability at this branch. Confirm prices, hours and dietary preparation with the business.'});
  });
};
module.exports.listingRows = listingRows;

module.exports.coverage = coverage;
