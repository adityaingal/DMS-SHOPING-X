process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'shopx_notif_test_secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.COOKIE_SECURE = 'false';
process.env.RATE_LIMIT_MAX = '100000';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.STORE_TIMEZONE = 'Asia/Kolkata';
process.env.APP_URL = 'https://shopx.test';
process.env.SMTP_HOST = 'smtp.test.local';
process.env.SMTP_PORT = '587';
process.env.SMTP_SECURE = 'false';
process.env.SMTP_USER = 'smtp-user@test.local';
process.env.SMTP_PASS = 'super-secret-smtp-pass';
process.env.ORDER_NOTIFICATION_EMAIL = 'owner@shopx.test';
process.env.CUSTOMER_EMAIL_NOTIFICATIONS_ENABLED = 'false';
process.env.DISCORD_NOTIFICATIONS_ENABLED = 'true';
process.env.DISCORD_WEBHOOK_URL =
  'https://discord.com/api/webhooks/123456789012345678/abcdefghij1234567890abcdef';
process.env.NOTIFICATION_MAX_ATTEMPTS = '5';

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = require('../app');
const connectDB = require('../config/db');
const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const NotificationSetting = require('../models/NotificationSetting');
const discordService = require('../services/discordService');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const notificationWorker = require('../jobs/notificationWorker');
const NotificationError = require('../utils/NotificationError');

const TEST_URI = 'mongodb://127.0.0.1:27017/shopx_test_notifications';
const MAIN_HOOK = 'https://discord.com/api/webhooks/123456789012345678/abcdefghij1234567890abcdef';
const STATUS_HOOK = 'https://discord.com/api/webhooks/223344556677889900/statushook1234567890';
const PUBLIC_HOOK = 'https://discord.com/api/webhooks/334455667788990011/publichook1234567890';
const MAIN_HOOK_TOKEN = 'abcdefghij1234567890abcdef';

const ADMIN = { name: 'Notif Admin', email: 'notif-admin@test.com', password: 'Admin@12345' };
const CUSTOMER = { name: 'Asha Rao', email: 'asha@example.com', password: 'Customer@12345' };
const ADDRESS = {
  fullName: 'Asha Rao',
  phone: '9876543210',
  email: 'asha@example.com',
  line1: '12 MG Road',
  line2: 'Flat 4B',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
};

const discordLog = [];
const emailLog = [];
let discordMode = 'ok';
let emailMode = 'ok';

let adminToken;
let customerToken;
let productId;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

discordService.setTransport(async (url, payload) => {
  if (discordMode === 'ok') {
    discordLog.push({ url, payload });
    return { status: 204 };
  }
  if (discordMode === 'network') {
    throw new NotificationError('Could not reach Discord.', { category: 'network', retryable: true });
  }
  throw new NotificationError('Discord rejected the webhook URL.', {
    category: 'invalid_webhook',
    retryable: false,
  });
});

emailService.setTransport(async (message) => {
  if (emailMode === 'ok') {
    emailLog.push(message);
    return { messageId: 'test-message-id' };
  }
  if (emailMode === 'network') {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:587');
    err.code = 'ECONNREFUSED';
    throw err;
  }
  const err = new Error('535 5.7.8 Authentication credentials invalid');
  err.code = 'EAUTH';
  throw err;
});

const waitFor = async (fn, timeout = 3000, step = 25) => {
  const startedAt = Date.now();
  let last;
  while (Date.now() - startedAt < timeout) {
    last = await fn();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, step));
  }
  throw new Error('Timed out waiting for condition.');
};

const drainQueue = async () => {
  let processed = 0;
  for (let i = 0; i < 25; i++) {
    const count = await notificationWorker.runOnce();
    processed += count;
    if (!count) break;
  }
  return processed;
};

const placeOrder = async (overrides = {}) => {
  const res = await request(app)
    .post('/api/orders')
    .set(auth(customerToken))
    .send({
      paymentMethod: 'cod',
      items: [{ product: productId, quantity: 2 }],
      shippingAddress: { ...ADDRESS },
      ...overrides,
    });
  return res;
};

const resetSettings = async () => {
  const settings = await NotificationSetting.getSettings();
  settings.discord = { enabled: true, webhookUrl: MAIN_HOOK, statusWebhookUrl: '', publicWebhookUrl: '' };
  settings.email = {
    enabled: true,
    recipientEmail: 'owner@shopx.test',
    senderName: 'ShopX Store',
    customerConfirmationEnabled: false,
  };
  settings.storeTimezone = 'Asia/Kolkata';
  settings.events = new Map(Object.entries(NotificationSetting.DEFAULT_EVENTS));
  await settings.save();
};

const embedOf = (entry) => entry.payload.embeds[0];
const fieldValue = (entry, name) => {
  const embed = embedOf(entry);
  const field = (embed.fields || []).find((f) => f.name === name);
  return field ? field.value : undefined;
};

beforeAll(async () => {
  await connectDB(TEST_URI);
  await Promise.all([
    User.deleteMany({}),
    Product.deleteMany({}),
    Category.deleteMany({}),
    Order.deleteMany({}),
    Notification.deleteMany({}),
    NotificationSetting.deleteMany({}),
  ]);

  await User.create({
    name: ADMIN.name,
    email: ADMIN.email,
    passwordHash: await bcrypt.hash(ADMIN.password, 10),
    role: 'admin',
  });
  await User.create({
    name: CUSTOMER.name,
    email: CUSTOMER.email,
    passwordHash: await bcrypt.hash(CUSTOMER.password, 10),
    role: 'customer',
  });

  await Category.create({ name: 'Electronics', slug: 'electronics', description: 'Notifications test category' });
  const product = await Product.create({
    name: 'Test Wireless Headphones',
    description: 'Great sound, long battery life.',
    price: 2999,
    discountPrice: 2499,
    category: 'electronics',
    brand: 'TestBrand',
    stock: 1000,
    images: ['https://example.com/headphones.jpg'],
    featured: true,
  });
  productId = String(product._id);

  const adminLogin = await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password });
  adminToken = adminLogin.body.data.token;
  const customerLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: CUSTOMER.email, password: CUSTOMER.password });
  customerToken = customerLogin.body.data.token;
});

afterAll(async () => {
  discordService.setTransport(null);
  emailService.setTransport(null);
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.connection.close();
});

beforeEach(async () => {
  discordMode = 'ok';
  emailMode = 'ok';
  discordLog.length = 0;
  emailLog.length = 0;
  await Notification.deleteMany({});
  await NotificationSetting.deleteMany({});
  await Product.updateOne({ _id: productId }, { $set: { stock: 1000 } });
  await resetSettings();
});

describe('New order notifications', () => {
  test('1. a customer places a new order', async () => {
    const res = await placeOrder();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderNumber).toMatch(/^SHX-/);
    expect(res.body.data.orderStatus).toBe('Confirmed');
  });

  test('2. queues a Discord job and a store email job for the new order', async () => {
    const res = await placeOrder();
    expect(res.status).toBe(201);
    const orderNumber = res.body.data.orderNumber;

    const jobs = await waitFor(async () => {
      const found = await Notification.find({ orderNumber });
      return found.length >= 2 ? found : null;
    });
    expect(jobs.map((j) => j.channel).sort()).toEqual(['discord', 'email']);
    expect(jobs.every((j) => j.status === 'pending')).toBe(true);
    expect(jobs.every((j) => j.dedupeKey && j.eventId)).toBe(true);
  });

  test('3. the Discord message contains the full order details', async () => {
    const res = await placeOrder();
    const orderNumber = res.body.data.orderNumber;
    const order = await Order.findOne({ orderNumber });

    await drainQueue();

    const sent = discordLog.find((e) => embedOf(e).title === 'NEW ORDER RECEIVED');
    expect(sent).toBeTruthy();
    expect(sent.url).toBe(MAIN_HOOK);
    expect(sent.payload.allowed_mentions).toEqual({ parse: [] });
    expect(embedOf(sent).url).toContain(`/admin/orders.html?id=${encodeURIComponent(orderNumber)}`);

    const items = fieldValue(sent, 'Items (1)');
    expect(items).toContain('Test Wireless Headphones × 2');
    expect(items).toContain('₹4,998');

    expect(fieldValue(sent, 'Amounts')).toContain(`Subtotal: ₹${order.subtotal.toLocaleString('en-IN')}`);
    expect(fieldValue(sent, 'Amounts')).toContain(`**Total: ₹${order.total.toLocaleString('en-IN')}**`);
    expect(fieldValue(sent, 'Customer')).toContain('Name: Asha Rao');
    expect(fieldValue(sent, 'Customer')).toContain('Email: asha@example.com');
    expect(fieldValue(sent, 'Customer')).toContain('Phone: 9876543210');
    expect(fieldValue(sent, 'Shipping address')).toContain('12 MG Road');
    expect(fieldValue(sent, 'Shipping address')).toContain('Bengaluru, Karnataka 560001');
    expect(fieldValue(sent, 'Payment')).toContain('Cash on delivery');
    expect(fieldValue(sent, 'Payment')).toContain('pending');
  });

  test('4. the store owner receives the NEW SHOPX ORDER email', async () => {
    const res = await placeOrder();
    const orderNumber = res.body.data.orderNumber;

    await drainQueue();

    const mail = emailLog.find((m) => m.subject === `NEW SHOPX ORDER — [${orderNumber}]`);
    expect(mail).toBeTruthy();
    expect(mail.to).toBe('owner@shopx.test');
    expect(mail.from).toContain('ShopX');
    expect(mail.html).toContain('Test Wireless Headphones');
    expect(mail.html).toContain('12 MG Road');
    expect(mail.text).toContain('Subtotal:');
    expect(mail.text).toContain('Delivery address:');
    expect(mail.text).toContain('9876543210');
  });

  test('5. the amounts in the notification match the stored order', async () => {
    const res = await placeOrder();
    const order = await Order.findOne({ orderNumber: res.body.data.orderNumber });

    await drainQueue();

    const sent = discordLog.find((e) => embedOf(e).title === 'NEW ORDER RECEIVED');
    const amounts = fieldValue(sent, 'Amounts');
    expect(amounts).toContain(`Subtotal: ₹${order.subtotal.toLocaleString('en-IN')}`);
    expect(amounts).toContain(`Shipping fee: ₹${order.shippingFee.toLocaleString('en-IN')}`);
    expect(amounts).toContain(`**Total: ₹${order.total.toLocaleString('en-IN')}**`);
    expect(emailLog[0].html).toContain(`₹${order.total.toLocaleString('en-IN')}`);
  });

  test('6. timestamps use the configured store timezone', async () => {
    const settings = await NotificationSetting.findById('global');
    settings.storeTimezone = 'America/New_York';
    await settings.save();

    const res = await placeOrder();
    const order = await Order.findOne({ orderNumber: res.body.data.orderNumber });
    await drainQueue();

    const sent = discordLog.find((e) => embedOf(e).title === 'NEW ORDER RECEIVED');
    const placed = fieldValue(sent, 'Placed');

    const fmt = (timeZone) => {
      const date = new Intl.DateTimeFormat('en-IN', { timeZone, day: '2-digit', month: 'short', year: 'numeric' }).format(
        order.createdAt
      );
      const time = new Intl.DateTimeFormat('en-IN', { timeZone, hour: '2-digit', minute: '2-digit', hour12: true }).format(
        order.createdAt
      );
      return `${date} • ${time}`;
    };

    expect(placed).toBe(fmt('America/New_York'));
    expect(placed).not.toBe(fmt('Asia/Kolkata'));
    expect(emailLog[0].text).toContain('(America/New_York)');
  });

  test('7. the customer gets a confirmation email when it is enabled', async () => {
    await request(app)
      .patch('/api/admin/notifications/settings')
      .set(auth(adminToken))
      .send({ email: { customerConfirmationEnabled: true } });

    const res = await placeOrder();
    const orderNumber = res.body.data.orderNumber;

    await waitFor(async () => (await Notification.countDocuments({ orderNumber })) >= 3);
    await drainQueue();

    const confirmation = emailLog.find((m) => m.subject === `Order confirmation — ${orderNumber}`);
    expect(confirmation).toBeTruthy();
    expect(confirmation.to).toBe('asha@example.com');
    expect(confirmation.html).toContain('ORDER CONFIRMATION');
    expect(confirmation.html).not.toContain('/admin/');
    expect(confirmation.text).not.toContain('discord.com');
    expect(confirmation.text).not.toContain('smtp.test.local');

    const jobs = await Notification.find({ orderNumber, eventType: 'customer.order_confirmation' });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('sent');
    expect(jobs[0].recipient).toBe('asha@example.com');
  });

  test('8. a public channel copy never leaks private customer data', async () => {
    const settings = await NotificationSetting.findById('global');
    settings.discord.publicWebhookUrl = PUBLIC_HOOK;
    settings.discord.statusWebhookUrl = STATUS_HOOK;
    await settings.save();

    const res = await placeOrder();
    const orderNumber = res.body.data.orderNumber;
    await drainQueue();

    const privateCopy = discordLog.find((e) => e.url === MAIN_HOOK);
    const publicCopy = discordLog.find((e) => e.url === PUBLIC_HOOK);
    expect(privateCopy).toBeTruthy();
    expect(publicCopy).toBeTruthy();

    const privateJson = JSON.stringify(privateCopy.payload);
    expect(privateJson).toContain('9876543210');
    expect(privateJson).toContain('12 MG Road');

    const publicJson = JSON.stringify(publicCopy.payload);
    expect(publicJson).toContain(orderNumber);
    expect(publicJson).not.toContain('9876543210');
    expect(publicJson).not.toContain('12 MG Road');
    expect(publicJson).not.toContain('asha@example.com');

    const publicJob = await Notification.findOne({ orderNumber, publicCopy: true });
    expect(publicJob).toBeTruthy();
    expect(publicJob.status).toBe('sent');
  });
});

describe('Delivery failures', () => {
  test('9. a Discord outage never blocks the order', async () => {
    discordMode = 'network';

    const res = await placeOrder();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    await waitFor(async () => (await Notification.countDocuments({ channel: 'discord' })) >= 1);
    await drainQueue();

    expect(discordLog).toHaveLength(0);
    const job = await Notification.findOne({ channel: 'discord' });
    expect(job.status).toBe('retrying');
    expect(job.errorCategory).toBe('network');
    expect(job.attempts).toBe(1);
    expect(job.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(await Order.countDocuments({ orderNumber: res.body.data.orderNumber })).toBe(1);
  });

  test('10. a Gmail SMTP outage never blocks the order', async () => {
    emailMode = 'network';

    const res = await placeOrder();
    expect(res.status).toBe(201);

    await waitFor(async () => (await Notification.countDocuments({ channel: 'email' })) >= 1);
    await drainQueue();

    expect(emailLog).toHaveLength(0);
    const job = await Notification.findOne({ channel: 'email' });
    expect(job.status).toBe('retrying');
    expect(job.errorCategory).toBe('smtp_network');
    expect(job.errorMessage).toBeTruthy();
  });

  test('11. a job is delivered after the service recovers', async () => {
    discordMode = 'network';
    const res = await placeOrder();
    const orderNumber = res.body.data.orderNumber;
    await drainQueue();

    const before = await Notification.findOne({ orderNumber, channel: 'discord' });
    expect(before.status).toBe('retrying');

    discordMode = 'ok';
    await Notification.updateMany(
      { status: 'retrying' },
      { $set: { nextAttemptAt: new Date(Date.now() - 1000) } }
    );
    await drainQueue();

    const after = await Notification.findOne({ orderNumber, channel: 'discord' });
    expect(after.status).toBe('sent');
    expect(after.attempts).toBe(2);
    expect(after.deliveredAt).toBeTruthy();
    expect(discordLog).toHaveLength(1);
  });

  test('12. retrying never duplicates a message', async () => {
    discordMode = 'network';
    const res = await placeOrder();
    const orderNumber = res.body.data.orderNumber;
    await drainQueue();

    discordMode = 'ok';
    for (let i = 0; i < 3; i++) {
      await Notification.updateMany(
        { status: 'retrying' },
        { $set: { nextAttemptAt: new Date(Date.now() - 1000) } }
      );
      await drainQueue();
      await drainQueue();
    }

    expect(discordLog).toHaveLength(1);

    const again = await notificationService.enqueue({
      channel: 'discord',
      eventType: 'order.created',
      order: await Order.findOne({ orderNumber }),
      dedupeKey: `order.created:${orderNumber}:1:discord`,
      recipient: '',
      payload: {},
    });
    expect(again).toBeTruthy();
    expect(await Notification.countDocuments({ orderNumber, channel: 'discord' })).toBe(1);
    await drainQueue();
    expect(discordLog).toHaveLength(1);
  });
});

describe('Reliability', () => {
  test('13. jobs stuck in processing are recovered as if the server restarted', async () => {
    const res = await placeOrder();
    const orderNumber = res.body.data.orderNumber;
    await waitFor(async () => (await Notification.countDocuments({ orderNumber })) >= 2);

    await Notification.updateMany(
      {},
      {
        $set: {
          status: 'processing',
          lastAttemptAt: new Date(Date.now() - 10 * 60 * 1000),
          nextAttemptAt: new Date(Date.now() - 10 * 60 * 1000),
          attempts: 1,
        },
      }
    );

    const recovered = await notificationService.recoverStaleJobs();
    expect(recovered).toBeGreaterThanOrEqual(2);

    await drainQueue();

    expect(discordLog).toHaveLength(1);
    expect(emailLog).toHaveLength(1);
    const jobs = await Notification.find({ orderNumber });
    expect(jobs.every((j) => j.status === 'sent')).toBe(true);
    expect(jobs.every((j) => j.attempts === 2)).toBe(true);
  });

  test('14. the same idempotency key never creates a second order or second message', async () => {
    const key = 'checkout-attempt-abc-123';
    const first = await placeOrder({ idempotencyKey: key });
    expect(first.status).toBe(201);

    const second = await placeOrder({ idempotencyKey: key });
    expect(second.status).toBe(200);
    expect(second.body.data.orderNumber).toBe(first.body.data.orderNumber);

    expect(await Order.countDocuments({ idempotencyKey: key })).toBe(1);
    await waitFor(async () => (await Notification.countDocuments({ channel: 'discord' })) >= 1);
    await drainQueue();
    expect(await Notification.countDocuments({ channel: 'discord' })).toBe(1);
    expect(discordLog).toHaveLength(1);
  });
});

describe('Access control and secrets', () => {
  test('15. anonymous and non-admin users cannot reach the notification API', async () => {
    const anon = await request(app).get('/api/admin/notifications/settings');
    expect(anon.status).toBe(401);

    const customer = await request(app).get('/api/admin/notifications/settings').set(auth(customerToken));
    expect(customer.status).toBe(403);

    const patch = await request(app)
      .patch('/api/admin/notifications/settings')
      .set(auth(customerToken))
      .send({ discord: { webhookUrl: STATUS_HOOK } });
    expect(patch.status).toBe(403);

    const testCall = await request(app).post('/api/admin/notifications/test/discord').set(auth(customerToken));
    expect(testCall.status).toBe(403);

    const history = await request(app).get('/api/admin/notifications/history').set(auth(customerToken));
    expect(history.status).toBe(403);
  });

  test('16. webhook URLs and SMTP credentials are never exposed to the browser', async () => {
    const res = await request(app).get('/api/admin/notifications/settings').set(auth(adminToken));
    expect(res.status).toBe(200);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(MAIN_HOOK_TOKEN);
    expect(raw).not.toContain(MAIN_HOOK);
    expect(raw).not.toContain('super-secret-smtp-pass');
    expect(raw).not.toContain('smtp-user@test.local');
    expect(res.body.data.settings.discord.webhookUrl).toContain('*');
    expect(res.body.data.settings.email.recipientEmail).toContain('*@shopx.test');
    expect(res.body.data.capabilities.emailConfigured).toBe(true);

    const login = await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password });
    expect(JSON.stringify(login.body)).not.toContain('super-secret-smtp-pass');

    const history = await request(app).get('/api/admin/notifications/history').set(auth(adminToken));
    expect(JSON.stringify(history.body)).not.toContain(MAIN_HOOK_TOKEN);
    expect(JSON.stringify(history.body)).not.toContain('super-secret-smtp-pass');
  });

  test('17. unsafe webhook URLs are rejected', async () => {
    const blocked = await request(app)
      .patch('/api/admin/notifications/settings')
      .set(auth(adminToken))
      .send({ discord: { webhookUrl: 'http://evil.example.com/api/webhooks/1234567890/abcdefghij' } });
    expect(blocked.status).toBe(422);
    expect(blocked.body.success).toBe(false);

    const localTarget = await request(app)
      .patch('/api/admin/notifications/settings')
      .set(auth(adminToken))
      .send({ discord: { webhookUrl: 'https://discord.com.evil.example/api/webhooks/1234567890/abcdefghij' } });
    expect(localTarget.status).toBe(422);

    const badPath = await request(app)
      .patch('/api/admin/notifications/settings')
      .set(auth(adminToken))
      .send({ discord: { webhookUrl: 'https://discord.com/api/webhooks/notanumber/abcdefghij' } });
    expect(badPath.status).toBe(422);

    const stored = await NotificationSetting.findById('global');
    expect(stored.discord.webhookUrl).toBe(MAIN_HOOK);
  });
});

describe('Status changes and admin controls', () => {
  test('18. an admin status change notifies the status webhook', async () => {
    const settings = await NotificationSetting.findById('global');
    settings.discord.statusWebhookUrl = STATUS_HOOK;
    await settings.save();

    const created = await placeOrder();
    const orderNumber = created.body.data.orderNumber;
    await drainQueue();
    discordLog.length = 0;

    const patch = await request(app)
      .patch(`/api/admin/orders/${created.body.data._id}`)
      .set(auth(adminToken))
      .send({ orderStatus: 'Shipped', note: 'Handed to courier' });
    expect(patch.status).toBe(200);

    await waitFor(async () => (await Notification.countDocuments({ orderNumber, eventType: 'order.shipped' })) >= 1);
    await drainQueue();

    const shipped = discordLog.find((e) => embedOf(e).title === 'ORDER SHIPPED');
    expect(shipped).toBeTruthy();
    expect(shipped.url).toBe(STATUS_HOOK);
    expect(fieldValue(shipped, 'Status')).toContain('Shipped');
    expect(fieldValue(shipped, 'Note')).toContain('Handed to courier');

    const job = await Notification.findOne({ orderNumber, eventType: 'order.shipped' });
    expect(job.status).toBe('sent');

    const patch2 = await request(app)
      .patch(`/api/admin/orders/${created.body.data._id}`)
      .set(auth(adminToken))
      .send({ paymentStatus: 'paid' });
    expect(patch2.status).toBe(200);
    await waitFor(async () => (await Notification.countDocuments({ eventType: 'order.payment_confirmed' })) >= 1);
  });

  test('19. admin history, stats and retry endpoints work', async () => {
    emailMode = 'auth';
    const created = await placeOrder();
    const orderNumber = created.body.data.orderNumber;
    await drainQueue();

    const failed = await Notification.findOne({ orderNumber, channel: 'email' });
    expect(failed.status).toBe('failed');
    expect(failed.errorCategory).toBe('smtp_auth');

    const history = await request(app)
      .get('/api/admin/notifications/history')
      .query({ channel: 'email', status: 'failed', orderId: orderNumber })
      .set(auth(adminToken));
    expect(history.status).toBe(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0].errorCategory).toBe('smtp_auth');
    expect(history.body.pagination.total).toBe(1);
    expect(history.body.data[0].payload).toBeUndefined();

    const stats = await request(app).get('/api/admin/notifications/stats').set(auth(adminToken));
    expect(stats.status).toBe(200);
    expect(stats.body.data.byStatus.failed).toBeGreaterThanOrEqual(1);

    const retry = await request(app)
      .post(`/api/admin/notifications/jobs/${failed._id}/retry`)
      .set(auth(adminToken));
    expect(retry.status).toBe(200);
    expect(retry.body.data.status).toBe('pending');

    emailMode = 'ok';
    await drainQueue();
    const recovered = await Notification.findById(failed._id);
    expect(recovered.status).toBe('sent');
    expect(emailLog).toHaveLength(1);
  });

  test('20. the Discord test button reports the real delivery result', async () => {
    const ok = await request(app)
      .post('/api/admin/notifications/test/discord')
      .set(auth(adminToken))
      .send({ message: 'Everything is connected' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.delivered).toBe(true);
    expect(ok.body.data.target).toContain('*');
    expect(discordLog).toHaveLength(1);
    expect(embedOf(discordLog[0]).description).toContain('Everything is connected');

    discordMode = 'network';
    const fail = await request(app).post('/api/admin/notifications/test/discord').set(auth(adminToken));
    expect(fail.status).toBe(502);
    expect(fail.body.success).toBe(false);

    emailMode = 'auth';
    const emailFail = await request(app).post('/api/admin/notifications/test/email').set(auth(adminToken));
    expect(emailFail.status).toBe(502);
    expect(emailFail.body.success).toBe(false);
    expect(emailFail.body.message).toContain('mail server rejected the login');
  });

  test('21. a per-event toggle stops that event from being queued', async () => {
    await request(app)
      .patch('/api/admin/notifications/settings')
      .set(auth(adminToken))
      .send({ events: { orderCreated: { discord: false, email: true } } });

    const created = await placeOrder();
    await waitFor(async () => (await Notification.countDocuments({ orderNumber: created.body.data.orderNumber })) >= 1);
    await drainQueue();

    const jobs = await Notification.find({ orderNumber: created.body.data.orderNumber });
    expect(jobs.every((j) => j.channel === 'email')).toBe(true);
    expect(discordLog).toHaveLength(0);
    expect(emailLog).toHaveLength(1);
  });
});
