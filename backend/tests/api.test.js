process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shopx_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'shopx_test_secret_key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.COOKIE_SECURE = 'false';
process.env.RATE_LIMIT_MAX = '100000';
process.env.RATE_LIMIT_WINDOW_MS = '900000';

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = require('../app');
const connectDB = require('../config/db');
const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Cart = require('../models/Cart');

const ADMIN = { name: 'Test Admin', email: 'admin@test.com', password: 'Admin@12345' };
const CUSTOMER = { name: 'Test Customer', email: 'customer@test.com', password: 'Customer@12345' };

let adminToken;
let customerToken;
let testProductId;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await connectDB(process.env.MONGODB_URI);
  await Promise.all([
    User.deleteMany({}),
    Product.deleteMany({}),
    Category.deleteMany({}),
    Order.deleteMany({}),
    Review.deleteMany({}),
    Cart.deleteMany({}),
  ]);

  await User.create({
    name: ADMIN.name,
    email: ADMIN.email,
    passwordHash: await bcrypt.hash(ADMIN.password, 10),
    role: 'admin',
  });

  await Category.create({ name: 'Electronics', slug: 'electronics', description: 'Test category' });

  const product = await Product.create({
    name: 'Test Wireless Headphones',
    description: 'Great sound, long battery life.',
    price: 2999,
    discountPrice: 2499,
    category: 'electronics',
    brand: 'TestBrand',
    stock: 5,
    images: ['https://example.com/headphones.jpg'],
    featured: true,
  });
  testProductId = String(product._id);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.connection.close();
});

describe('Authentication', () => {
  test('registers a new customer', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: CUSTOMER.name,
      email: CUSTOMER.email,
      password: CUSTOMER.password,
      confirmPassword: CUSTOMER.password,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(CUSTOMER.email);
    expect(res.body.data.user.role).toBe('customer');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.token).toBeTruthy();
    customerToken = res.body.data.token;
  });

  test('rejects duplicate email registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Another Person',
      email: CUSTOMER.email,
      password: 'Whatever@123',
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('rejects weak password registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Weak User',
      email: 'weak@test.com',
      password: 'short',
    });
    expect(res.status).toBe(422);
  });

  test('logs in with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: CUSTOMER.email,
      password: CUSTOMER.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(CUSTOMER.email);
    expect(res.body.data.token).toBeTruthy();
  });

  test('rejects invalid credentials with a generic message', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: CUSTOMER.email,
      password: 'WrongPassword@1',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  test('returns the logged-in user from /me', async () => {
    const res = await request(app).get('/api/auth/me').set(auth(customerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(CUSTOMER.email);
  });

  test('rejects access to protected routes without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('admin can log in', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: ADMIN.email,
      password: ADMIN.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('admin');
    adminToken = res.body.data.token;
  });
});

describe('Products API', () => {
  test('lists products with pagination', async () => {
    const res = await request(app).get('/api/products?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination.pages).toBeGreaterThanOrEqual(1);
  });

  test('filters by category', async () => {
    const res = await request(app).get('/api/products?category=electronics');
    expect(res.status).toBe(200);
    expect(res.body.data.every((p) => p.category === 'electronics')).toBe(true);
  });

  test('filters on-sale products', async () => {
    const res = await request(app).get('/api/products?onSale=true');
    expect(res.status).toBe(200);
    expect(res.body.data.every((p) => p.discountPrice != null)).toBe(true);
  });

  test('sorts by price ascending', async () => {
    const res = await request(app).get('/api/products?sort=price_asc');
    expect(res.status).toBe(200);
    const prices = res.body.data.map((p) => p.price);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  test('searches by keyword', async () => {
    const res = await request(app).get('/api/products/search?q=headphones');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].name.toLowerCase()).toContain('headphones');
  });

  test('returns empty result set for no matches', async () => {
    const res = await request(app).get('/api/products/search?q=zzzznotfoundzzzz');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  test('fetches a product by slug', async () => {
    const list = await request(app).get('/api/products?limit=1');
    const slug = list.body.data[0].slug;
    const res = await request(app).get(`/api/products/slug/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe(slug);
  });

  test('returns 404 for unknown product id', async () => {
    const res = await request(app).get('/api/products/64b000000000000000000000');
    expect(res.status).toBe(404);
  });
});

describe('Cart operations', () => {
  test('rejects anonymous cart access', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(401);
  });

  test('adds a product to the cart', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set(auth(customerToken))
      .send({ productId: testProductId, quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.data.itemCount).toBe(2);
    expect(res.body.data.subtotal).toBe(4998);
  });

  test('computes shipping server-side (free above ₹999)', async () => {
    const res = await request(app).get('/api/cart').set(auth(customerToken));
    expect(res.body.data.shippingFee).toBe(0);
    expect(res.body.data.total).toBe(res.body.data.subtotal);
  });

  test('updates item quantity', async () => {
    const list = await request(app).get('/api/cart').set(auth(customerToken));
    const itemId = list.body.data.items[0]._id;
    const res = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set(auth(customerToken))
      .send({ quantity: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data.items[0].quantity).toBe(3);
  });

  test('rejects quantities beyond available stock', async () => {
    const list = await request(app).get('/api/cart').set(auth(customerToken));
    const itemId = list.body.data.items[0]._id;
    const res = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set(auth(customerToken))
      .send({ quantity: 99 });
    expect(res.status).toBe(409);
  });

  test('removes an item from the cart', async () => {
    const list = await request(app).get('/api/cart').set(auth(customerToken));
    const itemId = list.body.data.items[0]._id;
    const res = await request(app).delete(`/api/cart/items/${itemId}`).set(auth(customerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });
});

describe('Order placement', () => {
  test('rejects checkout with an empty cart', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(customerToken))
      .send({
        shippingAddress: {
          fullName: 'Test Customer',
          phone: '9876543210',
          line1: '12 Test Street',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
        paymentMethod: 'cod',
      });
    expect(res.status).toBe(422);
  });

  test('rejects incomplete shipping address', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(customerToken))
      .send({ shippingAddress: { fullName: 'X' }, paymentMethod: 'cod' });
    expect(res.status).toBe(422);
  });

  test('creates an order, decrements stock and clears the cart', async () => {
    await request(app)
      .post('/api/cart/items')
      .set(auth(customerToken))
      .send({ productId: testProductId, quantity: 2 });

    const before = await Product.findById(testProductId);

    const res = await request(app)
      .post('/api/orders')
      .set(auth(customerToken))
      .send({
        shippingAddress: {
          fullName: 'Test Customer',
          phone: '9876543210',
          line1: '12 Test Street',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          notes: 'Leave at the door',
        },
        paymentMethod: 'test',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.orderNumber).toMatch(/^SHX-/);
    expect(res.body.data.items[0].unitPrice).toBe(2499);
    expect(res.body.data.subtotal).toBe(4998);
    expect(res.body.data.shippingFee).toBe(0);
    expect(res.body.data.total).toBe(4998);
    expect(res.body.data.paymentStatus).toBe('paid');
    expect(res.body.data.isSandboxPayment).toBe(true);
    expect(res.body.data.orderStatus).toBe('Confirmed');

    const after = await Product.findById(testProductId);
    expect(after.stock).toBe(before.stock - 2);

    const cart = await Cart.findOne({ user: res.body.data.user });
    expect(cart.items.length).toBe(0);
  });

  test('applies a valid promo code server-side', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(customerToken))
      .send({
        items: [{ product: testProductId, quantity: 1 }],
        shippingAddress: {
          fullName: 'Test Customer',
          phone: '9876543210',
          line1: '12 Test Street',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
        paymentMethod: 'cod',
        promoCode: 'WELCOME10',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.discount).toBe(250);
    expect(res.body.data.shippingFee).toBe(0);
    expect(res.body.data.total).toBe(2499 - 250);
    expect(res.body.data.paymentStatus).toBe('pending');
  });

  test('rejects an invalid promo code', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(customerToken))
      .send({
        items: [{ product: testProductId, quantity: 1 }],
        shippingAddress: {
          fullName: 'Test Customer',
          phone: '9876543210',
          line1: '12 Test Street',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
        paymentMethod: 'cod',
        promoCode: 'NOPE999',
      });
    expect(res.status).toBe(422);
  });

  test('rejects ordering beyond stock', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(customerToken))
      .send({
        items: [{ product: testProductId, quantity: 99 }],
        shippingAddress: {
          fullName: 'Test Customer',
          phone: '9876543210',
          line1: '12 Test Street',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
        paymentMethod: 'cod',
      });
    expect(res.status).toBe(409);
  });

  test('returns the customer order history and details', async () => {
    const list = await request(app).get('/api/orders/my-orders').set(auth(customerToken));
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(2);

    const orderId = list.body.data[0]._id;
    const detail = await request(app).get(`/api/orders/${orderId}`).set(auth(customerToken));
    expect(detail.status).toBe(200);
    expect(detail.body.data.shippingAddress.city).toBe('Bengaluru');
  });

  test('prevents viewing another customer order', async () => {
    const other = await User.create({
      name: 'Other User',
      email: 'other@test.com',
      passwordHash: await bcrypt.hash('Other@12345', 10),
      role: 'customer',
    });
    const otherToken = (
      await request(app).post('/api/auth/login').send({ email: other.email, password: 'Other@12345' })
    ).body.data.token;

    const list = await request(app).get('/api/orders/my-orders').set(auth(customerToken));
    const res = await request(app).get(`/api/orders/${list.body.data[0]._id}`).set(auth(otherToken));
    expect(res.status).toBe(403);
  });

  test('allows cancelling a confirmed order and restocks products', async () => {
    const list = await request(app).get('/api/orders/my-orders').set(auth(customerToken));
    const order = list.body.data.find((o) => o.orderStatus === 'Confirmed');
    expect(order).toBeTruthy();

    const before = await Product.findById(testProductId);
    const res = await request(app).patch(`/api/orders/${order._id}/cancel`).set(auth(customerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe('Cancelled');

    const after = await Product.findById(testProductId);
    expect(after.stock).toBe(before.stock + order.items[0].quantity);
  });
});

describe('Admin authorization and management', () => {
  test('blocks non-admin users from admin endpoints', async () => {
    const res = await request(app).get('/api/admin/dashboard').set(auth(customerToken));
    expect(res.status).toBe(403);
  });

  test('blocks anonymous access to admin endpoints', async () => {
    const res = await request(app).get('/api/admin/products');
    expect(res.status).toBe(401);
  });

  test('serves the admin dashboard data', async () => {
    const res = await request(app).get('/api/admin/dashboard').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.totals.products).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totals.orders).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.data.salesChart)).toBe(true);
    expect(res.body.data.salesChart.length).toBe(7);
  });

  test('admin can create a product', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set(auth(adminToken))
      .send({
        name: 'Admin Created Gadget',
        description: 'Created by the admin API test.',
        price: 1500,
        discountPrice: 1200,
        stock: 10,
        category: 'Electronics',
        brand: 'GadgetName',
        featured: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toContain('admin-created-gadget');
    expect(res.body.data.category).toBe('electronics');
  });

  test('admin can update price and stock', async () => {
    const list = await request(app).get('/api/admin/products?search=Admin Created').set(auth(adminToken));
    const id = list.body.data[0]._id;
    const res = await request(app)
      .patch(`/api/admin/products/${id}`)
      .set(auth(adminToken))
      .send({ price: 1750, discountPrice: null, stock: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(1750);
    expect(res.body.data.discountPrice).toBeNull();
    expect(res.body.data.stock).toBe(3);
  });

  test('rejects a discount price above the selling price', async () => {
    const list = await request(app).get('/api/admin/products?search=Admin Created').set(auth(adminToken));
    const id = list.body.data[0]._id;
    const res = await request(app)
      .patch(`/api/admin/products/${id}`)
      .set(auth(adminToken))
      .send({ discountPrice: 99999 });
    expect(res.status).toBe(422);
  });

  test('admin can list customers with order stats', async () => {
    const res = await request(app).get('/api/admin/customers').set(auth(adminToken));
    expect(res.status).toBe(200);
    const customer = res.body.data.find((c) => c.email === CUSTOMER.email);
    expect(customer).toBeTruthy();
    expect(customer.orderCount).toBeGreaterThanOrEqual(1);
    expect(customer.totalSpent).toBeGreaterThan(0);
    expect(customer.passwordHash).toBeUndefined();
  });

  test('admin updates order status through the allowed flow', async () => {
    const list = await request(app).get('/api/admin/orders').set(auth(adminToken));
    const order = list.body.data.find((o) => o.orderStatus === 'Confirmed');
    expect(order).toBeTruthy();

    const res = await request(app)
      .patch(`/api/admin/orders/${order._id}`)
      .set(auth(adminToken))
      .send({ orderStatus: 'Shipped', note: 'Handed to courier' });
    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe('Shipped');
    expect(res.body.data.statusHistory.slice(-1)[0].by).toBe('admin');
  });

  test('rejects invalid order status transitions', async () => {
    const list = await request(app).get('/api/admin/orders').set(auth(adminToken));
    const shipped = list.body.data.find((o) => o.orderStatus === 'Shipped');
    const res = await request(app)
      .patch(`/api/admin/orders/${shipped._id}`)
      .set(auth(adminToken))
      .send({ orderStatus: 'Pending' });
    expect(res.status).toBe(409);
  });

  test('marks delivered orders as paid automatically', async () => {
    const created = await request(app)
      .post('/api/orders')
      .set(auth(customerToken))
      .send({
        items: [{ product: testProductId, quantity: 1 }],
        shippingAddress: {
          fullName: 'Test Customer',
          phone: '9876543210',
          line1: '12 Test Street',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
        paymentMethod: 'cod',
      });
    expect(created.status).toBe(201);
    const id = created.body.data._id;

    const shipped = await request(app)
      .patch(`/api/admin/orders/${id}`)
      .set(auth(adminToken))
      .send({ orderStatus: 'Shipped' });
    expect(shipped.status).toBe(200);
    expect(shipped.body.data.paymentStatus).toBe('pending');

    const delivered = await request(app)
      .patch(`/api/admin/orders/${id}`)
      .set(auth(adminToken))
      .send({ orderStatus: 'Delivered' });
    expect(delivered.status).toBe(200);
    expect(delivered.body.data.orderStatus).toBe('Delivered');
    expect(delivered.body.data.paymentStatus).toBe('paid');
  });

  test('admin can delete a product', async () => {
    const list = await request(app).get('/api/admin/products?search=Admin Created').set(auth(adminToken));
    const res = await request(app).delete(`/api/admin/products/${list.body.data[0]._id}`).set(auth(adminToken));
    expect(res.status).toBe(200);
  });
});

describe('Reviews and wishlist', () => {
  let purchasedOrderId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(customerToken))
      .send({
        items: [{ product: testProductId, quantity: 1 }],
        shippingAddress: {
          fullName: 'Test Customer',
          phone: '9876543210',
          line1: '12 Test Street',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
        paymentMethod: 'cod',
      });
    purchasedOrderId = res.body.data._id;
  });

  test('rejects reviews from customers who did not purchase', async () => {
    const res = await request(app)
      .post(`/api/products/${testProductId}/reviews`)
      .set(auth(adminToken))
      .send({ rating: 5, comment: 'Never bought this.' });
    expect(res.status).toBe(403);
  });

  test('rejects invalid ratings', async () => {
    const res = await request(app)
      .post(`/api/products/${testProductId}/reviews`)
      .set(auth(customerToken))
      .send({ rating: 9 });
    expect(res.status).toBe(422);
  });

  test('accepts a review from a verified purchaser', async () => {
    const res = await request(app)
      .post(`/api/products/${testProductId}/reviews`)
      .set(auth(customerToken))
      .send({ rating: 5, comment: 'Excellent quality!' });
    expect(res.status).toBe(201);

    const product = await Product.findById(testProductId);
    expect(product.reviewCount).toBeGreaterThanOrEqual(1);
    expect(product.rating).toBeGreaterThan(0);
  });

  test('rejects duplicate reviews from the same customer', async () => {
    const res = await request(app)
      .post(`/api/products/${testProductId}/reviews`)
      .set(auth(customerToken))
      .send({ rating: 4, comment: 'Second attempt' });
    expect(res.status).toBe(409);
  });

  test('lists product reviews with ratings', async () => {
    const res = await request(app).get(`/api/products/${testProductId}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.stats.length).toBeGreaterThanOrEqual(1);
  });

  test('adds and removes wishlist items', async () => {
    const add = await request(app)
      .post('/api/wishlist/items')
      .set(auth(customerToken))
      .send({ productId: testProductId });
    expect(add.status).toBe(201);

    const list = await request(app).get('/api/wishlist').set(auth(customerToken));
    expect(list.body.data.count).toBe(1);

    const del = await request(app).delete(`/api/wishlist/items/${testProductId}`).set(auth(customerToken));
    expect(del.status).toBe(200);

    const after = await request(app).get('/api/wishlist').set(auth(customerToken));
    expect(after.body.data.count).toBe(0);
  });

  test('admin can moderate (delete) a review', async () => {
    const list = await request(app).get(`/api/products/${testProductId}/reviews`);
    const id = list.body.data[0]._id;
    const res = await request(app).delete(`/api/admin/reviews/${id}`).set(auth(adminToken));
    expect(res.status).toBe(200);
    const product = await Product.findById(testProductId);
    expect(product.reviewCount).toBe(0);
  });

  test('order detail remains accessible after purchase', async () => {
    const res = await request(app).get(`/api/orders/${purchasedOrderId}`).set(auth(customerToken));
    expect(res.status).toBe(200);
  });
});

describe('Security basics', () => {
  test('unknown API routes return JSON 404', async () => {
    const res = await request(app).get('/api/definitely-missing');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('invalid JSON object ids are rejected', async () => {
    const res = await request(app).get('/api/products/not-an-id');
    expect(res.status).toBe(400);
  });

  test('noSQL injection attempts in login are treated as plain strings', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { '$gt': '' }, password: { '$gt': '' } });
    expect(res.status).toBe(422);
  });
});
