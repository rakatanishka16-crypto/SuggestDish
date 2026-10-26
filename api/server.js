require("dotenv").config();

const express = require("express");
const { neon } = require("@neondatabase/serverless");
const { GoogleGenAI } = require("@google/genai");
const operationalErrors = require("../lib/operational-errors");
const { categoryMatches } = require("../lib/menu-preference-evidence");

const app = express();

require('../lib/launch-security')(app);
app.use(express.json({ limit: "400kb", verify(req, res, buf) { req.rawBody = Buffer.from(buf); } }));

const sql = neon(process.env.DATABASE_URL);
require("../lib/business-listings")(app, sql);
require("../lib/business-directory")(app, sql);
require("../lib/source-catalog")(app);
require("../lib/catalogue-import").register(app);
require("../lib/recommendation-coverage")(app, sql);
require("../lib/dish-photos")(app, {sql});
require("../lib/customer-feedback")(app, sql);
const ownerMetrics = require("../lib/dish-events")(app, sql);
require("../lib/business-media")(app, sql, {getMetrics:ownerMetrics,rawParser:express.raw({type:["image/jpeg","image/png"],limit:"2mb"})});
require("../lib/business-stars")(app, sql);
const { label: starEvidenceLabel } = require("../lib/star-evidence");
require("../lib/business-review")(app, sql);
require("../lib/razorpay-payments")(app, sql);
require("../lib/featured-dishes")(app, sql);
require("../lib/business-promotions")(app, sql);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const PORT = process.env.PORT || 3000;

app.get('/api/health', (req,res) => res.json({success:true,status:'ok'}));

app.get('/api/db-test', async (req,res) => {
  try { const rows=await sql`SELECT COUNT(*)::int AS count FROM "Restaurant"`; res.json({success:true,restaurantCount:rows[0].count}); }
  catch {res.status(503).json({success:false,error:'Database diagnostics are temporarily unavailable.'});}
});

// A typed city filters the same production dishes used by recommendations.
app.get("/api/location-search", async (req, res) => {
  const query = String(req.query.q || "").trim();
  if (query.length < 2 || query.length > 120) {
    return res.status(400).json({ success: false, error: "Enter a city or area between 2 and 120 characters." });
  }
  try {
    const cities = await sql`
      SELECT DISTINCT city FROM "Restaurant"
      WHERE LOWER(TRIM(city)) = LOWER(${query})
      LIMIT 1
    `;
    if (cities.length) {
      return res.json({ success: true, city: cities[0].city, label: cities[0].city, latitude: null, longitude: null });
    }
    const apiKey = process.env.GEOAPIFY_KEY || process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ success: false, error: "Area search is unavailable. Try a listed city such as Mumbai or Jalna." });
    }
    const params = new URLSearchParams({ text: query, filter: "countrycode:in", limit: "1", apiKey });
    const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params}`, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error("Location service unavailable");
    const data = await response.json();
    const place = data.features?.[0]?.properties;
    if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) {
      return res.status(404).json({ success: false, error: "Area not found. Try including the city, for example Bandra West, Mumbai." });
    }
    return res.json({ success: true, city: null, label: place.formatted || query, latitude: place.lat, longitude: place.lon });
  } catch (error) {
    operationalErrors.log("Location search unavailable", error);
    return res.status(503).json({ success: false, error: "Unable to find that location right now. Please try again." });
  }
});

function calculateDistanceKm(
  userLat,
  userLon,
  restaurantLat,
  restaurantLon
) {
  if (
    userLat === null ||
    userLon === null ||
    restaurantLat === null ||
    restaurantLon === null ||
    !Number.isFinite(userLat) ||
    !Number.isFinite(userLon) ||
    !Number.isFinite(Number(restaurantLat)) ||
    !Number.isFinite(Number(restaurantLon))
  ) {
    return null;
  }

  const lat1 = (Number(userLat) * Math.PI) / 180;
  const lat2 = (Number(restaurantLat) * Math.PI) / 180;

  const deltaLat =
    ((Number(restaurantLat) - Number(userLat)) * Math.PI) / 180;

  const deltaLon =
    ((Number(restaurantLon) - Number(userLon)) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) ** 2;

  const c =
    2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return 6371 * c;
}
app.get("/api/geocode-restaurants", async (req, res) => {
  try {
    const restaurants = await sql`
      SELECT "id", "name", "address", "city"
      FROM "Restaurant"
      WHERE "latitude" IS NULL
         OR "longitude" IS NULL
      ORDER BY "id"
    `;

    const results = [];

    for (const restaurant of restaurants) {
      const searchText = [
        restaurant.name,
        restaurant.address,
        restaurant.city || "Jalna",
        "Maharashtra",
        "India"
      ]
        .filter(Boolean)
        .join(", ");

      const url =
        "https://api.geoapify.com/v1/geocode/search" +
        `?text=${encodeURIComponent(searchText)}` +
        `&limit=1` +
        `&apiKey=${process.env.GEOAPIFY_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const location = data.features[0].properties;

        results.push({
          id: restaurant.id,
          name: restaurant.name,
          latitude: location.lat,
          longitude: location.lon,
          formatted: location.formatted
        });
      } else {
        results.push({
          id: restaurant.id,
          name: restaurant.name,
          latitude: null,
          longitude: null,
          formatted: null
        });
      }
    }

    res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    operationalErrors.log("Geocoding unavailable", error);

    res.status(500).json({
      success: false,
      error: 'Restaurant geocoding is temporarily unavailable.'
    });
  }
});
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SuggestDish backend is running."
  });
});

app.get("/api/ai-test", async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "GEMINI_API_KEY is missing."
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: "Reply with exactly: Gemini connection is working."
    });

    res.json({
      success: true,
      message: response.text || ""
    });

  } catch (error) {
    operationalErrors.log("AI diagnostics unavailable", error);

    res.status(500).json({
      success: false,
      error: 'AI diagnostics are temporarily unavailable.'
    });
  }
});

app.get("/api/menu-coverage", async (req,res) => {
  const city=String(req.query.city || "").trim();
  if(city.length>120)return res.status(400).json({success:false,error:"City name is too long."});
  try {
    const rows=await sql`SELECT COUNT(DISTINCT r.id)::integer AS restaurants, COUNT(d.id)::integer AS dishes FROM public."Dish" d JOIN public."Restaurant" r ON r.id=d."restaurantId" WHERE d.price IS NOT NULL AND (${city}='' OR LOWER(TRIM(r.city))=LOWER(${city}))`;
    return res.json({success:true,city:city || null,restaurants:Number(rows[0]?.restaurants || 0),dishes:Number(rows[0]?.dishes || 0),label:"Priced menu records; not a claim of complete coverage or verified current availability."});
  }catch{return res.status(503).json({success:false,error:"Menu coverage is temporarily unavailable."});}
});

require("../lib/dish-discovery")(app, sql, {ai});

app.use((error,req,res,next)=>{if(error.type==='entity.too.large')return res.status(413).json({success:false,error:'This upload is too large. Dish and menu images must be under 2 MB.'});return res.status(400).json({success:false,error:'The request could not be processed. Check the submitted format.'});});


if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `SuggestDish backend running at http://localhost:${PORT}`
    );
  });
}

module.exports = app;

