require("dotenv").config();

const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

module.exports = async (req, res) => {
  try {
    const result = await sql`
      SELECT COUNT(*)::int AS count
      FROM "Restaurant"
    `;

    res.status(200).json({
      success: true,
      restaurantCount: result[0].count,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};