const fs = require('fs');
const path = require('path');
const { formatOrderTimestamp } = require('../utils/datetime');
const { envConfig } = require('../config/notificationConfig');

const TEMPLATE_PATH = path.join(__dirname, 'orderEmail.html');

let cachedTemplate = null;

const loadTemplate = () => {
  if (cachedTemplate === null) cachedTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return cachedTemplate;
};

const escapeHtml = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const safeImageUrl = (value) => (/^https?:\/\//i.test(String(value || '')) ? String(value) : '');

const paymentLabel = (method) => ({ cod: 'Cash on delivery', test: 'Sandbox test payment' }[method] || method);

const itemsRowsHtml = (items) =>
  items
    .map((item) => {
      const image = safeImageUrl(item.image);
      const thumb = image
        ? `<img src="${escapeHtml(image)}" alt="" width="42" height="42" style="border-radius:8px;object-fit:cover;vertical-align:middle;margin-right:10px;" />`
        : '';
      return (
        '<tr>' +
        `<td style="padding:10px 12px;font-size:13.5px;border-bottom:1px solid #f1f5f9;">${thumb}${escapeHtml(item.name)}</td>` +
        `<td align="center" style="padding:10px 8px;font-size:13.5px;border-bottom:1px solid #f1f5f9;">${escapeHtml(item.quantity)}</td>` +
        `<td align="right" style="padding:10px 12px;font-size:13.5px;border-bottom:1px solid #f1f5f9;">${money(item.lineTotal)}</td>` +
        '</tr>'
      );
    })
    .join('');

const addressLines = (order) => {
  const addr = order.shippingAddress || {};
  const line2 = addr.line2 ? `, ${addr.line2}` : '';
  return [
    addr.fullName,
    `${addr.line1}${line2}`,
    `${addr.city}, ${addr.state} ${addr.postalCode}`,
    `Phone: ${addr.phone}`,
  ].filter(Boolean);
};

const buildContext = (order, options) => {
  const cfg = envConfig();
  const timezone = options.timezone || cfg.storeTimezone;
  const when = formatOrderTimestamp(order.createdAt || new Date(), timezone);
  const items = order.items || [];
  const addr = order.shippingAddress || {};

  return {
    storeName: options.storeName || cfg.storeName,
    heading: options.heading,
    orderNumber: order.orderNumber,
    statusBadge: options.statusBadge || order.orderStatus || 'Confirmed',
    orderDateTime: `${when.date} at ${when.time}`,
    storeTimezone: timezone,
    customerName: addr.fullName || 'Customer',
    customerEmail: addr.email || '—',
    customerPhone: addr.phone || '—',
    itemsRows: itemsRowsHtml(items),
    subtotal: money(order.subtotal),
    shippingFee: money(order.shippingFee),
    discount: money(order.discount || 0),
    promoCodeLabel: order.promoCode ? ` (${order.promoCode})` : '',
    total: money(order.total),
    paymentMethod: paymentLabel(order.paymentMethod),
    paymentStatus: order.paymentStatus,
    addressBlock: addressLines(order)
      .map((l) => escapeHtml(l))
      .join('<br/>'),
    adminUrl: options.adminUrl || '',
    footerNote: options.footerNote || '',
    plainItems: items.map((i) => `- ${i.name} x ${i.quantity} = ${money(i.lineTotal)}`).join('\n'),
    plainAddress: addressLines(order).join('\n'),
  };
};

const renderOrderEmail = (order, options = {}) => {
  const ctx = buildContext(order, options);
  const html = loadTemplate().replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(ctx, key) ? String(ctx[key]) : ''
  );

  const lines = [
    options.heading,
    '',
    `Order: ${ctx.orderNumber}`,
    `Status: ${ctx.statusBadge}`,
    `Placed: ${ctx.orderDateTime} (${ctx.storeTimezone})`,
    '',
    'Customer:',
    `${ctx.customerName}`,
    `${ctx.customerEmail}`,
    `${ctx.customerPhone}`,
    '',
    'Items:',
    ctx.plainItems,
    '',
    `Subtotal: ${ctx.subtotal}`,
    `Shipping fee: ${ctx.shippingFee}`,
    `Discount${ctx.promoCodeLabel}: -${ctx.discount}`,
    `Total: ${ctx.total}`,
    '',
    `Payment: ${ctx.paymentMethod} (${ctx.paymentStatus})`,
    '',
    'Delivery address:',
    ctx.plainAddress,
  ];

  if (options.adminUrl) {
    lines.push('', `Admin dashboard: ${options.adminUrl}`);
  }
  if (options.footerNote) lines.push('', options.footerNote);

  return {
    subject: options.subject,
    html,
    text: lines.filter((l) => l !== undefined).join('\n'),
  };
};

module.exports = { renderOrderEmail, escapeHtml, money };
