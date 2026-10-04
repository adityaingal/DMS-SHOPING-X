const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const User = require('../models/User');
const Review = require('../models/Review');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { markCancelled } = require('./orderController');
const { recalcProductRating } = require('./productController');
const orderEventService = require('../services/orderEventService');
const slugify = require('../utils/slugify');

const emitSafe = (promise) => {
  if (promise && typeof promise.catch === 'function') {
    promise.catch((err) => console.error('[notifications] event failed:', err && err.message));
  }
};

const ALLOWED_STATUS_FLOW = {
  Pending: ['Confirmed', 'Processing', 'Shipped', 'Cancelled'],
  Confirmed: ['Processing', 'Shipped', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

const parseNum = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
};

const parseBool = (value) => value === true || value === 'true';

const getDashboard = asyncHandler(async (req, res) => {
  const [totalProducts, totalCustomers, totalOrders, lowStock, statusAgg, revenueAgg, recentOrders] =
    await Promise.all([
      Product.countDocuments(),
      User.countDocuments({ role: 'customer' }),
      Order.countDocuments(),
      Product.find({ stock: { $lte: 5 } }).select('name stock price images').sort({ stock: 1 }).limit(8),
      Order.aggregate([{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { orderStatus: { $ne: 'Cancelled' }, $or: [{ paymentStatus: 'paid' }, { orderStatus: 'Delivered' }] } },
        { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      Order.find().sort({ createdAt: -1 }).limit(6).populate('user', 'name email'),
    ]);

  const days = 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dailyRaw = await Order.aggregate([
    { $match: { createdAt: { $gte: since }, orderStatus: { $ne: 'Cancelled' } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        sales: { $sum: '$total' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const salesChart = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const found = dailyRaw.find((r) => r._id === key);
    salesChart.push({ date: key, sales: found ? found.sales : 0, orders: found ? found.orders : 0 });
  }

  const byStatus = Object.fromEntries(statusAgg.map((s) => [s._id, s.count]));

  sendSuccess(res, {
    totals: {
      products: totalProducts,
      customers: totalCustomers,
      orders: totalOrders,
      revenue: revenueAgg[0] ? revenueAgg[0].revenue : 0,
      paidOrders: revenueAgg[0] ? revenueAgg[0].count : 0,
    },
    byStatus,
    lowStock,
    recentOrders,
    salesChart,
  });
});

const listAdminProducts = asyncHandler(async (req, res) => {
  const { search = '', category, stock } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

  const filter = {};
  if (search.trim()) filter.name = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (category) filter.category = String(category).toLowerCase();
  if (stock === 'low') filter.stock = { $lte: 5 };
  if (stock === 'out') filter.stock = { $lte: 0 };
  if (stock === 'in') filter.stock = { $gt: 0 };

  const total = await Product.countDocuments(filter);
  const products = await Product.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  sendSuccess(res, products, 200, {
    pagination: { page, pages: Math.max(Math.ceil(total / limit), 1), total, limit },
  });
});

const extractImages = (body, files) => {
  const fromFiles = (files || []).map((f) => `/uploads/${f.filename}`);
  let fromBody = body.images;
  if (typeof fromBody === 'string') {
    try {
      fromBody = JSON.parse(fromBody);
    } catch (e) {
      fromBody = fromBody ? [fromBody] : [];
    }
  }
  if (!Array.isArray(fromBody)) fromBody = fromBody ? [fromBody] : [];
  const urls = fromBody.map((u) => String(u).trim()).filter(Boolean);
  return [...urls, ...fromFiles].slice(0, 6);
};

const createProduct = asyncHandler(async (req, res) => {
  const { name, description, category, brand } = req.body;
  const price = parseNum(req.body.price);
  const discountPrice = parseNum(req.body.discountPrice);
  const stock = parseNum(req.body.stock, 0);
  const images = extractImages(req.body, req.files);

  if (!name || !description || !category || !brand || price === null) {
    throw new AppError('Name, description, price, category and brand are required.', 422);
  }

  const product = await Product.create({
    name,
    description,
    price,
    discountPrice: discountPrice && discountPrice < price ? discountPrice : null,
    stock: Math.max(stock, 0),
    category: slugify(category),
    brand,
    images,
    featured: parseBool(req.body.featured),
  });

  sendSuccess(res, product, 201);
});

const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid product id.', 400);

  const product = await Product.findById(id);
  if (!product) throw new AppError('Product not found.', 404);

  const fields = ['name', 'description', 'brand'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) product[f] = req.body[f];
  });
  if (req.body.price !== undefined) {
    const price = parseNum(req.body.price);
    if (price === null || price < 0) throw new AppError('Price must be a positive number.', 422);
    product.price = price;
  }
  if (req.body.discountPrice !== undefined) {
    const dp = parseNum(req.body.discountPrice, null);
    if (dp !== null && dp >= product.price) throw new AppError('Discount price must be lower than the price.', 422);
    product.discountPrice = dp;
  }
  if (req.body.stock !== undefined) {
    const stock = parseNum(req.body.stock);
    if (stock === null || stock < 0) throw new AppError('Stock must be zero or more.', 422);
    product.stock = stock;
  }
  if (req.body.category !== undefined) product.category = slugify(req.body.category);
  if (req.body.featured !== undefined) product.featured = parseBool(req.body.featured);

  const files = req.files || [];
  if (req.body.images !== undefined || files.length) {
    if (req.body.images !== undefined) {
      const images = extractImages(req.body, files);
      if (images.length) product.images = images;
    } else {
      product.images = [...product.images, ...files.map((f) => `/uploads/${f.filename}`)].slice(0, 6);
    }
  }

  await product.save();
  sendSuccess(res, product);
});

const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid product id.', 400);
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw new AppError('Product not found.', 404);
  sendSuccess(res, { id, message: 'Product deleted.' });
});

const listAdminOrders = asyncHandler(async (req, res) => {
  const { search = '', status, payment } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

  const filter = {};
  if (search.trim()) {
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ orderNumber: rx }, { 'shippingAddress.fullName': rx }, { 'shippingAddress.email': rx }];
  }
  if (status) filter.orderStatus = status;
  if (payment) filter.paymentStatus = payment;

  const total = await Order.countDocuments(filter);
  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('user', 'name email');

  sendSuccess(res, orders, 200, {
    pagination: { page, pages: Math.max(Math.ceil(total / limit), 1), total, limit },
  });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid order id.', 400);

  const order = await Order.findById(id);
  if (!order) throw new AppError('Order not found.', 404);

  const { orderStatus, paymentStatus, note = '' } = req.body;
  const previousPayment = order.paymentStatus;

  if (orderStatus) {
    const allowed = ALLOWED_STATUS_FLOW[order.orderStatus] || [];
    if (!allowed.includes(orderStatus)) {
      throw new AppError(`Cannot change order status from ${order.orderStatus} to ${orderStatus}.`, 409);
    }
    if (orderStatus === 'Cancelled') {
      await markCancelled(order, 'admin', note);
      const updated = await Order.findById(id).populate('user', 'name email');
      return sendSuccess(res, updated);
    }
    order.orderStatus = orderStatus;
    order.statusHistory.push({ status: orderStatus, at: new Date(), by: 'admin', note });
    if (orderStatus === 'Delivered' && order.paymentStatus === 'pending') {
      order.paymentStatus = 'paid';
    }
  }

  if (paymentStatus) {
    if (!['pending', 'paid', 'failed', 'refunded'].includes(paymentStatus)) {
      throw new AppError('Invalid payment status.', 422);
    }
    order.paymentStatus = paymentStatus;
  }

  await order.save();
  if (orderStatus) {
    emitSafe(orderEventService.emitStatusChange(order, { status: orderStatus, by: 'admin', note, at: new Date() }));
  }
  if (order.paymentStatus !== previousPayment) {
    emitSafe(
      orderEventService.emitPaymentChange(order, {
        from: previousPayment,
        to: order.paymentStatus,
        at: new Date(),
      })
    );
  }
  const updated = await Order.findById(id).populate('user', 'name email');
  sendSuccess(res, updated);
});

const listCustomers = asyncHandler(async (req, res) => {
  const { search = '' } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

  const filter = { role: 'customer' };
  if (search.trim()) {
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const total = await User.countDocuments(filter);
  const customers = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select('name email phone createdAt isActive');

  const ids = customers.map((c) => c._id);
  const stats = await Order.aggregate([
    { $match: { user: { $in: ids } } },
    { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: '$total' } } },
  ]);
  const statMap = Object.fromEntries(stats.map((s) => [String(s._id), s]));

  sendSuccess(
    res,
    customers.map((c) => ({
      ...c.toJSON(),
      orderCount: statMap[String(c._id)]?.orders || 0,
      totalSpent: statMap[String(c._id)]?.spent || 0,
    })),
    200,
    { pagination: { page, pages: Math.max(Math.ceil(total / limit), 1), total, limit } }
  );
});

const getCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid customer id.', 400);
  const customer = await User.findById(id).select('-passwordHash');
  if (!customer) throw new AppError('Customer not found.', 404);
  const orders = await Order.find({ user: id }).sort({ createdAt: -1 }).limit(20);
  sendSuccess(res, { customer, orders });
});

const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  sendSuccess(res, categories);
});

const createCategory = asyncHandler(async (req, res) => {
  const { name, description = '', image = '' } = req.body;
  if (!name) throw new AppError('Category name is required.', 422);
  const exists = await Category.findOne({ slug: slugify(name) });
  if (exists) throw new AppError('A category with this name already exists.', 409);
  const category = await Category.create({ name, description, image });
  sendSuccess(res, category, 201);
});

const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid category id.', 400);
  const category = await Category.findById(id);
  if (!category) throw new AppError('Category not found.', 404);
  ['name', 'description', 'image', 'isActive'].forEach((f) => {
    if (req.body[f] !== undefined) category[f] = req.body[f];
  });
  await category.save();
  sendSuccess(res, category);
});

const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid category id.', 400);
  const category = await Category.findById(id);
  if (!category) throw new AppError('Category not found.', 404);
  const inUse = await Product.countDocuments({ category: category.slug });
  if (inUse > 0) throw new AppError(`Category is used by ${inUse} product(s). Reassign them first.`, 409);
  await category.deleteOne();
  sendSuccess(res, { id, message: 'Category deleted.' });
});

const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid review id.', 400);
  const review = await Review.findByIdAndDelete(id);
  if (!review) throw new AppError('Review not found.', 404);
  await recalcProductRating(review.product);
  sendSuccess(res, { id, message: 'Review removed.' });
});

module.exports = {
  getDashboard,
  listAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  listAdminOrders,
  updateOrderStatus,
  listCustomers,
  getCustomer,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  deleteReview,
};
