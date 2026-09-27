require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { neon } = require("@neondatabase/serverless");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());
app.use(express.json());

const sql = neon(process.env.DATABASE_URL);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const PORT = process.env.PORT || 3000;

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
      Number.isFinite(lon);

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
        r.name AS "restaurantName",
        r.address AS "restaurantAddress",
        r.city AS "restaurantCity",
        r.latitude,
        r.longitude
      FROM "Dish" d
      JOIN "Restaurant" r
        ON r.id = d."restaurantId"
      WHERE d.price IS NOT NULL
        AND d.price <= ${budget}
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
        summary: "No dishes currently match your budget."
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
      .filter((dish) => {
        // If location is available and the restaurant
        // has coordinates, enforce the 25 km radius.
        if (
          hasLocation &&
          dish.distanceKm !== null
        ) {
          return dish.distanceKm <= maxDistanceKm;
        }

        // Keep restaurants without coordinates so that
        // the system can still recommend them when
        // location data is incomplete.
        return true;
      });


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
          "No dishes were found within the current location radius and budget."
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

        if (budgetRatio <= 0.5) {
          score += 3;
        } else if (budgetRatio <= 0.75) {
          score += 2;
        } else {
          score += 1;
        }
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
    const candidateDishes = scoredDishes.slice(0, 60);


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
Budget: ₹${budget}
Vegetarian: ${vegetarian}

User location:
Latitude: ${hasLocation ? lat : "not provided"}
Longitude: ${hasLocation ? lon : "not provided"}

DATABASE CANDIDATES

${JSON.stringify(dishData, null, 2)}

STRICT RULES:

1. You may ONLY recommend dishes from the candidate list.
2. Never invent a dish.
3. Never invent a restaurant.
4. Never modify a dish name.
5. Never modify a restaurant name.
6. Never recommend a dish above ₹${budget}.
7. If vegetarian is true, recommend ONLY vegetarian=true dishes.
8. Use taste, cuisine and mood to choose relevant dishes.
9. Prefer closer restaurants when distanceKm is available.
10. Prefer candidates with stronger relevanceScore.
11. Recommend a maximum of 3 dishes.
12. Each recommendation must use the exact database dishName and restaurant.
13. Keep each reason short and natural.
14. Return ONLY valid JSON.

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


    // --------------------------------------------------
    // 11. ASK GEMINI
    // --------------------------------------------------

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt
    });

    const text = response.text || "";


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
      console.error(
        "Gemini JSON parse error:",
        parseError
      );

      console.error(
        "Gemini raw response:",
        text
      );

      return res.status(500).json({
        success: false,
        error:
          "Gemini returned an invalid recommendation format."
      });
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
                reason:
                  String(
                    recommendation.reason ||
                      "This dish matches your preferences."
                  ).trim()
              };
            })
            .filter(Boolean)
        : [];


    // --------------------------------------------------
    // 14. FALLBACK
    // --------------------------------------------------

    if (recommendations.length === 0) {
      const fallback = candidateDishes
        .slice(0, 3)
        .map((dish) => ({
          dishName: dish.name,
          restaurant: dish.restaurantName,
          price: Number(dish.price),
          vegetarian: dish.isVeg === true,
          address: dish.restaurantAddress,
          city: dish.restaurantCity,
          distanceKm:
            dish.distanceKm !== null
              ? Number(dish.distanceKm.toFixed(2))
              : null,
          reason:
            "A strong match based on your budget, preferences, and available location data."
        }));

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
          radiusKm: hasLocation
            ? maxDistanceKm
            : null
        },
        recommendations: fallback,
        summary:
          "These dishes were selected from available SuggestDish database data."
      });
    }


    // --------------------------------------------------
    // 15. FINAL RESPONSE
    // --------------------------------------------------

    res.json({
      success: true,

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