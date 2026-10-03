const crypto = require('node:crypto');
const PROFILE_HOSTS = ['google.com', 'google.co.in', 'maps.app.goo.gl', 'goo.gl', 'zomato.com'];
function profileUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || !PROFILE_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h))) return null;
    return u.href;
  } catch { return null; }
}
function validate(body) {
  const b = body && typeof body === 'object' ? body : {};
  const limits = { businessName: 160, category: 40, city: 100, address: 500, contactName: 100, email: 254, phone: 20, profileUrl: 2000, menuUrl: 2000, dishName: 160 };
  const data = {};
  for (const [key, max] of Object.entries(limits)) {
    if (b[key] !== undefined && typeof b[key] !== 'string') throw new Error('Please enter valid business details.');
    data[key] = (b[key] || '').trim();
    if (data[key].length > max) throw new Error('One of your entries is too long.');
  }
  for (const key of ['businessName', 'category', 'city', 'address', 'contactName', 'email', 'phone', 'profileUrl', 'dishName']) if (!data[key]) throw new Error('Complete all required fields.');
  if (!['Restaurant', 'Cafe', 'Hotel', 'Bakery', 'Catering', 'Other'].includes(data.category)) throw new Error('Choose a business category.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !/^\+?[\d\s()-]{10,20}$/.test(data.phone)) throw new Error('Enter a valid email and phone number.');
  data.profileUrl = profileUrl(data.profileUrl);
  if (!data.profileUrl) throw new Error('Add an HTTPS Google Maps or Zomato profile link.');
  if (data.menuUrl) {
    try { const u = new URL(data.menuUrl); if (u.protocol !== 'https:' || u.username || u.password) throw 0; data.menuUrl = u.href; } catch { throw new Error('Enter a valid HTTPS menu link.'); }
  }
  data.dishPrice = Number(b.dishPrice);
  if (!Number.isFinite(data.dishPrice) || data.dishPrice <= 0 || data.dishPrice > 100000) throw new Error('Enter a valid dish price in rupees.');
  if (!['vegetarian', 'non-vegetarian'].includes(b.diet)) throw new Error('Choose the dish dietary type.');
  data.isVeg = b.diet === 'vegetarian';
  if (b.consent !== true) throw new Error('Confirm you are authorised to submit this business.');
  return data;
}
module.exports = function registerBusinessListings(app, sql) {
  app.post('/api/business-listings', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    // A filled hidden field indicates an automated submission; no external URLs are fetched.
    if (req.body?.website) return res.status(400).json({ success: false, error: 'Unable to submit this listing.' });
    let d;
    try { d = validate(req.body); } catch (err) { return res.status(400).json({ success: false, error: err.message }); }
    const duplicateKey = crypto.createHash('sha256').update([d.businessName.toLowerCase(), d.city.toLowerCase(), d.address.toLowerCase(), d.email.toLowerCase()].join('|')).digest('hex');
    try {
      const id = crypto.randomUUID();
      const accessCode = crypto.randomBytes(32).toString("hex");
      const checkoutTokenHash = crypto.createHash("sha256").update(accessCode).digest("hex");
      const rows = await sql`INSERT INTO public."BusinessSubmission" (id,"duplicateKey","businessName",category,city,address,"contactName",email,phone,"profileUrl","menuUrl","dishName","dishPrice","isVeg","checkoutTokenHash") VALUES (${id},${duplicateKey},${d.businessName},${d.category},${d.city},${d.address},${d.contactName},${d.email.toLowerCase()},${d.phone},${d.profileUrl},${d.menuUrl || null},${d.dishName},${d.dishPrice},${d.isVeg},${checkoutTokenHash}) ON CONFLICT ("duplicateKey") DO NOTHING RETURNING id`;
      if (!rows.length) return res.status(409).json({ success: false, error: 'This business has already been submitted with these contact details. It is awaiting review or has previously been reviewed.' });
      return res.status(201).json({ success: true, reference: id, accessCode, status: 'pending', message: 'Your business has been submitted for review. It will appear in recommendations only after profile and menu checks and approval.' });
    } catch (err) {
      console.error('Business submission failed', { code: err.code || 'database_error' });
      return res.status(503).json({ success: false, error: 'We could not save your listing right now. Please try again later.' });
    }
  });
};
module.exports.validate = validate;
module.exports.profileUrl = profileUrl;
