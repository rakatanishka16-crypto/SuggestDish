const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");
const { GoogleGenAI } = require("@google/genai");

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;


/* =========================================================
   GEMINI
========================================================= */

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SuggestDish backend is running."
  });
});


/* =========================================================
   DATABASE TEST
========================================================= */

app.get("/api/db-test", async (req, res) => {
  try {
    const restaurantCount = await prisma.restaurant.count();
    const dishCount = await prisma.dish.count();

    res.json({
      success: true,
      database: "connected",
      restaurants: restaurantCount,
      dishes: dishCount
    });
  } catch (error) {
    console.error("Database test error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   GEOAPIFY LOCATION TEST
========================================================= */

app.get("/api/location", async (req, res) => {
  try {
    if (!process.env.GEOAPIFY_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEOAPIFY_API_KEY is missing."
      });
    }

    const response = await fetch(
      `https://api.geoapify.com/v1/ipinfo?apiKey=${process.env.GEOAPIFY_API_KEY}`
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data
      });
    }

    res.json({
      success: true,
      location: data
    });
  } catch (error) {
    console.error("Geoapify location error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   GET ALL RESTAURANTS
========================================================= */

app.get("/api/restaurants", async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      include: {
        dishes: {
          include: {
            signals: true
          }
        }
      },
      orderBy: {
        id: "asc"
      }
    });

    res.json({
      success: true,
      count: restaurants.length,
      restaurants
    });
  } catch (error) {
    console.error("Restaurants error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   NEARBY RESTAURANTS USING GEOAPIFY
========================================================= */

app.get("/api/restaurants/nearby", async (req, res) => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const radiusKm = Number(req.query.radiusKm || 10);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return res.status(400).json({
        success: false,
        error: "Valid latitude and longitude are required."
      });
    }

    if (!process.env.GEOAPIFY_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEOAPIFY_API_KEY is missing."
      });
    }

    const radiusMeters = radiusKm * 1000;

    const categories =
      "catering.restaurant,catering.cafe";

    const url =
      `https://api.geoapify.com/v2/places` +
      `?categories=${encodeURIComponent(categories)}` +
      `&filter=circle:${longitude},${latitude},${radiusMeters}` +
      `&limit=50` +
      `&apiKey=${process.env.GEOAPIFY_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data
      });
    }

    const features = data.features || [];
    const savedRestaurants = [];

    for (const feature of features) {
      const properties = feature.properties || {};
      const name = properties.name;

      if (!name) {
        continue;
      }

      const address =
        properties.formatted ||
        properties.address_line1 ||
        null;

      const city =
        properties.city ||
        properties.county ||
        null;

      const coordinates =
        feature.geometry &&
        feature.geometry.coordinates
          ? feature.geometry.coordinates
          : [];

      const restaurantLongitude =
        coordinates[0] ?? null;

      const restaurantLatitude =
        coordinates[1] ?? null;

      const existing =
        await prisma.restaurant.findFirst({
          where: {
            name: name,
            address: address
          }
        });

      let restaurant;

      if (existing) {
        restaurant =
          await prisma.restaurant.update({
            where: {
              id: existing.id
            },
            data: {
              city,
              latitude: restaurantLatitude,
              longitude: restaurantLongitude
            }
          });
      } else {
        restaurant =
          await prisma.restaurant.create({
            data: {
              name,
              address,
              city,
              latitude: restaurantLatitude,
              longitude: restaurantLongitude
            }
          });
      }

      savedRestaurants.push(restaurant);
    }

    res.json({
      success: true,
      radiusKm,
      center: {
        latitude,
        longitude
      },
      count: savedRestaurants.length,
      restaurants: savedRestaurants
    });

  } catch (error) {
    console.error(
      "Nearby restaurants error:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   BASIC RECOMMENDATION
========================================================= */

app.get("/api/recommend", async (req, res) => {
  try {
    const budget =
      Number(req.query.budget || 500);

    const vegetarian =
      String(req.query.vegetarian || "true")
        .toLowerCase() === "true";

    const maxDistanceKm =
      Number(req.query.distanceKm || 10);

    const latitude =
      req.query.latitude
        ? Number(req.query.latitude)
        : null;

    const longitude =
      req.query.longitude
        ? Number(req.query.longitude)
        : null;

    const dishes =
      await prisma.dish.findMany({
        include: {
          restaurant: true,
          signals: true
        }
      });

    const filtered =
      dishes.filter((dish) => {

        if (
          vegetarian &&
          !dish.isVeg
        ) {
          return false;
        }

        if (
          dish.price !== null &&
          dish.price > budget
        ) {
          return false;
        }

        if (
          latitude !== null &&
          longitude !== null &&
          dish.restaurant.latitude !== null &&
          dish.restaurant.longitude !== null
        ) {
          const distance =
            calculateDistanceKm(
              latitude,
              longitude,
              dish.restaurant.latitude,
              dish.restaurant.longitude
            );

          if (distance > maxDistanceKm) {
            return false;
          }
        }

        return true;
      });

    const scored =
      filtered.map((dish) => {

        const signal =
          dish.signals &&
          dish.signals.length > 0
            ? dish.signals[0]
            : null;

        let score = 0;

        if (
          dish.price !== null &&
          dish.price <= budget
        ) {
          score += 20;
        }

        if (dish.isVeg === vegetarian) {
          score += 20;
        }

        if (signal) {
          if (signal.rating) {
            score += signal.rating * 10;
          }

          if (signal.popularity) {
            score += signal.popularity * 0.2;
          }

          if (signal.confidence) {
            score += signal.confidence * 10;
          }
        }

        return {
          ...dish,
          score
        };
      });

    scored.sort(
      (a, b) => b.score - a.score
    );

    res.json({
      success: true,
      preferences: {
        budget,
        vegetarian,
        distanceKm: maxDistanceKm,
        latitude,
        longitude
      },
      recommendations:
        scored.slice(0, 10)
    });

  } catch (error) {
    console.error(
      "Recommendation error:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   PREFERENCES TEST
========================================================= */

app.get("/api/preferences-test", async (req, res) => {
  try {
    const preferences = {
      taste:
        req.query.taste || "not specified",

      cuisine:
        req.query.cuisine || "not specified",

      mood:
        req.query.mood || "not specified",

      budget:
        req.query.budget
          ? Number(req.query.budget)
          : null,

      vegetarian:
        req.query.vegetarian === undefined
          ? null
          : String(req.query.vegetarian)
              .toLowerCase() === "true"
    };

    res.json({
      success: true,
      message:
        "Preferences received successfully.",
      preferences
    });

  } catch (error) {
    console.error(
      "Preferences test error:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   GEMINI CONNECTION TEST
========================================================= */

app.get("/api/ai-test", async (req, res) => {
  try {
    const response =
      await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents:
          "Reply with exactly: SuggestDish AI is connected."
      });

    res.json({
      success: true,
      message:
        "Gemini is connected to SuggestDish.",
      response:
        response.text
    });

  } catch (error) {
    console.error(
      "Gemini test error:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   AI DISH RECOMMENDATION
========================================================= */

app.get("/api/ai-recommend", async (req, res) => {
  try {

    const taste =
      req.query.taste || "any";

    const cuisine =
      req.query.cuisine || "any";

    const mood =
      req.query.mood || "any";

    const budget =
      Number(req.query.budget || 500);

    const vegetarian =
      String(
        req.query.vegetarian || "false"
      ).toLowerCase() === "true";

    const dishes =
      await prisma.dish.findMany({
        include: {
          restaurant: true,
          signals: true
        }
      });

    if (dishes.length === 0) {
      return res.json({
        success: true,
        preferences: {
          taste,
          cuisine,
          mood,
          budget,
          vegetarian
        },
        recommendations: [],
        summary:
          "There are currently no dishes available in the database."
      });
    }

    const availableDishes =
      dishes.map((dish) => {

        const signal =
          dish.signals &&
          dish.signals.length > 0
            ? dish.signals[0]
            : null;

        return {
          dishName: dish.name,
          price: dish.price,
          vegetarian: dish.isVeg,
          restaurant: dish.restaurant.name,
          address: dish.restaurant.address,
          city: dish.restaurant.city,
          rating: signal?.rating ?? null,
          reviewCount:
            signal?.reviewCount ?? null,
          popularity:
            signal?.popularity ?? null,
          confidence:
            signal?.confidence ?? null
        };
      });

    const prompt = `
You are the AI recommendation engine for SuggestDish.

SuggestDish recommends SPECIFIC DISHES, not just restaurants.

User preferences:

Taste: ${taste}
Cuisine: ${cuisine}
Mood / occasion: ${mood}
Maximum budget: ₹${budget}
Vegetarian: ${vegetarian}

Available dishes from the SuggestDish database:

${JSON.stringify(
  availableDishes,
  null,
  2
)}

IMPORTANT RULES:

1. Recommend ONLY dishes from the available database.
2. Do not invent a dish.
3. Do not invent a restaurant.
4. Respect the user's vegetarian preference.
5. Prefer dishes within the user's budget.
6. Consider taste, cuisine and mood.
7. Use ratings, popularity and other signals when useful.
8. If there is only one suitable dish, recommend it.
9. Return valid JSON only.
10. Return at most 3 recommendations.

Use exactly this JSON structure:

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

    const response =
      await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt
      });

    const text =
      response.text || "";

    let parsed;

    try {
      const cleaned =
        text
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();

      parsed =
        JSON.parse(cleaned);

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
        vegetarian
      },

      recommendations:
        parsed.recommendations || [],

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


/* =========================================================
   DISTANCE CALCULATOR
========================================================= */

function calculateDistanceKm(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const earthRadiusKm = 6371;

  const dLat =
    toRadians(lat2 - lat1);

  const dLon =
    toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +

    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadiusKm * c;
}


function toRadians(degrees) {
  return degrees *
    (Math.PI / 180);
}


/* =========================================================
   PRISMA SHUTDOWN
========================================================= */

process.on(
  "SIGINT",
  async () => {

    await prisma.$disconnect();

    process.exit(0);

  }
);

process.on(
  "SIGTERM",
  async () => {

    await prisma.$disconnect();

    process.exit(0);

  }
);


/* =========================================================
   VERCEL EXPORT
========================================================= */

/* =========================================================
   START LOCAL SERVER / VERCEL EXPORT
========================================================= */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SuggestDish backend running at http://localhost:${PORT}`);
  });
}

module.exports = app;