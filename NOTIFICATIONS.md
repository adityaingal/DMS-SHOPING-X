# ShopX — Discord + Gmail Order Notifications

Reliable, persistent order notifications for ShopX. Every important order event is written to a
MongoDB job queue first and then delivered in the background, so a slow or unavailable Discord/SMTP
service can never break order placement.

## What gets sent

| Event | Discord | Store email | Customer email |
| --- | --- | --- | --- |
| New order placed | `NEW ORDER RECEIVED` embed | `NEW SHOPX ORDER — [ORDER ID]` | optional confirmation |
| Order confirmed / processing / shipped / delivered / cancelled | status embed | optional | — |
| Payment confirmed / refund updated | status embed | optional | — |
| Admin test buttons | test embed | test email | — |

Notifications are configured per event in **Admin → Notifications** (each event can independently
alert Discord, email, or both).

## Quick setup

### 1. Discord webhook

1. Discord → your **private** order channel → *Edit channel* → *Integrations* → *New Webhook* → *Copy webhook URL*.
2. Put it in `.env`:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234567890123456789/abcdef...
DISCORD_NOTIFICATIONS_ENABLED=true
```

Only `discord.com` / `discordapp.com` (and canary/ptb) HTTPS webhook URLs are accepted — anything
else is rejected as a possible SSRF attempt.

### 2. Gmail SMTP + App Password

1. Enable 2-Step Verification on the Google account (required for app passwords).
2. Google Account → *Security* → *2-Step Verification* → *App passwords* → create one for “Mail”.
3. Put it in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=store@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
ORDER_NOTIFICATION_EMAIL=store@gmail.com
CUSTOMER_EMAIL_NOTIFICATIONS_ENABLED=false
STORE_TIMEZONE=Asia/Kolkata
```

> Never use your normal Google password, never commit `.env`, and never send these values to the
> browser. The dashboard only ever displays masked values.

### 3. Start the app

```bash
npm start
```

Startup prints non-sensitive configuration warnings if something is missing, e.g.
`[notifications] Email notifications are disabled until SMTP_HOST, SMTP_USER and SMTP_PASS are set.`

## Admin dashboard

**Admin → Notifications** provides:

- enable/disable Discord and Gmail, webhook + recipient configuration (masked, write-only),
- per-event channel selection,
- store timezone,
- *Send Discord test* / *Send email test* (they report the real delivery result — failures return an error, never a fake success),
- notification history with filters (order ID, channel, status, date range), attempt counts and
  safe error categories,
- *Retry* for failed/pending jobs.

## Architecture

```
backend/
  config/notificationConfig.js   env loading, webhook allow-list, masking, startup validation
  models/Notification.js         persistent job + delivery history
  models/NotificationSetting.js  admin-configurable settings (single document)
  services/discordService.js     embed builders + SSRF-safe webhook transport
  services/emailService.js       Nodemailer transport + owner/customer emails
  services/notificationService.js enqueue (idempotent), claim, backoff, history
  services/orderEventService.js  order lifecycle → notification events
  jobs/notificationWorker.js     background queue worker (poll + stale-job recovery)
  templates/orderEmail.html      responsive HTML email (plain-text fallback generated)
  controllers/notificationController.js
  routes/adminNotifications.js   admin-only API under /api/admin/notifications
```

Flow: `createOrder` / `updateOrderStatus` → `orderEventService.emit…` → `Notification` documents
(status `pending`) → worker claims a job → Discord/email delivery → `sent`, or `retrying` with
exponential backoff (5s → 15s → 45s … capped at 15 min), or `failed` after `NOTIFICATION_MAX_ATTEMPTS`.

Reliability properties:

- **Idempotency** — every job has a unique `dedupeKey`, and order creation accepts an optional
  `idempotencyKey` (unique partial index) so retries never create duplicate orders or messages.
- **Persistence** — jobs live in MongoDB, so a restart never silently loses them; jobs stuck in
  `processing` for >5 minutes are recovered at worker start.
- **Isolation** — all emission is fire-and-forget with error capture; a notification failure can
  never fail an order request.
- **Rate limits** — Discord `429` responses honour `retry_after` when scheduling the next attempt.

## Security & privacy

- Discord and SMTP credentials stay on the server (env + admin-only settings collection); API
  responses only ever contain masked values (`https://discord.com/api/webhooks/1234****/abcd****`).
- Webhook URLs are re-validated before every send (protocol, host allow-list, path shape) to block
  SSRF.
- `allowed_mentions: { parse: [] }` stops order content from pinging `@everyone`.
- The optional **public** Discord channel receives a redacted summary: no phone, email or delivery
  address.
- Notifications contain no passwords, password hashes, tokens or cookies.
- Settings and history endpoints require `protect` + `authorize('admin')`.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/notifications/settings` | masked settings + capabilities |
| PATCH | `/api/admin/notifications/settings` | update settings |
| POST | `/api/admin/notifications/test/discord` | real Discord test delivery |
| POST | `/api/admin/notifications/test/email` | real email test delivery |
| GET | `/api/admin/notifications/history` | filterable job history |
| GET | `/api/admin/notifications/stats` | counts by status |
| POST | `/api/admin/notifications/jobs/:id/retry` | requeue a job |

## Testing

```bash
npm test
```

`backend/tests/notifications.test.js` mocks the Discord and email transports (no real customer data
or external calls) and covers order creation, payload accuracy, timezone formatting, webhook/SMTP
outages, retries without duplicates, restart recovery, authorization, secret exposure, status-change
notifications and public-channel redaction.
