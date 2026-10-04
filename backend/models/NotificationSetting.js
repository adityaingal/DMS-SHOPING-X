const mongoose = require('mongoose');
const { maskWebhook, maskEmail } = require('../config/notificationConfig');

const DEFAULT_EVENTS = {
  orderCreated: { discord: true, email: true },
  orderConfirmed: { discord: true, email: false },
  paymentConfirmed: { discord: true, email: false },
  orderProcessing: { discord: true, email: false },
  orderShipped: { discord: true, email: false },
  orderDelivered: { discord: true, email: false },
  orderCancelled: { discord: true, email: false },
  refundUpdated: { discord: true, email: false },
};

const eventSchema = new mongoose.Schema(
  {
    discord: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
  },
  { _id: false }
);

const notificationSettingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' },
    discord: {
      enabled: { type: Boolean, default: false },
      webhookUrl: { type: String, default: '' },
      statusWebhookUrl: { type: String, default: '' },
      publicWebhookUrl: { type: String, default: '' },
    },
    email: {
      enabled: { type: Boolean, default: false },
      recipientEmail: { type: String, default: '' },
      senderName: { type: String, default: 'ShopX Store' },
      customerConfirmationEnabled: { type: Boolean, default: false },
    },
    events: {
      type: Map,
      of: eventSchema,
      default: () => ({ ...DEFAULT_EVENTS }),
    },
    storeTimezone: { type: String, default: 'Asia/Kolkata' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

notificationSettingSchema.statics.DEFAULT_EVENTS = DEFAULT_EVENTS;

notificationSettingSchema.statics.getSettings = async function () {
  const existing = await this.findById('global');
  if (existing) return existing;
  const { envConfig, emailConfigured, validateTimezone } = require('../config/notificationConfig');
  const cfg = envConfig();
  try {
    return await this.create({
      _id: 'global',
      discord: {
        enabled: cfg.discordEnabled && Boolean(cfg.discordWebhookUrl),
        webhookUrl: cfg.discordWebhookUrl,
        statusWebhookUrl: '',
        publicWebhookUrl: '',
      },
      email: {
        enabled: emailConfigured() && Boolean(cfg.orderNotificationEmail),
        recipientEmail: cfg.orderNotificationEmail,
        customerConfirmationEnabled: cfg.customerEmailsEnabled,
      },
      storeTimezone: validateTimezone(cfg.storeTimezone).value,
    });
  } catch (err) {
    if (err && err.code === 11000) return this.findById('global');
    throw err;
  }
};

notificationSettingSchema.methods.toSafeObject = function () {
  const events = {};
  const raw = this.events instanceof Map ? this.events : new Map(Object.entries(this.events || {}));
  for (const [key, value] of raw.entries()) {
    events[key] = {
      discord: value ? value.discord !== false : false,
      email: value ? value.email === true : false,
    };
  }
  return {
    discord: {
      enabled: !!this.discord.enabled,
      configured: Boolean(this.discord.webhookUrl),
      webhookUrl: maskWebhook(this.discord.webhookUrl),
      statusConfigured: Boolean(this.discord.statusWebhookUrl),
      statusWebhookUrl: maskWebhook(this.discord.statusWebhookUrl),
      publicConfigured: Boolean(this.discord.publicWebhookUrl),
      publicWebhookUrl: maskWebhook(this.discord.publicWebhookUrl),
    },
    email: {
      enabled: !!this.email.enabled,
      recipientEmail: maskEmail(this.email.recipientEmail),
      senderName: this.email.senderName || 'ShopX Store',
      customerConfirmationEnabled: !!this.email.customerConfirmationEnabled,
    },
    events,
    storeTimezone: this.storeTimezone,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('NotificationSetting', notificationSettingSchema);
module.exports.DEFAULT_EVENTS = DEFAULT_EVENTS;
