'use strict';
const batch = require('../api/source-batches/mumbai-400001-2026-10-14.json');
function load() {
  const businesses = batch.businesses;
  if (businesses.length !== 7 || new Set(businesses.map(b => b.sourceKey)).size !== 7 || businesses.some(b => b.city !== 'Mumbai' || b.postal_code !== '400001' || !/400\s*001/.test(b.address))) throw Error('Invalid postal import scope');
  const menuFor = b => {
    const set = batch.menu_sets[b.outlet_menu_set_id];
    if (!set) return {menuScope: 'none', menuItems: []};
    if (set.brand !== b.brand || set.items.some(i => i.source_business_id !== b.sourceKey)) throw Error('Invalid outlet menu link');
    return {menuScope: set.kind, menuItems: set.items, menuNotice: b.service_note};
  };
  const menuItems = businesses.flatMap(b => menuFor(b).menuItems);
  if (menuItems.length !== 91 || new Set(menuItems.map(i => i.external_id)).size !== 91) throw Error('Incomplete postal menu evidence');
  return {businesses, menuItems, menuFor};
}
module.exports = {load, batch};
