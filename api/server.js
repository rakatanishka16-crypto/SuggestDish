require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { neon } = require("@neondatabase/serverless");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());
app.use(express.json());

const sql = neon(process.env.DATABASE_URL);

const geminiApiKey = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
});

const PORT = process.env.PORT || 3000;


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
   AI TEST
========================================================= */

app.get("/api/ai-test", async (req, res) => {
  console.log(
    "GEMINI_API_KEY exists:",
    Boolean(process.env.GEMINI_API_KEY)
  );

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "GEMINI_API_KEY is missing in Vercel."
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


/* =========================================================
   AI RECOMMENDATION
========================================================= */

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

    const dishes = await sql`
      SELECT
        d.id,
        d.name,
        d.price,
        d."isVeg",
        r.name AS "restaurantName",
        r.address AS "restaurantAddress",
        r.city AS "restaurantCity"
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
          vegetarian
        },
        recommendations: [],
        summary: "No dishes currently match your budget."
      });
    }

    const filteredDishes = vegetarian
      ? dishes.filter((dish) => dish.isVeg === true)
      : dishes;

    const dishData = filteredDishes.map((dish) => ({
      dishName: dish.name,
      price: dish.price,
      vegetarian: dish.isVeg,
      restaurant: dish.restaurantName,
      address: dish.restaurantAddress,
      city: dish.restaurantCity
    }));

    const prompt = `
You are the AI recommendation engine for SuggestDish.

User preferences:
Taste: ${taste}
Cuisine: ${cuisine}
Mood: ${mood}
Budget: ₹${budget}
Vegetarian: ${vegetarian}

Available dishes from the database:
${JSON.stringify(dishData, null, 2)}

Recommend up to 3 dishes ONLY from the available database dishes.

Return ONLY valid JSON in this exact format:

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

Do not invent dishes or restaurants.
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
      console.error("Gemini JSON parse error:", parseError);
      console.error("Gemini raw response:", text);

      return res.status(500).json({
        success: false,
        error: "Gemini returned an invalid recommendation format.",
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
      recommendations: parsed.recommendations || [],
      summary: parsed.summary || ""
    });

  } catch (error) {
    console.error("AI recommendation error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   START LOCAL SERVER / VERCEL EXPORT
========================================================= */

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `SuggestDish backend running at http://localhost:${PORT}`
    );
  });
}

module.exports = app;