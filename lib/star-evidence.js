function label(dish) {
  if (dish.starOrigin === 'published_menu') return dish.popularityBasis === 'bestseller'
    ? 'Restaurant-listed bestseller — based on its published menu, not independently audited order counts. '
    : 'Restaurant-listed signature dish — based on its published menu. ';
  if (dish.starConfirmed === true) return 'Approved owner star dish (popularity ' + (dish.popularityVerified === true ? 'independently checked' : 'owner-reported') + '). ';
  return 'Menu suggestion — star dish not yet confirmed. ';
}
module.exports={label};
