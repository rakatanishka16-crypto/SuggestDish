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
    const taste = req.query.taste || "any";
    const cuisine = req.query.cuisine || "any";
    const mood = req.query.mood || "any";

    const budget = Number(req.query.budget || 500);

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
      WHERE d.price IS NULL OR d.price <= ${budget}
      ORDER BY d.id ASC
    `;

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
          longitude: lon
        },
        recommendations: [],
        summary: "No dishes currently match your budget."
      });
    }

    const maxDistanceKm = 25;

    let nearbyDishes = dishes;

    if (lat !== null && lon !== null) {
      nearbyDishes = dishes
        .map((dish) => ({
          ...dish,
          distanceKm: calculateDistanceKm(
            lat,
            lon,
            dish.latitude,
            dish.longitude
          )
        }))
        .filter(
          (dish) =>
            dish.distanceKm !== null &&
            dish.distanceKm <= maxDistanceKm
        )
        .sort(
          (a, b) =>
            a.distanceKm - b.distanceKm
        );
    }

    const filteredDishes = vegetarian
      ? nearbyDishes.filter(
          (dish) => dish.isVeg === true
        )
      : nearbyDishes;

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
          lat !== null && lon !== null
            ? `No vegetarian dishes within ${maxDistanceKm} km match your budget.`
            : "No dishes match your current preferences."
      });
    }

    const dishData = filteredDishes.map((dish) => ({
      dishName: dish.name,
      price: dish.price,
      vegetarian: dish.isVeg,
      restaurant: dish.restaurantName,
      address: dish.restaurantAddress,
      city: dish.restaurantCity,
      distanceKm:
        dish.distanceKm !== null &&
        dish.distanceKm !== undefined
          ? Number(dish.distanceKm.toFixed(2))
          : null
    }));

    const prompt = `
You are the AI recommendation engine for SuggestDish.

User preferences:

Taste: ${taste}
Cuisine: ${cuisine}
Mood: ${mood}
Budget: ₹${budget}
Vegetarian: ${vegetarian}

The user location is:
Latitude: ${lat ?? "not provided"}
Longitude: ${lon ?? "not provided"}

The following dishes are available from the SuggestDish database:

${JSON.stringify(dishData, null, 2)}

IMPORTANT RULES:

1. Recommend ONLY dishes that appear in the provided database.
2. Do NOT invent restaurants.
3. Do NOT invent dishes.
4. Do NOT change dish names.
5. Do NOT change restaurant names.
6. Respect the user's vegetarian preference.
7. Respect the user's budget.
8. If distanceKm is available, prefer dishes from closer restaurants.
9. Consider taste, cuisine and mood when choosing.
10. Recommend up to 3 dishes.
11. Keep the reason short and useful.
12. Return ONLY valid JSON.

Return exactly this structure:

{
  "recommendations": [
    {
      "dishName": "exact dish name from database",
      "restaurant": "exact restaurant name from database",
      "reason": "short explanation"
    }
  ],
  "summary": "short overall explanation"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt
    });

    const text = response.text || "";

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
          "Gemini returned an invalid recommendation format.",
        rawResponse: text
      });
    }

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
        radiusKm:
          lat !== null && lon !== null
            ? maxDistanceKm
            : null
      },
      recommendations:
        Array.isArray(parsed.recommendations)
          ? parsed.recommendations
          : [],
      summary:
        parsed.summary || ""
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