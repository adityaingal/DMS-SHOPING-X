const mongoose = require('mongoose');
const crypto = require('crypto');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { lineTotal, computeSubtotal, computeShipping, computeDiscount } = require('../services/pricing');
const orderEventService = require('../services/orderEventService');

const emitSafe = (promise) => {
  if (promise && typeof promise.catch === 'function') {
    promise.catch((err) => console.error('[notifications] event failed:', err && err.message));
  }
};

const generateOrderNumber = () =>
  `SHX-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const loadRequestedItems = async (items, fromCart) => {
  const entries = [];
  for (const entry of items) {
    if (!mongoose.isValidObjectId(entry.product)) {
      throw new AppError('One of the selected products is invalid.', 422);
    }
    const quantity = Math.max(1, Math.min(parseInt(entry.quantity, 10) || 1, 99));
    const product = await Product.findById(entry.product);
    if (!product) {
      if (fromCart) continue;
      throw new AppError('One of the selected products no longer exists.', 409);
    }
    if (product.stock < quantity) {
      throw new AppError(`Insufficient stock for "${product.name}". Only ${product.stock} left.`, 409);
    }
    entries.push({ product, quantity });
  }
  if (!entries.length) throw new AppError('Your cart is empty.', 422);
  return entries;
};

const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod = 'cod', promoCode, items: bodyItems } = req.body;

  const idempotencyKey = req.body.idempotencyKey ? String(req.body.idempotencyKey).trim().slice(0, 64) : '';
  if (idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey });
    if (existing) return sendSuccess(res, existing, 200);
  }

  if (shippingAddress && typeof shippingAddress !== 'object') {
    throw new AppError('Invalid shipping address.', 422);
  }
  const address = shippingAddress || {};
  if (!address.fullName || !address.phone || !address.line1 || !address.city || !address.state || !address.postalCode) {
    throw new AppError('Please provide a complete shipping address.', 422);
  }
  if (!['cod', 'test'].includes(paymentMethod)) {
    throw new AppError('Unsupported payment method.', 422);
  }

  let entries = [];
  let fromCart = false;

  if (Array.isArray(bodyItems) && bodyItems.length) {
    entries = await loadRequestedItems(bodyItems, false);
  } else {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart || !cart.items.length) throw new AppError('Your cart is empty.', 422);
    entries = await loadRequestedItems(cart.items.map((i) => ({ product: i.product, quantity: i.quantity })), true);
    fromCart = true;
  }

  const orderItems = entries.map(({ product, quantity }) => {
    const unitPrice = product.discountPrice != null ? product.discountPrice : product.price;
    return {
      product: product._id,
      name: product.name,
      slug: product.slug,
      image: (product.images && product.images[0]) || '',
      price: product.price,
      discountPrice: product.discountPrice,
      unitPrice,
      quantity,
      lineTotal: Number(lineTotal(product, quantity).toFixed(2)),
    };
  });

  const subtotal = computeSubtotal(orderItems.map((i) => ({ lineTotal: i.lineTotal })));
  let discount = 0;
  let appliedPromo = null;
  if (promoCode) {
    try {
      const result = computeDiscount(promoCode, subtotal);
      discount = result.discount;
      appliedPromo = result.promoCode;
    } catch (err) {
      throw new AppError(err.message, 422);
    }
  }
  const shippingFee = computeShipping(subtotal);
  const total = Number((subtotal + shippingFee - discount).toFixed(2));

  let order;
  try {
    order = await Order.create({
      orderNumber: generateOrderNumber(),
      user: req.user._id,
      items: orderItems,
      shippingAddress: {
        fullName: address.fullName,
        phone: address.phone,
        email: address.email || req.user.email,
        line1: address.line1,
        line2: address.line2 || '',
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        notes: address.notes || '',
      },
      subtotal,
      shippingFee,
      discount,
      total,
      promoCode: appliedPromo,
      paymentMethod,
      paymentStatus: paymentMethod === 'test' ? 'paid' : 'pending',
      isSandboxPayment: paymentMethod === 'test',
      orderStatus: 'Confirmed',
      statusHistory: [{ status: 'Confirmed', at: new Date(), by: 'customer', note: 'Order placed' }],
      idempotencyKey: idempotencyKey || null,
    });
  } catch (err) {
    if (err && err.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({ idempotencyKey });
      if (existing) return sendSuccess(res, existing, 200);
    }
    throw err;
  }

  const decremented = [];
  try {
    for (const item of orderItems) {
      const result = await Product.updateOne(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity, soldCount: item.quantity } }
      );
      if (result.modifiedCount === 0) {
        throw new AppError(`Stock changed for "${item.name}". Please try again.`, 409);
      }
      decremented.push({ id: item.product, qty: item.quantity });
    }
  } catch (err) {
    for (const d of decremented) {
      await Product.updateOne({ _id: d.id }, { $inc: { stock: d.qty, soldCount: -d.qty } });
    }
    await Order.deleteOne({ _id: order._id });
    throw err;
  }

  if (fromCart) await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });

  emitSafe(orderEventService.emitOrderCreated(order));

  const populated = await Order.findById(order._id).populate('user', 'name email');
  sendSuccess(res, populated, 201);
});

const getMyOrders = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const filter = { user: req.user._id };
  if (req.query.status) filter.orderStatus = req.query.status;

  const total = await Order.countDocuments(filter);
  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  sendSuccess(res, orders, 200, {
    pagination: { page, pages: Math.max(Math.ceil(total / limit), 1), total, limit },
  });
});

const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid order id.', 400);

  const order = await Order.findById(id).populate('user', 'name email role');
  if (!order) throw new AppError('Order not found.', 404);

  const isOwner = String(order.user?._id || order.user) === String(req.user._id);
  if (!isOwner && req.user.role !== 'admin') {
    throw new AppError('You are not allowed to view this order.', 403);
  }
  sendSuccess(res, order);
});

const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid order id.', 400);

  const order = await Order.findById(id);
  if (!order) throw new AppError('Order not found.', 404);
  if (String(order.user) !== String(req.user._id)) {
    throw new AppError('You are not allowed to modify this order.', 403);
  }
  if (order.orderStatus !== 'Pending' && order.orderStatus !== 'Confirmed') {
    throw new AppError('Only pending orders can be cancelled.', 409);
  }

  await markCancelled(order, 'customer');
  sendSuccess(res, await Order.findById(id));
});

const markCancelled = async (order, by, note = '') => {
  for (const item of order.items) {
    if (item.product) {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity, soldCount: -item.quantity } }
      );
    }
  }
  order.orderStatus = 'Cancelled';
  if (order.paymentStatus === 'paid' || order.isSandboxPayment) {
    order.paymentStatus = 'refunded';
  }
  order.statusHistory.push({ status: 'Cancelled', at: new Date(), by, note });
  await order.save();
  emitSafe(orderEventService.emitStatusChange(order, { status: 'Cancelled', by, note, at: new Date() }));
  return order;
};

module.exports = { createOrder, getMyOrders, getOrderById, cancelOrder, markCancelled, generateOrderNumber };
