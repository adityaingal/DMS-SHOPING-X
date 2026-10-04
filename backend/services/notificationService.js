const crypto = require('crypto');
const Notification = require('../models/Notification');
const NotificationSetting = require('../models/NotificationSetting');
const { maskWebhook, maskEmail, envConfig } = require('../config/notificationConfig');
const { adminOrderLink, adminDashboardLink } = require('./discordService');

const MAX_ATTEMPTS = Number(process.env.NOTIFICATION_MAX_ATTEMPTS) || 5;
const BASE_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 15 * 60 * 1000;
const STALE_JOB_MS = 5 * 60 * 1000;

const log = (level, message, meta) => {
  const line = `[notifications] ${message}`;
  if (level === 'error') console.error(line, meta || '');
  else console.log(line, meta || '');
};

const getSettings = () => NotificationSetting.getSettings();

const newEventId = () => `ntf_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;

const backoffMs = (attempts) => Math.min(BASE_BACKOFF_MS * 3 ** Math.max(attempts - 1, 0), MAX_BACKOFF_MS);

const enqueue = async (job) => {
  try {
    const order = job.order || null;
    return await Notification.create({
      eventId: newEventId(),
      dedupeKey: job.dedupeKey,
      order: order && order._id ? order._id : order,
      orderNumber: job.orderNumber || (order && order.orderNumber) || '',
      channel: job.channel,
      eventType: job.eventType,
      recipient: job.recipient || '',
      payload: job.payload || {},
      publicCopy: !!job.publicCopy,
      status: 'pending',
      attempts: 0,
      maxAttempts: job.maxAttempts || MAX_ATTEMPTS,
      nextAttemptAt: new Date(),
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return Notification.findOne({ dedupeKey: job.dedupeKey });
    }
    log('error', `enqueue failed for ${job.eventType}`, err && err.message);
    return null;
  }
};

const claimNextJob = async () =>
  Notification.findOneAndUpdate(
    {
      $or: [{ status: 'pending' }, { status: 'retrying' }],
      nextAttemptAt: { $lte: new Date() },
    },
    { $set: { status: 'processing', lastAttemptAt: new Date() }, $inc: { attempts: 1 } },
    { sort: { nextAttemptAt: 1 }, new: true }
  );

const markSent = async (job) => {
  job.status = 'sent';
  job.deliveredAt = new Date();
  job.errorCategory = null;
  job.errorMessage = null;
  await job.save();
  return job;
};

const markFailure = async (job, err) => {
  const category = (err && err.category) || 'unknown';
  const retryable = !err || err.retryable !== false;
  const attempts = job.attempts || 0;
  const canRetry = retryable && attempts < (job.maxAttempts || MAX_ATTEMPTS);

  job.errorCategory = category;
  job.errorMessage = String((err && err.message) || 'Delivery failed.').slice(0, 200);
  if (canRetry) {
    job.status = 'retrying';
    const wait = err && err.retryAfterMs ? Math.max(err.retryAfterMs, 1000) : backoffMs(attempts);
    job.nextAttemptAt = new Date(Date.now() + wait);
  } else {
    job.status = 'failed';
    job.nextAttemptAt = new Date(Date.now() + MAX_BACKOFF_MS);
  }
  await job.save();
  log(canRetry ? 'warn' : 'error', `${job.channel}/${job.eventType} attempt ${attempts} failed (${category})`);
  return job;
};

const recoverStaleJobs = async () => {
  const cutoff = new Date(Date.now() - STALE_JOB_MS);
  const res = await Notification.updateMany(
    { status: 'processing', lastAttemptAt: { $lte: cutoff } },
    { $set: { status: 'retrying', nextAttemptAt: new Date() } }
  );
  if (res.modifiedCount) log('warn', `recovered ${res.modifiedCount} stale notification job(s)`);
  return res.modifiedCount;
};

const loadOrder = async (job) => {
  if (!job.order) return null;
  const Order = require('../models/Order');
  return Order.findById(job.order);
};

const resolveWebhookForJob = (job, settings) => {
  const { resolveWebhookUrl } = require('./discordService');
  let kind = 'orders';
  if (job.publicCopy) kind = 'public';
  else if (job.eventType !== 'order.created') kind = 'status';
  return resolveWebhookUrl(settings, kind);
};

const buildPayloadForJob = (job, order, settings) => {
  const discord = require('./discordService');
  const timezone = settings ? settings.storeTimezone : envConfig().storeTimezone;

  if (job.eventType === 'system.test') {
    return discord.buildTextPayload(job.payload && job.payload.text ? job.payload.text : 'ShopX test notification');
  }
  if (!order) {
    const err = new Error('Order no longer exists.');
    err.category = 'payload';
    err.retryable = false;
    throw err;
  }

  const includePrivate = !job.publicCopy;
  if (job.eventType === 'order.created') return discord.buildOrderEmbed(order, { timezone, includePrivate });
  return discord.buildStatusEmbed(order, {
    timezone,
    includePrivate,
    status: (job.payload && job.payload.status) || order.orderStatus,
    note: (job.payload && job.payload.note) || '',
    at: (job.payload && job.payload.at) || order.updatedAt,
    paymentStatus: (job.payload && job.payload.paymentStatus) || null,
  });
};

const listHistory = async (filters = {}) => {
  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 20, 1), 100);
  const query = {};
  if (filters.orderId) query.orderNumber = { $regex: String(filters.orderId).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (filters.channel) query.channel = filters.channel;
  if (filters.eventType) query.eventType = filters.eventType;
  if (filters.status) query.status = filters.status;
  if (filters.from || filters.to) {
    query.createdAt = {};
    if (filters.from) query.createdAt.$gte = new Date(filters.from);
    if (filters.to) query.createdAt.$lte = new Date(filters.to);
  }

  const total = await Notification.countDocuments(query);
  const jobs = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select('-payload');

  return {
    jobs,
    pagination: { page, pages: Math.max(Math.ceil(total / limit), 1), total, limit },
  };
};

const stats = async () => {
  const [agg, failed] = await Promise.all([
    Notification.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Notification.countDocuments({ status: 'failed' }),
  ]);
  return { byStatus: Object.fromEntries(agg.map((s) => [s._id, s.count])), failed };
};

const retryJob = async (id) => {
  const job = await Notification.findById(id);
  if (!job) return { ok: false, message: 'Notification job not found.' };
  if (job.status === 'sent') return { ok: false, message: 'This notification was already delivered.' };
  if (job.status === 'processing') return { ok: false, message: 'This notification is currently being delivered.' };
  job.status = 'pending';
  job.nextAttemptAt = new Date();
  job.errorCategory = null;
  job.errorMessage = null;
  job.attempts = 0;
  await job.save();
  return { ok: true, job };
};

const sendTestDiscord = async (settings, text) => {
  const discord = require('./discordService');
  const url = discord.resolveWebhookUrl(settings, 'orders');
  await discord.sendPayload(url, discord.buildTextPayload(text));
  return true;
};

const maskedRecipientFor = (channel, settings) => {
  if (channel === 'email') return maskEmail(ownerRecipientFrom(settings)) || '';
  return maskWebhook((settings && settings.discord && settings.discord.webhookUrl) || envConfig().discordWebhookUrl) || '';
};

const ownerRecipientFrom = (settings) =>
  (settings && settings.email && settings.email.recipientEmail) || envConfig().orderNotificationEmail;

module.exports = {
  MAX_ATTEMPTS,
  getSettings,
  enqueue,
  claimNextJob,
  markSent,
  markFailure,
  recoverStaleJobs,
  loadOrder,
  resolveWebhookForJob,
  buildPayloadForJob,
  listHistory,
  stats,
  retryJob,
  sendTestDiscord,
  maskedRecipientFor,
  backoffMs,
  log,
  adminOrderLink,
  adminDashboardLink,
};
