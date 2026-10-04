const batch = require('../api/source-batches/mumbai-2026-10-04.json');
const profiles = new Map(batch.businesses.map(b=>[b.sourceKey,b]));
const listingRows = batch.businesses.map(b=>({id:b.sourceKey,name:b.name,category:b.category,address:b.address,city:b.city,sourceUrl:b.source_urls[0],reviewStatus:'source_observed',restaurantId:null}));
module.exports = function register(app) {
  app.get('/api/business-source', (req,res) => {
    res.set('Cache-Control','no-store');
    const id = String(req.query.businessId || '');
    if (!/^official:sd-mumbai-[a-f0-9]{20}$/.test(id)) return res.status(400).json({success:false,error:'Select a source business.'});
    const business = profiles.get(id);
    if (!business) return res.status(404).json({success:false,error:'Source business not found.'});
    res.json({success:true,business,menuItems:batch.menu_items.filter(m=>m.brand===business.brand),notice:'Official-source observations, not owner verification. Brand menus do not confirm availability at this branch. Confirm prices, hours and dietary preparation with the business.'});
  });
};
module.exports.listingRows = listingRows;
