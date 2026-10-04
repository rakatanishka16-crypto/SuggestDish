'use strict';
const crypto = require('node:crypto');

// Per-instance abuse protection; a shared edge limit is needed for a distributed cap.
module.exports = function launchSecurity(app, {env = process.env, now = Date.now} = {}) {
  const attempts = new Map();
  const production = env.VERCEL === '1' || env.NODE_ENV === 'production';
  const origins = new Set(['https://www.suggestdish.com', 'https://suggestdish.com']);
  if (env.VERCEL_URL) origins.add('https://' + env.VERCEL_URL);
  if (env.VERCEL_BRANCH_URL) origins.add('https://' + env.VERCEL_BRANCH_URL);
  if (!production) for (const host of ['localhost', '127.0.0.1']) for (const port of [3000, 4173, 8080]) origins.add(`http://${host}:${port}`);
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    const path = req.originalUrl.split('?')[0];
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    const origin = req.get('origin');
    if (origin && !origins.has(origin)) return res.status(403).json({success:false,error:'This origin is not allowed.'});
    if (origin) {res.set('Access-Control-Allow-Origin', origin); res.vary('Origin');}
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers','Content-Type, Authorization, X-Razorpay-Signature');
      return res.status(204).end();
    }
    if (production && ['/api/geocode-restaurants', '/api/ai-test', '/api/db-test'].includes(path)) {
      const secret = env.BUSINESS_REVIEW_KEY;
      const digest = s => crypto.createHash('sha256').update(s).digest();
      if (!secret || secret.length < 32 || !crypto.timingSafeEqual(digest(req.get('authorization') || ''), digest('Bearer ' + secret))) return res.status(403).json({success:false,error:'Private administrator access required.'});
    }
    // The provider verifies webhook signatures; don't throttle payments with visitor limits.
    if (path === '/api/razorpay-webhook') return next();
    const time = now();
    for (const [key, value] of attempts) if (value.ends <= time) attempts.delete(key);
    const expensive = path === '/api/ai-recommend' || path === '/api/location-search';
    const write = req.method === 'POST';
    const bucket = expensive ? 'discovery' : write ? 'write' : 'read';
    const limit = expensive ? 30 : write ? 60 : 180;
    // Use only Vercel's provider-controlled header, never arbitrary forwarded-for.
    const ip = env.VERCEL === '1' ? (req.get('x-vercel-forwarded-for') || req.socket?.remoteAddress || 'unknown') : (req.ip || 'unknown');
    const key = `${ip}:${bucket}`;
    if (!attempts.has(key) && attempts.size >= 5000) return res.status(503).json({success:false,error:'The service is busy. Please try again shortly.'});
    const count = attempts.get(key) || {n:0, ends:time + 60000};
    count.n++; attempts.set(key,count);
    if (count.n > limit) {res.set('Retry-After', String(Math.max(1,Math.ceil((count.ends-time)/1000))));return res.status(429).json({success:false,error:'Too many requests. Please wait a minute and try again.'});}
    next();
  });
};
