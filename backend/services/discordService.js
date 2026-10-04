const NotificationError = require('../utils/NotificationError');
const { validateWebhookUrl, envConfig } = require('../config/notificationConfig');
const { formatOrderTimestamp } = require('../utils/datetime');

const COLORS = {
  new: 0x4f46e5,
  info: 0x2563eb,
  success: 0x059669,
  warning: 0xd97706,
  danger: 0xdc2626,
};

const STATUS_ICONS = {
  Pending: '🕓',
  Confirmed: '✅',
  Processing: '⚙️',
  Shipped: '🚚',
  Delivered: '📦',
  Cancelled: '❌',
};

const PAYMENT_LABELS = { cod: 'Cash on delivery', test: 'Sandbox test payment' };

let transport = null;

const setTransport = (fn) => {
  transport = typeof fn === 'function' ? fn : null;
};

const clamp = (value, max) => {
  const str = String(value == null ? '' : value);
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const safeText = (value) =>
  String(value == null ? '' : value)
    .replace(/@everyone|@here/gi, '')
    .replace(/<@&?\d+>/g, '')
    .trim();

const appBaseUrl = () => {
  const cfg = envConfig();
  if (cfg.appUrl) return cfg.appUrl.replace(/\/$/, '');
  return `http://localhost:${process.env.PORT || 5000}`;
};

const adminOrderLink = (orderNumber) => `${appBaseUrl()}/admin/orders.html?id=${encodeURIComponent(orderNumber)}`;
const adminDashboardLink = () => `${appBaseUrl()}/admin/index.html`;

const itemsBlock = (order) =>
  (order.items || [])
    .map((item) => {
      const unit = item.unitPrice != null ? item.unitPrice : item.price;
      return `• ${clamp(item.name, 70)} × ${item.quantity} — ${money(item.lineTotal)} (${money(unit)} each)`;
    })
    .join('\n');

const amountsBlock = (order) =>
  [
    `Subtotal: ${money(order.subtotal)}`,
    `Shipping fee: ${money(order.shippingFee)}`,
    order.discount ? `Discount${order.promoCode ? ` (${order.promoCode})` : ''}: -${money(order.discount)}` : null,
    `**Total: ${money(order.total)}**`,
  ]
    .filter(Boolean)
    .join('\n');

const customerBlock = (order, includePrivate) => {
  const addr = order.shippingAddress || {};
  const lines = [`Name: ${safeText(addr.fullName || '—')}`];
  if (includePrivate) {
    lines.push(`Email: ${safeText(addr.email || '—')}`);
    lines.push(`Phone: ${safeText(addr.phone || '—')}`);
  }
  return lines.join('\n');
};

const addressBlock = (order) => {
  const addr = order.shippingAddress || {};
  const line2 = addr.line2 ? `, ${addr.line2}` : '';
  return [
    safeText(addr.fullName),
    `${safeText(addr.line1)}${line2}`,
    `${safeText(addr.city)}, ${safeText(addr.state)} ${safeText(addr.postalCode)}`,
    `Phone: ${safeText(addr.phone)}`,
  ]
    .filter(Boolean)
    .join('\n');
};

const buildOrderEmbed = (order, options = {}) => {
  const includePrivate = options.includePrivate !== false;
  const timezone = options.timezone || 'Asia/Kolkata';
  const when = formatOrderTimestamp(order.createdAt || new Date(), timezone);
  const status = order.orderStatus || 'Pending';

  const fields = [
    { name: 'Order ID', value: clamp(order.orderNumber, 100), inline: true },
    { name: 'Status', value: `${STATUS_ICONS[status] || '•'} ${status}`, inline: true },
    { name: 'Placed', value: `${when.date} • ${when.time}`, inline: true },
    {
      name: 'Customer',
      value: clamp(customerBlock(order, includePrivate), 1024),
      inline: true,
    },
    { name: `Items (${(order.items || []).length})`, value: clamp(itemsBlock(order), 1024), inline: true },
    { name: 'Amounts', value: clamp(amountsBlock(order), 1024), inline: true },
    {
      name: 'Payment',
      value: `${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod} • ${order.paymentStatus}`,
      inline: true,
    },
    { name: 'Admin dashboard', value: adminDashboardLink(), inline: true },
  ];

  if (includePrivate) {
    fields.splice(4, 0, { name: 'Shipping address', value: clamp(addressBlock(order), 1024), inline: true });
  }

  const image = (order.items || []).map((i) => i.image).find((u) => /^https?:\/\//i.test(u || ''));

  return {
    username: 'ShopX Orders',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: 'NEW ORDER RECEIVED',
        url: adminOrderLink(order.orderNumber),
        color: COLORS.new,
        description: `${STATUS_ICONS[status] || '•'} A new order has been placed and is waiting for processing.`,
        fields: fields.filter((f) => f && f.value && String(f.value).trim().length),
        ...(image ? { thumbnail: { url: image } } : {}),
        footer: { text: `ShopX • ${order.orderNumber}` },
        timestamp: when.iso || new Date().toISOString(),
      },
    ],
  };
};

const buildStatusEmbed = (order, options = {}) => {
  const includePrivate = options.includePrivate !== false;
  const timezone = options.timezone || 'Asia/Kolkata';
  const status = options.status || order.orderStatus;
  const when = formatOrderTimestamp(options.at || new Date(), timezone);
  const paidTransition = options.paymentStatus && options.paymentStatus !== order.paymentStatus;

  const color =
    status === 'Delivered'
      ? COLORS.success
      : status === 'Cancelled'
        ? COLORS.danger
        : status === 'Shipped'
          ? COLORS.info
          : COLORS.warning;

  const fields = [
    { name: 'Order ID', value: clamp(order.orderNumber, 100), inline: true },
    { name: 'Status', value: `${STATUS_ICONS[status] || '•'} ${status}`, inline: true },
    { name: 'Updated', value: `${when.date} • ${when.time}`, inline: true },
    { name: 'Order total', value: money(order.total), inline: true },
    { name: 'Customer', value: clamp(safeText(order.shippingAddress?.fullName || '—'), 100), inline: true },
  ];

  if (paidTransition) fields.push({ name: 'Payment status', value: order.paymentStatus, inline: true });
  if (options.note) fields.push({ name: 'Note', value: clamp(safeText(options.note), 300), inline: false });
  if (includePrivate) {
    fields.push({ name: 'Shipping address', value: clamp(addressBlock(order), 1024), inline: true });
  }
  fields.push({ name: 'Admin dashboard', value: adminDashboardLink(), inline: true });

  return {
    username: 'ShopX Orders',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `ORDER ${String(status).toUpperCase()}`,
        url: adminOrderLink(order.orderNumber),
        color,
        fields: fields.filter((f) => f && f.value && String(f.value).trim().length),
        footer: { text: `ShopX • ${order.orderNumber}` },
        timestamp: when.iso || new Date().toISOString(),
      },
    ],
  };
};

const buildTextPayload = (text) => ({
  username: 'ShopX',
  allowed_mentions: { parse: [] },
  embeds: [
    {
      title: 'ShopX notification test',
      description: clamp(safeText(text), 500),
      color: COLORS.new,
      footer: { text: 'ShopX notification channel' },
      timestamp: new Date().toISOString(),
    },
  ],
});

const resolveWebhookUrl = (settings, kind = 'orders') => {
  let candidate;
  if (kind === 'status') candidate = settings?.discord?.statusWebhookUrl || settings?.discord?.webhookUrl;
  else if (kind === 'public') candidate = settings?.discord?.publicWebhookUrl || '';
  else candidate = settings?.discord?.webhookUrl;
  if (!candidate) candidate = envConfig().discordWebhookUrl;
  const validated = validateWebhookUrl(candidate);
  if (!validated.ok) {
    throw new NotificationError('Discord webhook is not configured correctly.', {
      category: 'config',
      retryable: false,
    });
  }
  return validated.value;
};

const defaultTransport = async (url, payload) => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 10000) : null;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'ShopX-Notifier/1.0' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined,
    });
  } catch (err) {
    throw new NotificationError('Could not reach Discord.', { category: 'network', retryable: true });
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (res.ok) return { status: res.status };

  const retryHeader = Number(res.headers.get('retry-after'));
  let retryAfterMs = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader * 1000 : null;
  if (res.status === 429 && retryAfterMs == null) {
    try {
      const body = await res.json();
      if (body && body.retry_after != null) retryAfterMs = Math.ceil(Number(body.retry_after) * 1000);
    } catch (e) {
      retryAfterMs = 5000;
    }
  }

  if (res.status === 429) {
    throw new NotificationError('Discord rate limit reached.', {
      category: 'rate_limited',
      retryable: true,
      retryAfterMs: retryAfterMs || 5000,
      status: 429,
    });
  }
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    throw new NotificationError('Discord rejected the webhook URL.', {
      category: 'invalid_webhook',
      retryable: false,
      status: res.status,
    });
  }
  if (res.status >= 500) {
    throw new NotificationError('Discord is temporarily unavailable.', {
      category: 'server_error',
      retryable: true,
      status: res.status,
    });
  }
  throw new NotificationError('Discord refused the notification payload.', {
    category: 'invalid_payload',
    retryable: false,
    status: res.status,
  });
};

const post = async (url, payload) => {
  const validated = validateWebhookUrl(url);
  if (!validated.ok) {
    throw new NotificationError('Blocked unsafe webhook URL.', {
      category: 'invalid_webhook',
      retryable: false,
    });
  }
  if (transport) return transport(validated.value, payload);
  return defaultTransport(validated.value, payload);
};

const sendPayload = async (url, payload) => {
  await post(url, payload);
  return true;
};

module.exports = {
  COLORS,
  STATUS_ICONS,
  setTransport,
  buildOrderEmbed,
  buildStatusEmbed,
  buildTextPayload,
  resolveWebhookUrl,
  sendPayload,
  post,
  money,
  adminOrderLink,
  adminDashboardLink,
};
