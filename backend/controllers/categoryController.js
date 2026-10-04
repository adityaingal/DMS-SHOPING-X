const Category = require('../models/Category');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  const counts = await Product.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  sendSuccess(
    res,
    categories.map((c) => ({ ...c.toJSON(), productCount: map[c.slug] || 0 }))
  );
});

const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: String(req.params.slug).toLowerCase() });
  if (!category) throw new AppError('Category not found.', 404);
  const productCount = await Product.countDocuments({ category: category.slug });
  sendSuccess(res, { ...category.toJSON(), productCount });
});

module.exports = { listCategories, getCategoryBySlug };
