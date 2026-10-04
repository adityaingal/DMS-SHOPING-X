const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORTS = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  newest: { createdAt: -1 },
  popularity: { soldCount: -1, reviewCount: -1 },
  rating: { rating: -1, reviewCount: -1 },
};

const listProducts = asyncHandler(async (req, res) => {
  const {
    search,
    q,
    category,
    brand,
    minPrice,
    maxPrice,
    minRating,
    inStock,
    featured,
    onSale,
    sort = 'newest',
  } = req.query;

  let page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  let limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 48);

  const filter = {};
  const term = (search || q || '').trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ name: rx }, { brand: rx }, { category: rx }, { description: rx }];
  }
  if (category) filter.category = String(category).toLowerCase();
  if (brand) filter.brand = { $in: String(brand).split(',').map((b) => new RegExp(`^${escapeRegex(b.trim())}$`, 'i')) };
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined && !Number.isNaN(Number(minPrice))) filter.price.$gte = Number(minPrice);
    if (maxPrice !== undefined && !Number.isNaN(Number(maxPrice))) filter.price.$lte = Number(maxPrice);
  }
  if (minRating) filter.rating = { $gte: Number(minRating) };
  if (inStock === 'true') filter.stock = { $gt: 0 };
  if (featured === 'true') filter.featured = true;
  if (onSale === 'true') filter.discountPrice = { $ne: null };

  const mongoSort = SORTS[sort] || SORTS.newest;
  const total = await Product.countDocuments(filter);
  const pages = Math.max(Math.ceil(total / limit), 1);
  if (page > pages) page = pages;

  const products = await Product.find(filter)
    .sort(mongoSort)
    .skip((page - 1) * limit)
    .limit(limit);

  sendSuccess(res, products, 200, { pagination: { page, pages, total, limit } });
});

const productMeta = asyncHandler(async (req, res) => {
  const brands = await Product.distinct('brand');
  const prices = await Product.aggregate([
    { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
  ]);
  sendSuccess(res, {
    brands: brands.sort(),
    priceRange: prices[0] ? { min: Math.floor(prices[0].min), max: Math.ceil(prices[0].max) } : { min: 0, max: 100000 },
  });
});

const featuredProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 8, 24);
  const products = await Product.find({ featured: true }).sort({ createdAt: -1 }).limit(limit);
  sendSuccess(res, products);
});

const searchProducts = asyncHandler(async (req, res) => {
  req.query.search = req.query.q || req.query.search || '';
  return listProducts(req, res, () => {});
});

const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid product id.', 400);
  const product = await Product.findById(id);
  if (!product) throw new AppError('Product not found.', 404);
  sendSuccess(res, product);
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: String(req.params.slug).toLowerCase() });
  if (!product) throw new AppError('Product not found.', 404);
  sendSuccess(res, product);
});

const getRelatedProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid product id.', 400);
  const product = await Product.findById(id);
  if (!product) throw new AppError('Product not found.', 404);
  const related = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
  })
    .sort({ rating: -1 })
    .limit(4);
  sendSuccess(res, related);
});

const getReviews = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid product id.', 400);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

  const total = await Review.countDocuments({ product: id });
  const reviews = await Review.find({ product: id })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('user', 'name');

  const stats = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(id) } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
  ]);

  sendSuccess(res, reviews, 200, {
    pagination: { page, pages: Math.max(Math.ceil(total / limit), 1), total, limit },
    stats: stats.map((s) => ({ rating: s._id, count: s.count })),
  });
});

const createReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid product id.', 400);

  const product = await Product.findById(id);
  if (!product) throw new AppError('Product not found.', 404);

  const purchased = await Order.findOne({
    user: req.user._id,
    orderStatus: { $ne: 'Cancelled' },
    'items.product': product._id,
  });
  if (!purchased) {
    throw new AppError('Only customers who purchased this product can review it.', 403);
  }

  const existing = await Review.findOne({ product: product._id, user: req.user._id });
  if (existing) throw new AppError('You have already reviewed this product.', 409);

  const review = await Review.create({
    user: req.user._id,
    product: product._id,
    rating: req.body.rating,
    comment: req.body.comment || '',
  });

  await recalcProductRating(product._id);
  const populated = await Review.findById(review._id).populate('user', 'name');
  sendSuccess(res, populated, 201);
});

const recalcProductRating = async (productId) => {
  const [agg] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)) } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.findByIdAndUpdate(productId, {
    rating: agg ? Math.round(agg.avg * 10) / 10 : 0,
    reviewCount: agg ? agg.count : 0,
  });
};

module.exports = {
  listProducts,
  productMeta,
  featuredProducts,
  searchProducts,
  getProductById,
  getProductBySlug,
  getRelatedProducts,
  getReviews,
  createReview,
  recalcProductRating,
};
