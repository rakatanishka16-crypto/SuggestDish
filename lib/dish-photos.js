// Only reviewed, exact-dish media may appear on recommendation cards.
// Entries require name, dietary evidence, attribution, and a safe source URL.
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
function safeURL(value) { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; } }
module.exports = function registerDishPhotos(app, { verifiedPhotos = [] } = {}) {
 app.get('/api/dish-photo', async (req, res) => {
  const dish = String(req.query.dish || '').trim();
  if (!dish || dish.length > 160) return res.status(400).json({success:false,error:'Provide a dish name up to 160 characters.'});
  res.set('Cache-Control', 'no-store');
  const diet = req.query.vegetarian === 'true' ? true : req.query.vegetarian === 'false' ? false : null;
  const match = diet === null ? null : verifiedPhotos.find(p => p.verified === true && p.vegetarian === diet && normalize(p.dishName) === normalize(dish) && p.ingredientEvidence && p.license && safeURL(p.url) && safeURL(p.sourceUrl));
  return res.json({success:true,photo:match ? {url:safeURL(match.url),sourceUrl:safeURL(match.sourceUrl),artist:String(match.artist || 'Restaurant-provided photo'),license:String(match.license),label:match.actualRestaurantDish === true ? 'Restaurant-provided dish photo.' : 'Verified matching dish illustration — restaurant presentation may differ.'} : null,reason:match ? undefined : 'No verified matching dish photo available.'});
 });
};
