const router = require('express').Router();
const { body } = require('express-validator');
const Newsletter = require('../models/Newsletter');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { authLimiter } = require('../middleware/rateLimiter');

router.post(
  '/',
  authLimiter,
  [body('email').trim().isEmail().withMessage('Please provide a valid email.').normalizeEmail()],
  validate,
  asyncHandler(async (req, res) => {
    const existing = await Newsletter.findOne({ email: req.body.email });
    if (existing) return sendSuccess(res, { message: 'You are already subscribed.' });
    await Newsletter.create({ email: req.body.email });
    sendSuccess(res, { message: 'Subscribed successfully. Welcome to ShopX!' }, 201);
  })
);

module.exports = router;
