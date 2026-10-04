const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/notificationController');
const { STATUSES } = require('../models/Notification');

router.use(protect, authorize('admin'));

router.get('/settings', ctrl.getSettings);

router.patch(
  '/settings',
  [
    body('storeTimezone').optional().isString().trim().isLength({ min: 1, max: 64 }),
    body('discord.webhookUrl').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
    body('discord.statusWebhookUrl').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
    body('discord.publicWebhookUrl').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
    body('email.recipientEmail').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
    body('email.senderName').optional({ values: 'falsy' }).isString().isLength({ max: 60 }),
  ],
  validate,
  ctrl.updateSettings
);

router.post('/test/discord', ctrl.testDiscord);
router.post('/test/email', ctrl.testEmail);

router.get(
  '/history',
  [
    query('channel').optional().isIn(['discord', 'email']),
    query('status').optional().isIn(STATUSES),
    query('eventType').optional().isString().trim().isLength({ max: 60 }),
    query('orderId').optional().isString().trim().isLength({ max: 60 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  ctrl.history
);

router.get('/stats', ctrl.stats);
router.get('/event-types', ctrl.eventTypes);
router.post('/jobs/:id/retry', param('id').isMongoId().withMessage('Invalid notification id.'), validate, ctrl.retry);

module.exports = router;
