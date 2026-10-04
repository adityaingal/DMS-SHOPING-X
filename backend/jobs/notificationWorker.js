const notificationService = require('../services/notificationService');
const discordService = require('../services/discordService');
const emailService = require('../services/emailService');

const POLL_MS = Number(process.env.NOTIFICATION_POLL_MS) || 3000;
const BATCH_SIZE = 10;

let timer = null;
let ticking = false;
let started = false;

const normalizeError = (err) => {
  if (err && err.category) return err;
  const wrapped = new Error((err && err.message) || 'Notification delivery failed.');
  wrapped.category = 'unknown';
  wrapped.retryable = true;
  return wrapped;
};

const processJob = async (job) => {
  const settings = await notificationService.getSettings();
  try {
    if (job.channel === 'discord') {
      const orderEvent = job.eventType !== 'system.test';
      if (orderEvent && settings.discord && !settings.discord.enabled) {
        const disabled = new Error('Discord notifications are disabled.');
        disabled.category = 'disabled';
        disabled.retryable = false;
        throw disabled;
      }
      const url = notificationService.resolveWebhookForJob(job, settings);
      const order = orderEvent ? await notificationService.loadOrder(job) : null;
      const payload = notificationService.buildPayloadForJob(job, order, settings);
      await discordService.sendPayload(url, payload);
    } else if (job.channel === 'email') {
      const order = await notificationService.loadOrder(job);
      if (job.eventType === 'system.test') {
        await emailService.sendTestEmail(settings);
      } else {
        if (!order) {
          const missing = new Error('Order no longer exists.');
          missing.category = 'payload';
          missing.retryable = false;
          throw missing;
        }
        if (settings.email && !settings.email.enabled) {
          const disabled = new Error('Email notifications are disabled.');
          disabled.category = 'disabled';
          disabled.retryable = false;
          throw disabled;
        }
        if (job.eventType === 'customer.order_confirmation') {
          await emailService.sendCustomerConfirmation(order, settings);
        } else {
          await emailService.sendOrderEmail(order, settings);
        }
      }
    } else {
      const unsupported = new Error('Unsupported notification channel.');
      unsupported.category = 'payload';
      unsupported.retryable = false;
      throw unsupported;
    }

    await notificationService.markSent(job);
    notificationService.log('info', `sent ${job.channel}/${job.eventType} for ${job.orderNumber || 'n/a'}`);
    return { ok: true };
  } catch (err) {
    const failure = normalizeError(err);
    await notificationService.markFailure(job, failure);
    return { ok: false, error: failure };
  }
};

const runOnce = async () => {
  let processed = 0;
  for (let i = 0; i < BATCH_SIZE; i++) {
    let job;
    try {
      job = await notificationService.claimNextJob();
    } catch (err) {
      notificationService.log('error', 'queue poll failed', err && err.message);
      break;
    }
    if (!job) break;
    await processJob(job);
    processed += 1;
  }
  return processed;
};

const tick = async () => {
  if (ticking || !started) return;
  ticking = true;
  try {
    await runOnce();
  } catch (err) {
    notificationService.log('error', 'worker tick failed', err && err.message);
  } finally {
    ticking = false;
  }
};

const start = async ({ intervalMs = POLL_MS, recover = true } = {}) => {
  if (started) return;
  started = true;
  if (recover) {
    try {
      await notificationService.recoverStaleJobs();
    } catch (err) {
      notificationService.log('error', 'stale job recovery failed', err && err.message);
    }
  }
  const schedule = () => {
    timer = setTimeout(async () => {
      await tick();
      if (started) schedule();
    }, intervalMs);
    if (timer.unref) timer.unref();
  };
  schedule();
  notificationService.log('info', `notification worker started (poll ${intervalMs}ms)`);
};

const stop = () => {
  started = false;
  if (timer) clearTimeout(timer);
  timer = null;
};

const isRunning = () => started;

module.exports = { start, stop, runOnce, processJob, isRunning };
