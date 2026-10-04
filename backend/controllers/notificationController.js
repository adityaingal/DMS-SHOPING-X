const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const notificationService = require('../services/notificationService');
const discordService = require('../services/discordService');
const emailService = require('../services/emailService');
const NotificationSetting = require('../models/NotificationSetting');
const { EVENT_TYPES } = require('../models/Notification');
const {
  validateWebhookUrl,
  validateTimezone,
  validateEmail,
  maskWebhook,
  maskEmail,
  envConfig,
  emailConfigured,
  discordConfigured,
} = require('../config/notificationConfig');

const SETTING_KEYS = [
  'orderCreated',
  'orderConfirmed',
  'paymentConfirmed',
  'orderProcessing',
  'orderShipped',
  'orderDelivered',
  'orderCancelled',
  'refundUpdated',
];

const isMasked = (value) => typeof value === 'string' && value.includes('*');

const deliveryError = (err) => {
  const category = (err && err.category) || 'unknown';
  const messages = {
    invalid_webhook: 'Discord rejected the webhook URL. Check the webhook in Discord settings.',
    config: 'Discord is not configured. Add a webhook URL first.',
    rate_limited: 'Discord rate limited the request. Try again shortly.',
    network: 'Could not reach Discord. Check the server connection and try again.',
    server_error: 'Discord is temporarily unavailable. Try again shortly.',
    smtp_config: 'Email is not configured. Set SMTP credentials first.',
    smtp_auth: 'The mail server rejected the login. Check SMTP credentials.',
    smtp_network: 'Could not reach the mail server. Try again shortly.',
    smtp_server: 'The mail server returned an error. Try again shortly.',
    smtp_rejected: 'The recipient address was rejected by the mail server.',
    disabled: 'That notification channel is currently disabled.',
  };
  const message = messages[category] || 'The test notification could not be delivered.';
  return new AppError(message, 502, [{ field: category, message }]);
};

const getSettings = asyncHandler(async (req, res) => {
  const settings = await notificationService.getSettings();
  const cfg = envConfig();
  sendSuccess(res, {
    settings: settings.toSafeObject(),
    capabilities: {
      discordConfigured: discordConfigured() || Boolean(settings.discord.webhookUrl),
      emailConfigured: emailConfigured(),
      envRecipient: maskEmail(cfg.orderNotificationEmail),
      envWebhook: maskWebhook(cfg.discordWebhookUrl),
      timezoneValid: validateTimezone(cfg.storeTimezone).ok,
    },
    eventTypes: SETTING_KEYS,
    channels: ['discord', 'email'],
  });
});

const updateSettings = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const settings = await notificationService.getSettings();

  if (body.discord !== undefined) {
    const discord = body.discord || {};
    if (typeof discord.enabled === 'boolean') settings.discord.enabled = discord.enabled;
    ['webhookUrl', 'statusWebhookUrl', 'publicWebhookUrl'].forEach((field) => {
      if (discord[field] === undefined) return;
      const value = String(discord[field] || '').trim();
      if (value === '') {
        settings.discord[field] = '';
        return;
      }
      if (isMasked(value)) {
        throw new AppError('Paste the full webhook URL to change it.', 422, [
          { field, message: 'Masked values cannot be saved.' },
        ]);
      }
      const validated = validateWebhookUrl(value);
      if (!validated.ok) {
        throw new AppError(validated.error, 422, [{ field, message: validated.error }]);
      }
      settings.discord[field] = validated.value;
    });
  }

  if (body.email !== undefined) {
    const email = body.email || {};
    if (typeof email.enabled === 'boolean') settings.email.enabled = email.enabled;
    if (typeof email.customerConfirmationEnabled === 'boolean') {
      settings.email.customerConfirmationEnabled = email.customerConfirmationEnabled;
    }
    if (email.senderName !== undefined) {
      settings.email.senderName = String(email.senderName || '').trim().slice(0, 60) || 'ShopX Store';
    }
    if (email.recipientEmail !== undefined) {
      const value = String(email.recipientEmail || '').trim();
      if (value === '') {
        settings.email.recipientEmail = '';
      } else {
        const validated = validateEmail(value);
        if (!validated.ok) {
          throw new AppError(validated.error, 422, [{ field: 'recipientEmail', message: validated.error }]);
        }
        settings.email.recipientEmail = validated.value;
      }
    }
  }

  if (body.storeTimezone !== undefined) {
    const validated = validateTimezone(body.storeTimezone);
    if (!validated.ok) throw new AppError('Unknown timezone.', 422, [{ field: 'storeTimezone', message: validated.error }]);
    settings.storeTimezone = validated.value;
  }

  if (body.events !== undefined) {
    const events = body.events;
    if (!events || typeof events !== 'object' || Array.isArray(events)) {
      throw new AppError('Invalid event settings.', 422);
    }
    Object.entries(events).forEach(([key, value]) => {
      if (!SETTING_KEYS.includes(key)) return;
      if (!value || typeof value !== 'object') return;
      const current = settings.events instanceof Map ? settings.events.get(key) : null;
      const next = {
        discord: typeof value.discord === 'boolean' ? value.discord : current ? current.discord : true,
        email: typeof value.email === 'boolean' ? value.email : current ? current.email : false,
      };
      if (settings.events instanceof Map) settings.events.set(key, next);
      else settings.events[key] = next;
    });
  }

  settings.updatedBy = req.user._id;
  await settings.save();
  sendSuccess(res, { settings: settings.toSafeObject() });
});

const testDiscord = asyncHandler(async (req, res) => {
  const settings = await notificationService.getSettings();
  const text = (req.body && req.body.message && String(req.body.message).slice(0, 300)) || 'Order notifications are connected to ShopX.';
  try {
    await notificationService.sendTestDiscord(settings, text);
  } catch (err) {
    throw deliveryError(err);
  }
  sendSuccess(res, {
    delivered: true,
    channel: 'discord',
    target: maskWebhook((settings.discord && settings.discord.webhookUrl) || envConfig().discordWebhookUrl),
    at: new Date().toISOString(),
  });
});

const testEmail = asyncHandler(async (req, res) => {
  const settings = await notificationService.getSettings();
  try {
    const result = await emailService.sendTestEmail(settings);
    sendSuccess(res, {
      delivered: true,
      channel: 'email',
      target: maskEmail(result.recipient),
      at: new Date().toISOString(),
    });
  } catch (err) {
    throw deliveryError(err);
  }
});

const history = asyncHandler(async (req, res) => {
  const { jobs, pagination } = await notificationService.listHistory(req.query);
  sendSuccess(res, jobs, 200, { pagination });
});

const stats = asyncHandler(async (req, res) => {
  const data = await notificationService.stats();
  sendSuccess(res, data);
});

const retry = asyncHandler(async (req, res) => {
  const result = await notificationService.retryJob(req.params.id);
  if (!result.ok) throw new AppError(result.message, 409);
  sendSuccess(res, { id: result.job._id, status: result.job.status, message: 'Notification queued for retry.' });
});

const eventTypes = asyncHandler(async (req, res) => {
  sendSuccess(res, { eventTypes: EVENT_TYPES, settingKeys: SETTING_KEYS });
});

module.exports = {
  getSettings,
  updateSettings,
  testDiscord,
  testEmail,
  history,
  stats,
  retry,
  eventTypes,
  SETTING_KEYS,
};
