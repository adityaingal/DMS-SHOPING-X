const mongoose = require('mongoose');
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

const getWishlist = asyncHandler(async (req, res) => {
  let list = await Wishlist.findOne({ user: req.user._id }).populate({
    path: 'items.product',
    select: 'name slug price discountPrice images stock category brand rating reviewCount',
  });
  if (!list) list = await Wishlist.create({ user: req.user._id, items: [] });

  const items = list.items
    .filter((i) => i.product)
    .map((i) => ({ _id: i._id, addedAt: i.addedAt, product: i.product }));
  sendSuccess(res, { items, count: items.length });
});

const addItem = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  if (!mongoose.isValidObjectId(productId)) throw new AppError('Invalid product id.', 400);

  const product = await Product.findById(productId);
  if (!product) throw new AppError('Product not found.', 404);

  let list = await Wishlist.findOne({ user: req.user._id });
  if (!list) list = await Wishlist.create({ user: req.user._id, items: [] });

  if (list.items.some((i) => String(i.product) === String(productId))) {
    throw new AppError('Product is already in your wishlist.', 409);
  }

  list.items.push({ product: productId });
  await list.save();
  sendSuccess(res, { count: list.items.length, productId }, 201);
});

const removeItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) throw new AppError('Invalid product id.', 400);

  const list = await Wishlist.findOne({ user: req.user._id });
  if (!list) throw new AppError('Wishlist not found.', 404);

  list.items = list.items.filter((i) => String(i.product) !== String(productId));
  await list.save();
  sendSuccess(res, { count: list.items.length, productId });
});

module.exports = { getWishlist, addItem, removeItem };
