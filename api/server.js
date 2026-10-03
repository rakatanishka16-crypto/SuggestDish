require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { neon } = require("@neondatabase/serverless");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());
app.use(express.json({ limit: "100kb", verify(req, res, buf) { req.rawBody = Buffer.from(buf); } }));

const sql = neon(process.env.DATABASE_URL);
require("../lib/business-listings")(app, sql);
require("../lib/business-directory")(app, sql);
require("../lib/business-stars")(app, sql);
require("../lib/business-review")(app, sql);
require("../lib/razorpay-payments")(app, sql);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const PORT = process.env.PORT || 3000;

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
    console.error("Location search unavailable:", error.name);
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
    console.error("Geocoding error:", error);

    res.status(500).json({
      success: false,
      error: error.message
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
  console.log(
    "GEMINI_API_KEY exists:",
    Boolean(process.env.GEMINI_API_KEY)
  );

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
    console.error("AI test error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/api/ai-recommend", async (req, res) => {
  console.log(
    "GEMINI_API_KEY exists:",
    Boolean(process.env.GEMINI_API_KEY)
  );

  try {
    // --------------------------------------------------
    // 1. READ USER PREFERENCES
    // --------------------------------------------------

    const taste = String(req.query.taste || "any").trim();
    const cuisine = String(req.query.cuisine || "any").trim();
    const mood = String(req.query.mood || "any").trim();
    const city = String(req.query.city || "").trim();
    if (city.length > 120) {
      return res.status(400).json({ success: false, error: "City name is too long." });
    }

    const budgetRaw = Number(req.query.budget || 500);
    const budget =
      Number.isFinite(budgetRaw) && budgetRaw > 0
        ? Math.min(budgetRaw, 100000)
        : 500;

    const vegetarian =
      String(req.query.vegetarian || "false").toLowerCase() === "true";

    const lat =
      req.query.lat !== undefined && req.query.lat !== ""
        ? Number(req.query.lat)
        : null;

    const lon =
      req.query.lon !== undefined && req.query.lon !== ""
        ? Number(req.query.lon)
        : null;

    const hasLocation =
      lat !== null &&
      lon !== null &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180;

    if ((req.query.lat !== undefined || req.query.lon !== undefined) && !hasLocation) {
      return res.status(400).json({
        success: false,
        error: "Provide a valid latitude and longitude together."
      });
    }

    const maxDistanceKm = 25;


    // --------------------------------------------------
    // 2. GET REAL DISHES FROM NEON
    // --------------------------------------------------

    const dishes = await sql`
      SELECT
        d.id,
        d.name,
        d.price,
        d."isVeg",
        r.id AS "restaurantId",
        (sd."dishId" IS NOT NULL) AS "starConfirmed",
        sd."popularityBasis", sd."popularityVerified",
        r.name AS "restaurantName",
        r.address AS "restaurantAddress",
        r.city AS "restaurantCity",
        r.latitude,
        r.longitude
      FROM "Dish" d
      JOIN "Restaurant" r
        ON r.id = d."restaurantId"
      LEFT JOIN "RestaurantStarDish" sd ON sd."dishId"=d.id AND sd.slot<=public.restaurant_star_limit(r.id)
      WHERE (sd."dishId" IS NOT NULL OR NOT EXISTS (SELECT 1 FROM "BusinessClaim" bc WHERE bc."restaurantId"=r.id AND bc.status='approved'))
        AND d.price IS NOT NULL
        AND d.price <= ${budget}
        AND (${city} = '' OR LOWER(TRIM(r.city)) = LOWER(${city}))
      ORDER BY d.id ASC
    `;


    // --------------------------------------------------
    // 3. STOP IF NOTHING MATCHES THE BUDGET
    // --------------------------------------------------

    if (dishes.length === 0) {
      return res.json({
        success: true,
        preferences: {
          taste,
          cuisine,
          mood,
          budget,
          vegetarian,
          latitude: lat,
          longitude: lon,
          radiusKm: hasLocation ? maxDistanceKm : null
        },
        recommendations: [],
        summary: city
          ? `No priced dishes in ${city} currently match your budget.`
          : "No dishes currently match your budget."
      });
    }


    // --------------------------------------------------
    // 4. VEGETARIAN FILTER
    // --------------------------------------------------

    let filteredDishes = vegetarian
      ? dishes.filter((dish) => dish.isVeg === true)
      : dishes;


    if (filteredDishes.length === 0) {
      return res.json({
        success: true,
        preferences: {
          taste,
          cuisine,
          mood,
          budget,
          vegetarian,
          latitude: lat,
          longitude: lon,
          radiusKm: hasLocation ? maxDistanceKm : null
        },
        recommendations: [],
        summary: "No vegetarian dishes currently match your budget."
      });
    }


    // --------------------------------------------------
    // 5. CALCULATE DISTANCE
    // --------------------------------------------------

    filteredDishes = filteredDishes
      .map((dish) => {
        let distanceKm = null;

        if (
          hasLocation &&
          dish.latitude !== null &&
          dish.longitude !== null &&
          Number.isFinite(Number(dish.latitude)) &&
          Number.isFinite(Number(dish.longitude))
        ) {
          distanceKm = calculateDistanceKm(
            lat,
            lon,
            Number(dish.latitude),
            Number(dish.longitude)
          );
        }

        return {
          ...dish,
          distanceKm
        };
      })
      .filter((dish) =>
        // An unknown location cannot be presented as a nearby result.
        !hasLocation ||
        (dish.distanceKm !== null && dish.distanceKm <= maxDistanceKm)
      );


    if (filteredDishes.length === 0) {
      return res.json({
        success: true,
        preferences: {
          taste,
          cuisine,
          mood,
          budget,
          vegetarian,
          latitude: lat,
          longitude: lon,
          radiusKm: maxDistanceKm
        },
        recommendations: [],
        summary:
          "No dishes with a confirmed location were found within 25 km and your budget. Try searching without location or check back as we add verified local dishes."
      });
    }


    // --------------------------------------------------
    // 6. KEYWORD MATCHING
    // --------------------------------------------------

    const normalize = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();


    const textForDish = (dish) =>
      normalize(
        `${dish.name} ${dish.restaurantName} ${dish.restaurantAddress || ""}`
      );


    const tasteKeywords = {
      spicy: [
        "spicy",
        "chilli",
        "chili",
        "schezwan",
        "manchurian",
        "tikka",
        "masala",
        "peri peri",
        "dragon",
        "hot"
      ],

      sweet: [
        "sweet",
        "chocolate",
        "waffle",
        "mango",
        "strawberry",
        "milkshake",
        "mastani",
        "dessert",
        "gulab",
        "ice cream",
        "brownie"
      ],

      savory: [
        "masala",
        "pav",
        "sandwich",
        "pizza",
        "dosa",
        "idli",
        "biryani",
        "naan",
        "roti",
        "rice"
      ],

      light: [
        "salad",
        "soup",
        "idli",
        "juice",
        "buttermilk",
        "lassi",
        "sandwich"
      ],

      rich: [
        "butter",
        "cheese",
        "paneer",
        "cream",
        "alfredo",
        "malai",
        "korma",
        "biryani"
      ]
    };


    const cuisineKeywords = {
      indian: [
        "paneer",
        "masala",
        "dal",
        "roti",
        "naan",
        "paratha",
        "biryani",
        "pav",
        "dosa",
        "idli",
        "thali",
        "khichadi",
        "rice"
      ],

      chinese: [
        "manchurian",
        "chilli",
        "schezwan",
        "noodles",
        "fried rice",
        "spring roll",
        "crispy",
        "dragon"
      ],

      italian: [
        "pizza",
        "pasta",
        "alfredo",
        "arrabiata",
        "aglio",
        "spaghetti",
        "penne"
      ],

      maharashtrian: [
        "pav bhaji",
        "misal",
        "poha",
        "vada pav",
        "puran poli",
        "sabudana"
      ],

      south: [
        "dosa",
        "idli",
        "uttapam",
        "vada",
        "sambar",
        "rasam"
      ],

      fastfood: [
        "pizza",
        "burger",
        "sandwich",
        "fries",
        "waffle",
        "pasta"
      ]
    };


    const moodKeywords = {
      dinner: [
        "biryani",
        "thali",
        "paneer",
        "naan",
        "roti",
        "rice",
        "dal",
        "curry"
      ],

      lunch: [
        "thali",
        "rice",
        "dal",
        "roti",
        "naan",
        "paratha",
        "biryani",
        "khichadi"
      ],

      breakfast: [
        "idli",
        "dosa",
        "poha",
        "paratha",
        "sandwich",
        "vada",
        "uttapam"
      ],

      comfort: [
        "pav bhaji",
        "pizza",
        "paneer",
        "dal",
        "khichadi",
        "noodles",
        "fries",
        "sandwich"
      ],

      celebration: [
        "pizza",
        "biryani",
        "paneer",
        "waffle",
        "dessert",
        "cheese",
        "special"
      ],

      snack: [
        "sandwich",
        "fries",
        "pav",
        "vada",
        "chaat",
        "waffle",
        "momos"
      ]
    };


    const getKeywords = (dictionary, preference) => {
      const key = normalize(preference);

      if (
        !key ||
        key === "any" ||
        key === "all" ||
        key === "none"
      ) {
        return [];
      }

      return dictionary[key] || [];
    };


    const selectedTasteKeywords =
      getKeywords(tasteKeywords, taste);

    const selectedCuisineKeywords =
      getKeywords(cuisineKeywords, cuisine);

    const selectedMoodKeywords =
      getKeywords(moodKeywords, mood);


    // --------------------------------------------------
    // 7. SCORE EACH DISH
    // --------------------------------------------------

    const scoredDishes = filteredDishes.map((dish) => {
      const dishText = textForDish(dish);

      let score = 0;

      // Taste relevance
      for (const keyword of selectedTasteKeywords) {
        if (dishText.includes(keyword)) {
          score += 8;
        }
      }

      // Cuisine relevance
      for (const keyword of selectedCuisineKeywords) {
        if (dishText.includes(keyword)) {
          score += 7;
        }
      }

      // Mood relevance
      for (const keyword of selectedMoodKeywords) {
        if (dishText.includes(keyword)) {
          score += 5;
        }
      }

      // Strong budget preference:
      // cheaper dishes get a small advantage,
      // but expensive dishes under budget remain eligible.
      if (dish.price !== null) {
        const budgetRatio = Number(dish.price) / budget;

        if (budgetRatio >= 0.15 && budgetRatio <= 0.75) {
          score += 2;
        } else if (budgetRatio > 0.75) {
          score += 1;
        }
      }

      // Generic discovery should favor a dish over bottled water or an add-on.
      if (/\b(water bottle|mineral water|packaged water|extra butter|extra pav|extra cheese|add[- ]?on)\b/i.test(dish.name)) {
        score -= 10;
      }

      // Distance preference
      if (dish.distanceKm !== null) {
        if (dish.distanceKm <= 2) {
          score += 7;
        } else if (dish.distanceKm <= 5) {
          score += 5;
        } else if (dish.distanceKm <= 10) {
          score += 3;
        } else {
          score += 1;
        }
      }

      return {
        ...dish,
        relevanceScore: score
      };
    });


    // --------------------------------------------------
    // 8. SORT BEST CANDIDATES
    // --------------------------------------------------

    scoredDishes.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }

      if (
        a.distanceKm !== null &&
        b.distanceKm !== null
      ) {
        return a.distanceKm - b.distanceKm;
      }

      return Number(a.price) - Number(b.price);
    });


    // Send only a manageable candidate pool to Gemini.
    const seenRestaurants = new Set();
    const candidateDishes = scoredDishes.filter(dish => {
      const key = dish.restaurantId ?? dish.restaurantName;
      if (seenRestaurants.has(key)) return false;
      seenRestaurants.add(key); return true;
    }).slice(0, 60);


    // --------------------------------------------------
    // 9. PREPARE GEMINI DATA
    // --------------------------------------------------

    const dishData = candidateDishes.map((dish) => ({
      id: dish.id,
      dishName: dish.name,
      price: Number(dish.price),
      vegetarian: dish.isVeg === true,
      restaurant: dish.restaurantName,
      address: dish.restaurantAddress,
      city: dish.restaurantCity,
      distanceKm:
        dish.distanceKm !== null
          ? Number(dish.distanceKm.toFixed(2))
          : null,
      relevanceScore: dish.relevanceScore
    }));


    // --------------------------------------------------
    // 10. GEMINI PROMPT
    // --------------------------------------------------

    const prompt = `
You are the AI recommendation engine for SuggestDish.

Your job is to select the most suitable dishes from the supplied
database candidates.

USER PREFERENCES

Taste: ${taste}
Cuisine: ${cuisine}
Mood: ${mood}
Budget: â‚¹${budget}
Vegetarian: ${vegetarian}

User location:
Latitude: ${hasLocation ? lat : "not provided"}
Longitude: ${hasLocation ? lon : "not provided"}
City: ${city || "not provided"}

DATABASE CANDIDATES

${JSON.stringify(dishData, null, 2)}

STRICT RULES:

1. You may ONLY recommend dishes from the candidate list.
2. Never invent a dish.
3. Never invent a restaurant.
4. Never modify a dish name.
5. Never modify a restaurant name.
6. Never recommend a dish above â‚¹${budget}.
7. If vegetarian is true, recommend ONLY vegetarian=true dishes.
8. Use taste, cuisine and mood to choose relevant dishes.
9. Prefer closer restaurants when distanceKm is available.
10. Prefer candidates with stronger relevanceScore.
11. Recommend a maximum of 3 dishes.
12. Each recommendation must use the exact database dishName and restaurant.
13. Keep each reason short and natural.
14. Return ONLY valid JSON.
15. Do not claim ratings, popularity, reviews, opening hours, ingredient details or verification that are not present in the supplied data.

Return exactly:

{
  "recommendations": [
    {
      "id": 123,
      "dishName": "exact database dish name",
      "restaurant": "exact database restaurant name",
      "reason": "short useful reason"
    }
  ],
  "summary": "short overall explanation"
}
`;


    // A real, filtered dish remains available when Gemini is overloaded.
    const fallbackRecommendations = candidateDishes.slice(0, 3).map((dish) => ({
      dishName: dish.name,
      restaurant: dish.restaurantName,
      price: Number(dish.price),
      vegetarian: dish.isVeg === true,
      address: dish.restaurantAddress,
      city: dish.restaurantCity,
      distanceKm: dish.distanceKm === null ? null : Number(dish.distanceKm.toFixed(2)),
      starConfirmed: dish.starConfirmed === true,
      popularityBasis: dish.popularityBasis || null,
      popularityVerified: dish.popularityVerified === true,
      reason: (dish.starConfirmed ? "Approved star dish. " : "Menu suggestion — star dish not yet confirmed. ") + (dish.distanceKm === null
        ? `Listed at ₹${Number(dish.price)} within your budget.`
        : `Listed at ₹${Number(dish.price)}, ${dish.distanceKm.toFixed(1)} km away.`)
    }));

    const fallbackResponse = () => res.json({
      success: true,
      source: "database",
      preferences: {
        taste, cuisine, mood, budget, vegetarian,
        latitude: lat, longitude: lon,
        radiusKm: hasLocation ? maxDistanceKm : null
      },
      recommendations: fallbackRecommendations,
      summary: "These available dishes match your preferences."
    });

    if (!process.env.GEMINI_API_KEY) return fallbackResponse();

    let text;
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", httpOptions: { timeout: 12000 } }
      });
      text = response.text || "";
    } catch (error) {
      console.error("Gemini recommendation unavailable:", error.status || error.code || error.name);
      return fallbackResponse();
    }


    // --------------------------------------------------
    // 12. PARSE GEMINI JSON
    // --------------------------------------------------

    let parsed;

    try {
      const cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      parsed = JSON.parse(cleaned);

    } catch (parseError) {
      console.error("Gemini returned invalid recommendation JSON:", parseError.message);
      return fallbackResponse();
    }


    // --------------------------------------------------
    // 13. VALIDATE GEMINI'S RECOMMENDATIONS
    // --------------------------------------------------

    const candidateMap = new Map(
      candidateDishes.map((dish) => [
        String(dish.id),
        dish
      ])
    );


    const recommendations =
      Array.isArray(parsed.recommendations)
        ? parsed.recommendations
            .slice(0, 3)
            .map((recommendation) => {

              const candidate =
                recommendation.id !== undefined
                  ? candidateMap.get(
                      String(recommendation.id)
                    )
                  : candidateDishes.find(
                      (dish) =>
                        dish.name ===
                          recommendation.dishName &&
                        dish.restaurantName ===
                          recommendation.restaurant
                    );

              if (!candidate) {
                return null;
              }

              if (
                candidate.price === null ||
                Number(candidate.price) > budget
              ) {
                return null;
              }

              if (
                vegetarian &&
                candidate.isVeg !== true
              ) {
                return null;
              }

              return {
                dishName: candidate.name,
                restaurant: candidate.restaurantName,
                price: Number(candidate.price),
                vegetarian: candidate.isVeg === true,
                address: candidate.restaurantAddress,
                city: candidate.restaurantCity,
                distanceKm:
                  candidate.distanceKm !== null
                    ? Number(
                        candidate.distanceKm.toFixed(2)
                      )
                    : null,
                starConfirmed: candidate.starConfirmed === true,
                popularityBasis: candidate.popularityBasis || null,
                popularityVerified: candidate.popularityVerified === true,
                reason:
                  (candidate.starConfirmed ? "Approved star dish. " : "Menu suggestion — star dish not yet confirmed. ") + String(
                    recommendation.reason ||
                      "This dish matches your preferences."
                  ).trim()
              };
            })
            .filter(Boolean).filter((r,i,all)=>all.findIndex(x=>x.restaurant===r.restaurant && x.address===r.address)===i)
        : [];
    for (const item of fallbackRecommendations) {
      if (recommendations.length >= 3) break;
      if (!recommendations.some(r=>r.restaurant===item.restaurant && r.address===item.address)) recommendations.push(item);
    }


    // --------------------------------------------------
    // 14. FALLBACK
    // --------------------------------------------------

    if (recommendations.length === 0) {
      return fallbackResponse();
    }


    // --------------------------------------------------
    // 15. FINAL RESPONSE
    // --------------------------------------------------

    res.json({
      success: true,
      source: "gemini",

      preferences: {
        taste,
        cuisine,
        mood,
        budget,
        vegetarian,
        latitude: lat,
        longitude: lon,
        radiusKm: hasLocation
          ? maxDistanceKm
          : null
      },

      recommendations,

      summary:
        String(
          parsed.summary ||
            "These dishes match your preferences based on the available SuggestDish data."
        ).trim()
    });

  } catch (error) {
    console.error(
      "AI recommendation error:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `SuggestDish backend running at http://localhost:${PORT}`
    );
  });
}

module.exports = app;
