const batches = [require('../api/source-batches/mumbai-2026-10-04.json'),require('../api/source-batches/food-outlets-2026-10-05.json'),require('../api/source-batches/naturals-2026-10-05.json')];
const batch = {batch_id:batches.map(b=>b.batch_id).join('+'),retrieved_on:batches.map(b=>b.retrieved_on).sort().at(-1),businesses:batches.flatMap(b=>b.businesses),menu_items:batches.flatMap(b=>b.menu_items),coverage:'Partial official-source coverage. Brand menus and source map pins do not establish current branch availability, licence verification or travel distance.'};
const profiles = new Map(batch.businesses.map(b=>[b.sourceKey,b]));
const audit = require('../api/source-batches/mumbai-research-audit.json');
const coverage = Object.freeze({batchId:batch.batch_id,checkedOn:batch.retrieved_on,completeCityCensus:false,businessProfiles:batch.businesses.length,menuEntries:batch.menu_items.length,publishedPrices:batch.menu_items.filter(m=>Number.isFinite(m.price_inr)).length,profilesWithCoordinates:batch.businesses.filter(b=>Number.isFinite(b.latitude)&&Number.isFinite(b.longitude)).length,sourceBatches:batches.map(b=>({id:b.batch_id,checkedOn:b.retrieved_on})),cities:batch.businesses.reduce((counts,b)=>(counts[b.city]=(counts[b.city]||0)+1,counts),{}),menuBrands:[...new Set(batch.menu_items.map(m=>m.brand))],researchLeadsChecked:audit.leads.length,researchLeadsPending:audit.leads.filter(l=>l.status!=='corroborated_official_profile').length,licencesVerified:0,notice:batch.coverage,platforms:[{name:'Official business websites and menus',status:'Published with source links and check dates'},{name:'OpenStreetMap via Geofabrik',status:'Existing map directory; menus and operations are not implied'},{name:'Reddit',status:'Discovery leads only; no reviews, ratings or posts republished'},{name:'Instagram',status:'No bulk dataset imported; business-linked pages used only where accessible'},{name:'Google Maps, Zomato, Swiggy, Justdial',status:'No bulk dataset imported from these platforms'},{name:'Maharashtra FDA and FSSAI FoSCoS',status:'Reference sources checked; individual licence status remains unverified'}]});
const listingRows = batch.businesses.map(b=>({id:b.sourceKey,name:b.name,category:b.category,address:b.address,city:b.city,sourceUrl:b.source_urls[0],reviewStatus:'source_observed',restaurantId:null,existingBusinessId:b.existingBusinessId || null,latitude:b.latitude,longitude:b.longitude}));
module.exports = function register(app) {
  require('./brand-catalog')(app);
  app.get('/api/data-coverage', (req,res) => {
    res.set('Cache-Control','no-store');
    res.json({success:true,...coverage});
  });
  app.get('/api/business-source', (req,res) => {
    res.set('Cache-Control','no-store');
    const id = String(req.query.businessId || '');
    if (!/^official:sd-(?:mumbai|food)-[a-f0-9]{20}$/.test(id)) return res.status(400).json({success:false,error:'Select a source business.'});
    const business = profiles.get(id);
    if (!business) return res.status(404).json({success:false,error:'Source business not found.'});
    res.json({success:true,business,menuItems:batch.menu_items.filter(m=>m.brand===business.brand && (!m.menu_cities || m.menu_cities.includes(business.city))),notice:'Official-source observations, not owner verification. Brand menus do not confirm availability at this branch. Confirm prices, hours and dietary preparation with the business.'});
  });
};
module.exports.listingRows = listingRows;
