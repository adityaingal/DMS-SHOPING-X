const WEBHOOK_HOSTS = new Set([
  'discord.com',
  'www.discord.com',
  'discordapp.com',
  'www.discordapp.com',
  'canary.discord.com',
  'ptb.discord.com',
]);

const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;

const envConfig = () => ({
  discordEnabled: String(process.env.DISCORD_NOTIFICATIONS_ENABLED || 'true').toLowerCase() !== 'false',
  discordWebhookUrl: (process.env.DISCORD_WEBHOOK_URL || '').trim(),
  smtpHost: (process.env.SMTP_HOST || '').trim(),
  smtpPort: SMTP_PORT,
  smtpSecure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || SMTP_PORT === 465,
  smtpUser: (process.env.SMTP_USER || '').trim(),
  smtpPass: process.env.SMTP_PASS || '',
  orderNotificationEmail: (process.env.ORDER_NOTIFICATION_EMAIL || '').trim(),
  customerEmailsEnabled: String(process.env.CUSTOMER_EMAIL_NOTIFICATIONS_ENABLED || 'false').toLowerCase() === 'true',
  storeTimezone: (process.env.STORE_TIMEZONE || 'Asia/Kolkata').trim(),
  storeName: (process.env.STORE_NAME || 'ShopX').trim(),
  appUrl: (process.env.APP_URL || '').trim(),
});

const validateWebhookUrl = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return { ok: false, error: 'A Discord webhook URL is required.' };
  let url;
  try {
    url = new URL(value);
  } catch (e) {
    return { ok: false, error: 'The webhook URL is not a valid URL.' };
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'The webhook URL must use https.' };
  if (!WEBHOOK_HOSTS.has(url.hostname)) {
    return { ok: false, error: 'Only official Discord webhook hosts are allowed.' };
  }
  if (!/^\/api\/webhooks\/\d{10,}\/[\w-]{10,}\/?$/.test(url.pathname)) {
    return { ok: false, error: 'This does not look like a Discord webhook URL.' };
  }
  if (url.username || url.password || url.search || url.hash) {
    return { ok: false, error: 'The webhook URL contains unsupported parts.' };
  }
  return { ok: true, value: url.toString() };
};

const validateTimezone = (tz) => {
  const value = String(tz || '').trim() || 'Asia/Kolkata';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: 'Unknown timezone.' };
  }
};

const validateEmail = (value) => {
  const v = String(value || '').trim();
  if (!v) return { ok: false, error: 'A notification email address is required.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { ok: false, error: 'Enter a valid email address.' };
  return { ok: true, value: v };
};

const maskWebhook = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[2] || '';
    const token = parts[3] || '';
    const shortId = id ? `${id.slice(0, 4)}${'*'.repeat(Math.max(id.length - 4, 1))}` : '';
    const shortToken = token ? `${token.slice(0, 4)}${'*'.repeat(4)}` : '';
    return `${url.origin}/api/webhooks/${shortId}/${shortToken}`;
  } catch (e) {
    return '********';
  }
};

const maskEmail = (raw) => {
  const value = String(raw || '').trim();
  if (!value || !value.includes('@')) return value ? '********' : null;
  const [local, domain] = value.split('@');
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
};

const maskSecret = (raw) => {
  const value = String(raw || '');
  if (!value) return null;
  return `${value.slice(0, 2)}${'*'.repeat(6)}`;
};

const validateNotificationConfig = () => {
  const cfg = envConfig();
  const errors = [];
  const warnings = [];

  const tz = validateTimezone(cfg.storeTimezone);
  if (!tz.ok) errors.push('STORE_TIMEZONE is not a valid timezone.');

  if (cfg.discordEnabled) {
    const hook = validateWebhookUrl(cfg.discordWebhookUrl);
    if (!hook.ok) warnings.push('Discord notifications are enabled but no valid DISCORD_WEBHOOK_URL is set.');
  }

  const smtpMissing = !cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass;
  if (smtpMissing) {
    warnings.push('Email notifications are disabled until SMTP_HOST, SMTP_USER and SMTP_PASS are set.');
  }
  if (!cfg.orderNotificationEmail && !cfg.customerEmailsEnabled) {
    warnings.push('No ORDER_NOTIFICATION_EMAIL configured, store owner emails are disabled.');
  }

  return { ok: errors.length === 0, errors, warnings, config: cfg };
};

const emailConfigured = () => {
  const cfg = envConfig();
  return Boolean(cfg.smtpHost && cfg.smtpUser && cfg.smtpPass);
};

const discordConfigured = () => Boolean(validateWebhookUrl(envConfig().discordWebhookUrl).ok);

module.exports = {
  WEBHOOK_HOSTS,
  envConfig,
  validateWebhookUrl,
  validateTimezone,
  validateEmail,
  validateNotificationConfig,
  maskWebhook,
  maskEmail,
  maskSecret,
  emailConfigured,
  discordConfigured,
};
