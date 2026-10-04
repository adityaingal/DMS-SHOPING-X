const nodemailer = require('nodemailer');
const NotificationError = require('../utils/NotificationError');
const { envConfig, emailConfigured, validateEmail } = require('../config/notificationConfig');
const { renderOrderEmail } = require('../templates');
const { adminOrderLink } = require('./discordService');

let injectedTransport = null;
let cachedTransport = null;

const setTransport = (fn) => {
  injectedTransport = typeof fn === 'function' ? fn : null;
  cachedTransport = null;
};

const isConfigured = () => emailConfigured();

const buildTransport = () => {
  if (injectedTransport) return { kind: 'injected', send: injectedTransport };
  if (!isConfigured()) {
    throw new NotificationError('Email service is not configured.', {
      category: 'smtp_config',
      retryable: false,
    });
  }
  if (!cachedTransport) {
    const cfg = envConfig();
    cachedTransport = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpSecure,
      auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });
  }
  return { kind: 'nodemailer', send: (message) => cachedTransport.sendMail(message) };
};

const classify = (err) => {
  if (err instanceof NotificationError) return err;
  const code = err && err.code ? String(err.code) : '';
  const status = err && err.responseCode ? Number(err.responseCode) : null;

  if (code === 'EAUTH' || status === 535 || status === 534) {
    return new NotificationError('SMTP authentication failed.', {
      category: 'smtp_auth',
      retryable: false,
      status,
    });
  }
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'ECONNRESET', 'EDNS', 'EPIPE'].includes(code)) {
    return new NotificationError('Could not reach the mail server.', {
      category: 'smtp_network',
      retryable: true,
      status,
    });
  }
  if (code === 'EENVELOPE' || code === 'EMESSAGE') {
    return new NotificationError('The recipient address was rejected.', {
      category: 'smtp_rejected',
      retryable: false,
      status,
    });
  }
  if (status && status >= 500) {
    return new NotificationError('The mail server returned an error.', {
      category: 'smtp_server',
      retryable: true,
      status,
    });
  }
  if (status && status >= 400) {
    return new NotificationError('The mail server rejected the message.', {
      category: 'smtp_rejected',
      retryable: false,
      status,
    });
  }
  return new NotificationError('The email could not be sent.', {
    category: 'smtp_unknown',
    retryable: true,
    status,
  });
};

const sendMail = async ({ to, subject, html, text }) => {
  const recipient = validateEmail(to);
  if (!recipient.ok) {
    throw new NotificationError('Notification recipient email is invalid.', {
      category: 'smtp_config',
      retryable: false,
    });
  }
  const cfg = envConfig();
  const transport = buildTransport();
  try {
    await transport.send({
      from: `"${cfg.storeName} Store" <${cfg.smtpUser || 'no-reply@shopx.local'}>`,
      to: recipient.value,
      subject,
      html,
      text,
      replyTo: cfg.orderNotificationEmail || undefined,
    });
    return { recipient: recipient.value };
  } catch (err) {
    throw classify(err);
  }
};

const ownerRecipient = (settings) => {
  const cfg = envConfig();
  const candidate = (settings && settings.email && settings.email.recipientEmail) || cfg.orderNotificationEmail;
  return validateEmail(candidate);
};

const sendOrderEmail = async (order, settings) => {
  const recipient = ownerRecipient(settings);
  if (!recipient.ok) {
    throw new NotificationError('No store notification email configured.', {
      category: 'smtp_config',
      retryable: false,
    });
  }
  const message = renderOrderEmail(order, {
    heading: 'NEW ORDER NOTIFICATION',
    subject: `NEW SHOPX ORDER — [${order.orderNumber}]`,
    statusBadge: order.orderStatus || 'Confirmed',
    adminUrl: adminOrderLink(order.orderNumber),
    storeName: (settings && settings.email && settings.email.senderName) || undefined,
    timezone: settings ? settings.storeTimezone : undefined,
    footerNote: 'This is an automatic order alert for the ShopX store owner.',
  });
  return sendMail({ to: recipient.value, ...message });
};

const sendCustomerConfirmation = async (order, settings) => {
  const email = order.shippingAddress && order.shippingAddress.email;
  const message = renderOrderEmail(order, {
    heading: 'ORDER CONFIRMATION',
    subject: `Order confirmation — ${order.orderNumber}`,
    statusBadge: order.orderStatus || 'Confirmed',
    adminUrl: '',
    storeName: (settings && settings.email && settings.email.senderName) || undefined,
    timezone: settings ? settings.storeTimezone : undefined,
    footerNote:
      'Thank you for shopping with ShopX. Support: support@shopx.example • +91 90000 12345. This confirmation contains your order details only.',
  });
  return sendMail({ to: email, ...message });
};

const sendTestEmail = async (settings) => {
  const recipient = ownerRecipient(settings);
  if (!recipient.ok) {
    throw new NotificationError('No valid notification email configured.', {
      category: 'smtp_config',
      retryable: false,
    });
  }
  const stamp = new Date().toISOString();
  return sendMail({
    to: recipient.value,
    subject: 'ShopX notification test',
    html: `<p><strong>ShopX email notifications are working.</strong></p><p>Sent at ${stamp}</p>`,
    text: `ShopX email notifications are working.\nSent at ${stamp}`,
  });
};

module.exports = {
  setTransport,
  isConfigured,
  sendMail,
  sendOrderEmail,
  sendCustomerConfirmation,
  sendTestEmail,
  ownerRecipient,
};
