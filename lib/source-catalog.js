const sudama = require('./mumbai-sudama-import-scope');
const postalExpansion = require('./mumbai-postal-expansion');
const postalFollowup = require('./mumbai-postal-followup');
const postal = require('./mumbai-postal-import-scope');
const chains = require('./chain-source-catalog');
const openFood=require('./open-food-data');
const batches = [JSON.parse(require('node:zlib').gunzipSync(require('node:fs').readFileSync(require('node:path').join(__dirname,'../api/source-batches/chhatrapati-sambhajinagar-open-data-2026-10-12.json.gz'))).toString('utf8')),require('../api/source-batches/jalna-district-open-data-2026-10-10.json'),require('../api/source-batches/mumbai-2026-10-04.json'),require('../api/source-batches/food-outlets-2026-10-05.json'),require('../api/source-batches/naturals-2026-10-05.json'),require('../api/source-batches/kanjurmarg-cheftoon-2026-10-07.json'),require('../api/source-batches/kanjurmarg-simbly-dakshin-2026-10-07.json'),require('../api/source-batches/kanjurmarg-aagri-katta-2026-10-07.json'),require('../api/source-batches/mumbai-local-outlets-2026-10-07.json'),require('../api/source-batches/mumbai-bandra-public-sources-2026-10-07.json'),require('../api/source-batches/mumbai-pizza-by-the-bay-2026-10-07.json'),require('../api/source-batches/mumbai-dawat-ayubs-public-sources-2026-10-07.json'),require('../api/source-batches/mumbai-2026-10-07-research-completion.json'),require('../api/source-batches/mumbai-2026-10-07-pending-leads-final-pass.json'),require('../api/source-batches/mumbai-2026-10-07-safe-followup.json'),require('../api/source-batches/mumbai-dish-observations-2026-10-07.json'),require('../api/source-batches/mumbai-baglami-seasonal-dishes-2026-10-07.json'),require('../api/source-batches/mumbai-dadar-food-data-2026-10-07.json'),require('../api/source-batches/mumbai-dadar-followup-public-sources-2026-10-07.json'),require('../api/source-batches/mumbai-dadar-public-sources-followup-2026-10-07.json')];
const octoberMenus = require('./mumbai-oct23-menu-scope');
const jalnaCity = require('../api/source-batches/jalna-city-government-official-2026-10-23.json');
batches.push(sudama.batch, jalnaCity, {...octoberMenus.batch, businesses:[], menu_items:[]});
batches.unshift(JSON.parse(require('node:zlib').gunzipSync(require('node:fs').readFileSync(require('node:path').join(__dirname,'../api/source-batches/chhatrapati-sambhajinagar-deferred-2026-10-12.json.gz'))).toString('utf8')));
const acquisition = require('./acquisition-source-catalog');
const sourceBusinesses=octoberMenus.enrichProfiles(acquisition.apply([...batches.flatMap(b=>b.businesses || []),...chains.businesses,...openFood.businesses])).filter(b=>!/(^|[^a-z])tejal['’]?s?\s+kitchen([^a-z]|$)/i.test(b.name || ''));
const postalKeys = new Set(postal.batch.businesses.map(b=>b.sourceKey));
const followupKeys = new Set(postalFollowup.batch.businesses.map(b=>b.sourceKey));
const expansionKeys = new Set(postalExpansion.batch.businesses.map(b=>b.sourceKey));
const priorBusinesses = [...sourceBusinesses.filter(b=>!postalKeys.has(b.sourceKey)&&!followupKeys.has(b.sourceKey)),...postal.batch.businesses.filter(b=>!followupKeys.has(b.sourceKey)),...postalFollowup.batch.businesses];
const mergedBusinesses = [...priorBusinesses.filter(b=>!expansionKeys.has(b.sourceKey)),...postalExpansion.batch.businesses];
const batch = {batch_id:[postalExpansion.batch.batch_id,postalFollowup.batch.batch_id,postal.batch.batch_id,...batches.map(b=>b.batch_id),openFood.summary.batchId,chains.batchId,...acquisition.coverage().recorded_batches].join('+'),retrieved_on:[...batches.map(b=>b.retrieved_on),chains.checkedOn,openFood.summary.batchId.slice(-10)].sort().at(-1),businesses:mergedBusinesses,menu_items:octoberMenus.mergeItems([...batches.flatMap(b=>b.menu_items || []),...chains.menuItems,...acquisition.menuItems,...postal.load().menuItems,...postalFollowup.load().menuItems,...postalExpansion.load().menuItems]),coverage:'Partial published-source coverage. Brand menus and source map pins do not establish current branch availability, licence verification or travel distance.'};
const profiles = new Map(batch.businesses.map(b=>[b.sourceKey,b]));
const audit = require('../api/source-batches/mumbai-research-audit.json');
const coverage = Object.freeze({batchId:batch.batch_id,checkedOn:batch.retrieved_on,completeCityCensus:false,acquisition:acquisition.coverage(),openFoodData:openFood.summary,businessProfiles:batch.businesses.length,menuEntries:batch.menu_items.length,publishedPrices:batch.menu_items.filter(m=>Number.isFinite(m.price_inr)).length,profilesWithCoordinates:batch.businesses.filter(b=>Number.isFinite(b.latitude)&&Number.isFinite(b.longitude)).length,sourceBatches:[...batches.map(b=>({id:b.batch_id,checkedOn:b.retrieved_on})),{id:chains.batchId,checkedOn:chains.checkedOn},{id:openFood.summary.batchId,checkedOn:'2026-10-09'},...acquisition.coverage().recorded_batches.map(id=>({id,checkedOn:acquisition.coverage().last_verified_date}))],cities:batch.businesses.reduce((counts,b)=>(counts[b.city]=(counts[b.city]||0)+1,counts),{}),chainOutlets:chains.businesses.length,chainBrandCounts:chains.researchScope.brand_counts,chainResearchScope:chains.researchScope.batches,outletsWithSourceMenus:chains.businesses.filter(b=>b.outlet_menu_set_id).length,outletsWithReferenceMenus:chains.businesses.filter(b=>b.reference_menu_set_id).length,menuBrands:[...new Set(batch.menu_items.map(m=>m.brand))],researchLeadsChecked:audit.leads.length,researchLeadsPending:audit.leads.filter(l=>l.status!=='corroborated_official_profile').length,licencesVerified:0,notice:batch.coverage,platforms:[{name:'Official business websites and menus',status:'Published with source links and check dates'},{name:'OpenStreetMap via Geofabrik',status:'Existing map directory; menus and operations are not implied'},{name:'Reddit',status:'Discovery leads only; no reviews, ratings or posts republished'},{name:'Instagram',status:'No bulk dataset imported; business-linked pages used only where accessible'},{name:'Google Maps, Zomato, Swiggy, Justdial',status:'Dated public Zomato, Swiggy and directory observations; no bulk dataset imported from these platforms'},{name:'Maharashtra FDA and FSSAI FoSCoS',status:'Reference sources checked; individual licence status remains unverified'}]});
const listingRows = batch.businesses.map(b=>({id:b.sourceKey,name:b.name,brand:b.brand,category:b.category,address:b.address,city:b.city,sourceUrl:b.source_urls[0],reviewStatus:'source_observed',restaurantId:null,existingBusinessId:b.existingBusinessId || null,latitude:b.latitude,longitude:b.longitude,sourceLicense:b.source_license || null,attribution:b.attribution || null,coordinateType:b.coordinate_type || null}));
const registerDishOutlets=require('./dish-outlets');
function menuFor(business) {
 const expanded=octoberMenus.menuFor(business);if(expanded)return expanded;
 if(business.sourceKey===sudama.sourceKey)return sudama.load().menuFor(business);
 if(expansionKeys.has(business.sourceKey))return postalExpansion.load().menuFor(business);
 if(followupKeys.has(business.sourceKey))return postalFollowup.load().menuFor(business);
 if(postalKeys.has(business.sourceKey))return postal.load().menuFor(business);
 if(business.source_types?.includes('openstreetmap'))return {menuScope:'none',menuItems:[],menuNotice:'No outlet menu observed. Wikidata vocabulary does not establish dishes here.'};
 const exactMenu=batch.menu_items.filter(m=>m.source_business_id===business.sourceKey);
 if(exactMenu.length)return {menuScope:'outlet_observed',menuItems:exactMenu,menuNotice:'Items and prices were observed on this outlet’s official menu. Dietary type remains unknown unless explicitly labelled by the source.'};
 const observed=acquisition.menuFor(business);
 const legacy=chains.menuFor(business) || {menuScope:'brand_reference',menuItems:batch.menu_items.filter(m=>m.brand===business.brand && (!m.menu_cities || m.menu_cities.includes(business.city)) && !m.acquisition_dish_id)};
 if(!observed)return legacy;
 if(observed.menuScope==='outlet_page' && legacy.menuScope==='outlet_page'){
  const newest=items=>items.reduce((date,item)=>item.retrieved_on>date?item.retrieved_on:date,'');
  if(newest(legacy.menuItems)>newest(observed.menuItems))return legacy;
 }
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
  app.get('/api/mumbai-acquisition-20261023', (req,res) => {
    res.set('Cache-Control','no-store');
    res.json({success:true,batchId:octoberMenus.scope,...octoberMenus.batch.research_summary,heldConflicts:octoberMenus.batch.held_conflicts,notice:octoberMenus.batch.notice});
  });
  app.get('/api/jalna-acquisition', (req,res) => {
    res.set('Cache-Control','no-store');
    res.json({success:true,...jalnaCity});
  });
  app.get('/api/postal-coverage/400001', (req,res) => {
    res.set('Cache-Control','no-store');
    res.json({success:true,...JSON.parse(require('node:zlib').gunzipSync(require('node:fs').readFileSync(require('node:path').join(__dirname,'../api/source-batches/mumbai-400001-coverage-2026-10-14.json.gz'))).toString('utf8'))});
  });
  openFood.register(app);
  app.get('/api/open-food-data/jalna-export',(req,res)=>{res.set('Cache-Control','no-store');res.set('Content-Disposition','attachment; filename="suggestdish-jalna-open-data-2026-10-10.json"');res.json(batches[2]);});
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
    if (!/^[A-Za-z0-9:_-]{1,120}$/.test(id)) return res.status(400).json({success:false,error:'Select a source business.'});
    const business = profiles.get(id);
    if (!business) return res.status(404).json({success:false,error:'Source business not found.'});
    res.json({success:true,business,...menuFor(business),notice:'Published-source observations, not owner verification. Brand menus do not confirm availability at this branch. Confirm prices, hours and dietary preparation with the business.'});
  });
};
module.exports.listingRows = listingRows;

module.exports.coverage = coverage;
// Internal import input; no new public data endpoint.
module.exports.importData = {businesses:batch.businesses,menuItems:batch.menu_items,menuFor,acquisition:acquisition.rawData};

