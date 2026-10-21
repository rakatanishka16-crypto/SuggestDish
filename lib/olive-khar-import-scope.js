'use strict';
// Reviewed exact-branch menu pages only. Do not promote other observed menus.
const sourceKey='listing:sd-mumbai-olive-bar-kitchen-khar-west-20261007';
const itemIds=new Set([
 'sd-menu-olive-khar-burrata-20261015','sd-menu-olive-khar-cacio-e-pepe-pave-20261015',
 'sd-menu-olive-khar-zaatar-garlic-bread-20261015','sd-menu-olive-khar-pierogis-20261015',
 'sd-menu-olive-khar-quinoa-cakes-20261015','sd-menu-olive-khar-olive-mezze-platter-20261015',
 'sd-menu-olive-khar-fried-chicken-20261015','sd-menu-olive-khar-prawns-ajillo-20261015',
 'sd-menu-olive-khar-spiced-calamari-20261015','sd-menu-olive-khar-chorizo-hash-20261021',
 'sd-menu-olive-khar-chorizo-pepperoni-pull-aparts-20261021',
 'sd-menu-olive-khar-linguine-aglio-olio-peperoncino-20261021','sd-menu-olive-khar-ricotta-gnocchi-20261021',
 'sd-menu-olive-khar-spicy-rigatoni-20261021','sd-menu-olive-khar-mushroom-risotto-20261021','sd-menu-olive-khar-rotolo-20261021'
 ,'sd-menu-olive-khar-brunch-cottage-cheese-espetada-20261021','sd-menu-olive-khar-brunch-mushroom-espetada-20261021'
 ,'sd-menu-olive-khar-brunch-river-sole-espetada-20261021','sd-menu-olive-khar-brunch-chicken-espetada-20261021'
 ,'sd-menu-olive-khar-brunch-prawns-espetada-20261021','sd-menu-olive-khar-brunch-brick-chicken-20261021'
 ,'sd-menu-olive-khar-brunch-salmon-20261021','sd-menu-olive-khar-brunch-braised-lamb-shank-20261021'
 ,'sd-menu-olive-khar-brunch-sorbet-20261021','sd-menu-olive-khar-brunch-kataif-french-toast-20261021'
 ,'sd-menu-olive-khar-brunch-olive-tiramisu-20261021','sd-menu-olive-khar-brunch-chocolate-fondant-20261021'
]);
function load(catalog=require('./source-catalog').importData){
 const businesses=catalog.businesses.filter(b=>b.sourceKey===sourceKey);
 if(businesses.length!==1||businesses[0].city!=='Mumbai'||!businesses[0].address.includes('14 Union Park'))throw Error('Missing exact Olive Khar outlet');
 const menu=catalog.menuFor(businesses[0]);
 if(!['outlet_observed','outlet_page'].includes(menu?.menuScope))throw Error('Missing observed branch menu');
 const menuItems=menu.menuItems.filter(m=>itemIds.has(m.external_id));
 if(menuItems.length!==28||new Set(menuItems.map(m=>m.external_id)).size!==28)throw Error('Incomplete reviewed Olive Khar menu');
 for(const m of menuItems){
  const url=new URL(m.source_url);
  if(m.source_business_id!==sourceKey||m.branch_availability!=='confirmed_on_outlet_page'||m.recommendation_eligible!==true||m.publish_ready!==true||typeof m.is_veg!=='boolean'||!m.veg_evidence||url.protocol!=='https:'||!['olivebarandkitchen.com','www.olivebarandkitchen.com'].includes(url.hostname)||!/^\/menus\/Olive_Mumbai\/(?:all_day\/[89]|brunch\/4)\.jpg$/.test(url.pathname))throw Error('Unreviewed Olive Khar menu evidence');
 }
 return {businesses,menuItems,menuFor:b=>{if(b.sourceKey!==sourceKey)throw Error('Unrelated outlet');return {menuScope:'outlet_page',menuItems};}};
}
module.exports={load,sourceKey};
