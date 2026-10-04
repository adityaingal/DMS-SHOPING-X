const router = require('express').Router();
const { body } = require('express-validator');
const { authLimiter } = require('../middleware/rateLimiter');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/authController');

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters.'),
    body('email').trim().isEmail().withMessage('Please provide a valid email.').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
      .matches(/\d/).withMessage('Password must contain a number.'),
    body('confirmPassword').optional().custom((value, { req }) => {
      if (value !== req.body.password) throw new Error('Passwords do not match.');
      return true;
    }),
  ],
  validate,
  ctrl.register
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').trim().isEmail().withMessage('Please provide a valid email.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validate,
  ctrl.login
);

router.post('/logout', ctrl.logout);
router.get('/me', protect, ctrl.me);

const googleRules = [
  body('credential')
    .isString()
    .trim()
    .isLength({ min: 20, max: 8192 })
    .withMessage('A valid Google credential is required.'),
];

router.get('/google/config', ctrl.googleConfig);
router.post('/google', authLimiter, googleRules, validate, ctrl.googleLogin);
router.post('/google/link', protect, authLimiter, googleRules, validate, ctrl.googleLink);

router.patch(
  '/profile',
  protect,
  [
    body('name').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters.'),
    body('email').optional().trim().isEmail().withMessage('Please provide a valid email.').normalizeEmail(),
    body('phone').optional().trim().isLength({ max: 20 }),
  ],
  validate,
  ctrl.updateProfile
);

router.patch(
  '/password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.')
      .matches(/\d/).withMessage('New password must contain a number.'),
  ],
  validate,
  ctrl.changePassword
);

const addressRules = [
  body('fullName').trim().isLength({ min: 2, max: 80 }).withMessage('Full name is required.'),
  body('phone').trim().isLength({ min: 6, max: 20 }).withMessage('Phone number is required.'),
  body('line1').trim().isLength({ min: 3, max: 120 }).withMessage('Address line is required.'),
  body('city').trim().isLength({ min: 2, max: 60 }).withMessage('City is required.'),
  body('state').trim().isLength({ min: 2, max: 60 }).withMessage('State is required.'),
  body('postalCode').trim().isLength({ min: 4, max: 12 }).withMessage('Postal code is required.'),
];

router.post('/addresses', protect, addressRules, validate, ctrl.addAddress);
router.patch('/addresses/:addressId', protect, ctrl.updateAddress);
router.delete('/addresses/:addressId', protect, ctrl.deleteAddress);

module.exports = router;
