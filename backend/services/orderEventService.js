const notificationService = require('./notificationService');
const emailService = require('./emailService');
const { envConfig, validateEmail } = require('../config/notificationConfig');

const STATUS_EVENTS = {
  Confirmed: { eventType: 'order.confirmed', key: 'orderConfirmed' },
  Processing: { eventType: 'order.processing', key: 'orderProcessing' },
  Shipped: { eventType: 'order.shipped', key: 'orderShipped' },
  Delivered: { eventType: 'order.delivered', key: 'orderDelivered' },
  Cancelled: { eventType: 'order.cancelled', key: 'orderCancelled' },
};

const EVENT_LABELS = {
  orderCreated: 'order.created',
  orderConfirmed: 'order.confirmed',
  paymentConfirmed: 'order.payment_confirmed',
  orderProcessing: 'order.processing',
  orderShipped: 'order.shipped',
  orderDelivered: 'order.delivered',
  orderCancelled: 'order.cancelled',
  refundUpdated: 'order.refund_updated',
};

const readEvent = (settings, key) => {
  const events = settings && settings.events;
  const map = events instanceof Map ? events : new Map(Object.entries(events || {}));
  const entry = map.get(key);
  if (!entry) return { discord: true, email: false };
  return {
    discord: entry.discord !== false,
    email: entry.email === true,
  };
};

const channelsFor = (settings, eventKey) => {
  const conf = readEvent(settings, eventKey);
  const channels = [];
  if (settings && settings.discord && settings.discord.enabled && conf.discord) channels.push('discord');
  if (settings && settings.email && settings.email.enabled && conf.email) channels.push('email');
  return channels;
};

const safeKey = (parts) => parts.filter(Boolean).join(':');

const emit = async (order, eventType, eventKey, options = {}) => {
  const jobs = [];
  try {
    const settings = await notificationService.getSettings();
    const channels = options.channels || channelsFor(settings, eventKey);
    const historyLength = (order.statusHistory || []).length;
    const baseKey = safeKey([eventType, order.orderNumber, options.keySuffix != null ? options.keySuffix : historyLength]);

    for (const channel of channels) {
      if (channel === 'discord') {
        const recipient = notificationService.maskedRecipientFor('discord', settings);
        jobs.push(
          await notificationService.enqueue({
            channel: 'discord',
            eventType,
            order,
            dedupeKey: `${baseKey}:discord`,
            recipient,
            payload: options.payload || {},
          })
        );
        const hasPublic = Boolean(settings.discord && settings.discord.publicWebhookUrl);
        if (eventType === 'order.created' && hasPublic) {
          jobs.push(
            await notificationService.enqueue({
              channel: 'discord',
              eventType,
              order,
              dedupeKey: `${baseKey}:discord:public`,
              recipient: notificationService.maskedRecipientFor('discord', settings),
              payload: options.payload || {},
              publicCopy: true,
            })
          );
        }
      }

      if (channel === 'email') {
        if (eventType === 'customer.order_confirmation') {
          const email = order.shippingAddress && order.shippingAddress.email;
          if (!validateEmail(email).ok) continue;
        } else if (!emailService.ownerRecipient(settings).ok) {
          continue;
        }
        jobs.push(
          await notificationService.enqueue({
            channel: 'email',
            eventType,
            order,
            dedupeKey: `${baseKey}:email`,
            recipient:
              eventType === 'customer.order_confirmation'
                ? String(order.shippingAddress.email)
                : notificationService.maskedRecipientFor('email', settings),
            payload: options.payload || {},
          })
        );
      }
    }
  } catch (err) {
    notificationService.log('error', `failed to queue ${eventType}`, err && err.message);
  }
  return jobs.filter(Boolean);
};

const emitOrderCreated = async (order) => {
  const results = [];
  results.push(...(await emit(order, 'order.created', 'orderCreated')));

  const settings = await notificationService.getSettings().catch(() => null);
  const customerEnabled = Boolean(
    settings && settings.email && settings.email.enabled && settings.email.customerConfirmationEnabled
  );
  if (customerEnabled) {
    results.push(
      ...(await emit(order, 'customer.order_confirmation', 'orderCreated', {
        channels: ['email'],
        keySuffix: 'customer',
      }))
    );
  }
  return results;
};

const emitStatusChange = async (order, { status, by = 'system', note = '', at = new Date() } = {}) => {
  const mapping = STATUS_EVENTS[status];
  if (!mapping) return [];
  return emit(order, mapping.eventType, mapping.key, {
    payload: { status, by, note: String(note || '').slice(0, 200), at },
    keySuffix: `status-${status}`,
  });
};

const emitPaymentChange = async (order, { from, to, at = new Date() } = {}) => {
  if (from === to) return [];
  if (to === 'paid') {
    return emit(order, 'order.payment_confirmed', 'paymentConfirmed', {
      payload: { status: order.orderStatus, at, paymentStatus: to },
      keySuffix: `payment-${from}-to-${to}`,
    });
  }
  if (to === 'refunded' || to === 'failed') {
    return emit(order, 'order.refund_updated', 'refundUpdated', {
      payload: { status: order.orderStatus, at, paymentStatus: to },
      keySuffix: `payment-${from}-to-${to}`,
    });
  }
  return [];
};

const emitOrderCancelled = async (order, { by = 'system', note = '', at = new Date() } = {}) =>
  emitStatusChange(order, { status: 'Cancelled', by, note, at });

module.exports = {
  emitOrderCreated,
  emitStatusChange,
  emitPaymentChange,
  emitOrderCancelled,
  channelsFor,
  STATUS_EVENTS,
  EVENT_LABELS,
};
