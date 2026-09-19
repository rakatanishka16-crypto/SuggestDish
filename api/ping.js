module.exports = (req, res) => {
  res.status(200).json({
    success: true,
    message: "SuggestDish Vercel API is working!"
  });
};