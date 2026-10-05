const catalog = require('../data/brands/india-food-brands-2026-10-05.json');
const categories = [...new Set(catalog.brands.map(b => b.category))];
const models = Object.freeze({franchise_network:'Franchise network',master_or_regional_operator:'Master franchise / regional operator',company_operated:'Company-owned chain',confirmation_needed:'Franchise status needs confirmation',agreement_transition:'Agreement transition announced'});
module.exports = function registerBrandCatalog(app) {
  app.get('/api/food-brands', (req,res) => {
    res.set('Cache-Control','no-store');
    const {q='',category='',model=''} = req.query;
    if (typeof q !== 'string' || typeof category !== 'string' || typeof model !== 'string' || q.length > 100 || (category && !categories.includes(category)) || (model && !Object.hasOwn(models,model))) return res.status(400).json({success:false,error:'Enter valid brand filters.'});
    const search=q.trim().toLowerCase();
    const brands=catalog.brands.filter(b => (!category || b.category===category) && (!model || b.operatingModel===model) && (!search || [b.name,b.category,b.note].some(v=>v.toLowerCase().includes(search))));
    res.json({success:true,catalogId:catalog.catalogId,checkedOn:catalog.checkedOn,total:catalog.brands.length,count:brands.length,categories,models,brands,scope:catalog.scope});
  });
};
module.exports.count = catalog.brands.length;
