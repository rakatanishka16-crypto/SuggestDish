const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

module.exports = async (req, res) => {
  try {
    const count = await prisma.restaurant.count();

    res.status(200).json({
      success: true,
      restaurantCount: count
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
};