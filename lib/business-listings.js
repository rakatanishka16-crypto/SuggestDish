const crypto = require('node:crypto');
const publication=require('./self-published-business');
const {price:menuPrice}=require('./owner-menu-input');
const profileUrl=require('./ownership-evidence');
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
  if (!['Restaurant', 'Cafe', 'Hotel', 'Bakery', 'Home baker', 'Catering', 'Cloud kitchen', 'Food outlet', 'Other'].includes(data.category)) throw new Error('Choose a business category.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !/^\+?[\d\s()-]{10,20}$/.test(data.phone)) throw new Error('Enter a valid email and phone number.');
  data.profileUrl = profileUrl(data.profileUrl);
  if (!data.profileUrl) throw new Error('Add an HTTPS official business website or public business profile (Google, Zomato, Instagram or Facebook).');
  if (data.menuUrl) {
    try { const u = new URL(data.menuUrl); if (u.protocol !== 'https:' || u.username || u.password) throw 0; data.menuUrl = u.href; } catch { throw new Error('Enter a valid HTTPS menu link.'); }
  }
  if (!data.menuUrl && b.menuOnProfile !== true) throw new Error('Add a menu link or confirm your menu is available on your business profile.');
  data.dishPrice = menuPrice(b.dishPrice);
  if (!Number.isFinite(data.dishPrice) || data.dishPrice <= 0 || data.dishPrice > 100000) throw new Error('Enter a valid dish price in rupees.');
  if (!['vegetarian', 'non-vegetarian'].includes(b.diet)) throw new Error('Choose the dish dietary type.');
  data.isVeg = b.diet === 'vegetarian';
  if (b.consent !== true) throw new Error('Confirm you are authorised to submit this business.');
  return data;
}
module.exports = function registerBusinessListings(app, sql) {
  async function owner(body) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body?.submissionId || '') || !/^[a-f0-9]{64}$/.test(body?.accessCode || '')) return null;
    const rows = await sql`SELECT * FROM public."BusinessSubmission" WHERE id=${body.submissionId}::uuid`;
    const hash = crypto.createHash('sha256').update(body.accessCode).digest('hex');
    const stored = rows[0]?.checkoutTokenHash;
    return stored && /^[a-f0-9]{64}$/.test(stored) && crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(stored,'hex')) ? rows[0] : null;
  }
  app.post('/api/business-listings/status', async (req,res) => {
    res.set('Cache-Control','no-store');
    try {
      const s=await owner(req.body);
      if(!s) return res.status(403).json({success:false,error:'Enter the correct business reference and private access code.'});
      return res.json({success:true,status:publication.isPublished(s)?'published':s.status,published:publication.isPublished(s),directoryUrl:publication.isPublished(s)?publication.directoryUrl(s):null,businessName:s.businessName,profileUrl:s.profileUrl,dishName:s.dishName,dishPrice:s.dishPrice,isVeg:s.isVeg,menuUrl:s.menuUrl,reviewedAt:s.reviewedAt,canEdit:['pending','needs_information'].includes(s.status),message:publication.isPublished(s)?'Your business and dish are live. Details are owner-submitted; recommendations depend on matching preferences and location data.':s.status==='approved'?'Your business and signature dish have been approved. Recommendations depend on preferences and available location data.':s.status==='needs_information'?'More information is needed. Check your profile and menu details, then resubmit.':s.status==='rejected'?'This submission was not approved. Contact SuggestDish for a review.':'Your business is awaiting profile and menu verification.'});
    } catch { return res.status(503).json({success:false,error:'Business status is temporarily unavailable.'}); }
  });
  app.post('/api/business-listings/dish', async (req,res) => {
    res.set('Cache-Control','no-store');
    try {
      const s=await owner(req.body);
      if(!s) return res.status(403).json({success:false,error:'Enter the correct business reference and private access code.'});
      if(!['pending','needs_information'].includes(s.status)) return res.status(409).json({success:false,error:'Reviewed listings cannot be changed here. Contact SuggestDish to request a verified menu update.'});
      let d;
      try { d=validate({...s,...req.body,businessName:s.businessName,category:s.category,city:s.city,address:s.address,contactName:s.contactName,email:s.email,phone:s.phone}); }
      catch(e){return res.status(400).json({success:false,error:e.message});}
      const rows=await publication.update(sql,s,d);
      if(!rows.length)return res.status(409).json({success:false,error:'Your submission was reviewed while you were editing. Check its status.'});
      res.json({success:true,status:'published',published:true,directoryUrl:publication.directoryUrl(s),message:'Your business and dish details are live. No manual approval is required.'});
    } catch {res.status(503).json({success:false,error:'Could not save dish details. Please try again later.'});}
  });
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
      const rows = await publication.create(sql,d,{id,duplicateKey,checkoutTokenHash});
      if (!rows.length) throw new Error('No listing saved');
      return res.status(201).json({success:true,reference:id,accessCode,status:'published',published:true,directoryUrl:publication.directoryUrl(d),message:'Your business and signature dish are live. No manual approval is required. Details are owner-submitted; recommendations depend on the selected preferences and available location data.'});
    } catch (err) {
      if(err.code==='23505')return res.status(409).json({success:false,error:'This business has already been submitted. Use your saved business reference and private access code to check or update it.'});
      console.error('Business submission failed', { code: err.code || 'database_error' });
      return res.status(503).json({ success: false, error: 'We could not save your listing right now. Please try again later.' });
    }
  });
};
module.exports.validate = validate;
module.exports.profileUrl = profileUrl;
