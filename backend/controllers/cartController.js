const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { computeSubtotal, computeShipping } = require('../services/pricing');

const MAX_QTY = 99;

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

const shapeCart = async (cart) => {
  const productIds = cart.items.map((i) => i.product);
  const products = await Product.find({ _id: { $in: productIds } });
  const map = new Map(products.map((p) => [String(p._id), p]));

  const items = [];
  const removed = [];

  cart.items.forEach((item) => {
    const p = map.get(String(item.product));
    if (!p) {
      removed.push(item._id);
      return;
    }
    const unitPrice = p.discountPrice != null ? p.discountPrice : p.price;
    const quantity = Math.min(item.quantity, p.stock > 0 ? Math.min(p.stock, MAX_QTY) : item.quantity);
    items.push({
      _id: item._id,
      product: {
        id: p._id,
        name: p.name,
        slug: p.slug,
        image: p.images[0] || '',
        price: p.price,
        discountPrice: p.discountPrice,
        stock: p.stock,
        category: p.category,
        brand: p.brand,
      },
      quantity,
      unitPrice,
      lineTotal: Number((unitPrice * quantity).toFixed(2)),
      inStock: p.stock > 0,
      maxQuantity: Math.min(p.stock, MAX_QTY),
    });
  });

  if (removed.length) {
    cart.items = cart.items.filter((i) => !removed.includes(i._id));
    await cart.save();
  }

  const entries = items.map((i) => ({ lineTotal: i.lineTotal }));
  const subtotal = computeSubtotal(entries);
  const shippingFee = computeShipping(subtotal);

  return {
    _id: cart._id,
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal,
    shippingFee,
    discount: 0,
    total: Number((subtotal + shippingFee).toFixed(2)),
    updatedAt: cart.updatedAt,
  };
};

const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  sendSuccess(res, await shapeCart(cart));
});

const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!mongoose.isValidObjectId(productId)) throw new AppError('Invalid product id.', 400);

  const product = await Product.findById(productId);
  if (!product) throw new AppError('Product not found.', 404);
  if (product.stock <= 0) throw new AppError('This product is out of stock.', 409);

  const qty = Math.max(1, Math.min(parseInt(quantity, 10) || 1, MAX_QTY));
  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((i) => String(i.product) === String(productId));

  const newQty = (existing ? existing.quantity : 0) + qty;
  if (newQty > product.stock) {
    throw new AppError(`Only ${product.stock} unit(s) of this product are available.`, 409);
  }

  if (existing) existing.quantity = newQty;
  else cart.items.push({ product: productId, quantity: qty });

  await cart.save();
  sendSuccess(res, await shapeCart(cart), existing ? 200 : 201);
});

const updateItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;
  if (!mongoose.isValidObjectId(itemId)) throw new AppError('Invalid cart item id.', 400);

  const qty = parseInt(quantity, 10);
  if (Number.isNaN(qty) || qty < 1) throw new AppError('Quantity must be at least 1.', 422);

  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.id(itemId);
  if (!item) throw new AppError('Item not found in your cart.', 404);

  const product = await Product.findById(item.product);
  if (!product) throw new AppError('This product is no longer available.', 404);
  if (qty > product.stock) throw new AppError(`Only ${product.stock} unit(s) are available.`, 409);

  item.quantity = Math.min(qty, MAX_QTY);
  await cart.save();
  sendSuccess(res, await shapeCart(cart));
});

const removeItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  if (!mongoose.isValidObjectId(itemId)) throw new AppError('Invalid cart item id.', 400);

  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.id(itemId);
  if (!item) throw new AppError('Item not found in your cart.', 404);

  item.deleteOne();
  await cart.save();
  sendSuccess(res, await shapeCart(cart));
});

const mergeCart = asyncHandler(async (req, res) => {
  const { items = [] } = req.body;
  if (!Array.isArray(items)) throw new AppError('Invalid cart payload.', 422);

  const cart = await getOrCreateCart(req.user._id);

  for (const entry of items.slice(0, 50)) {
    if (!entry || !mongoose.isValidObjectId(entry.product)) continue;
    const product = await Product.findById(entry.product);
    if (!product || product.stock <= 0) continue;
    const qty = Math.max(1, Math.min(parseInt(entry.quantity, 10) || 1, MAX_QTY));
    const existing = cart.items.find((i) => String(i.product) === String(product._id));
    if (existing) existing.quantity = Math.min(existing.quantity + qty, product.stock, MAX_QTY);
    else cart.items.push({ product: product._id, quantity: Math.min(qty, product.stock) });
  }

  await cart.save();
  sendSuccess(res, await shapeCart(cart));
});

module.exports = { getCart, addItem, updateItem, removeItem, mergeCart };
