const mongoose = require('mongoose');

const CHANNELS = ['discord', 'email'];
const STATUSES = ['pending', 'processing', 'sent', 'failed', 'retrying'];
const EVENT_TYPES = [
  'order.created',
  'order.confirmed',
  'order.payment_confirmed',
  'order.processing',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'order.refund_updated',
  'customer.order_confirmation',
  'system.test',
];

const notificationSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    dedupeKey: { type: String, required: true, unique: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    orderNumber: { type: String, default: '', index: true },
    channel: { type: String, enum: CHANNELS, required: true, index: true },
    eventType: { type: String, enum: EVENT_TYPES, required: true, index: true },
    recipient: { type: String, default: '' },
    status: { type: String, enum: STATUSES, default: 'pending', index: true },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5, min: 1 },
    nextAttemptAt: { type: Date, default: () => new Date(), index: true },
    lastAttemptAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    errorCategory: { type: String, default: null },
    errorMessage: { type: String, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    publicCopy: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ status: 1, nextAttemptAt: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ orderNumber: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.CHANNELS = CHANNELS;
module.exports.STATUSES = STATUSES;
module.exports.EVENT_TYPES = EVENT_TYPES;
