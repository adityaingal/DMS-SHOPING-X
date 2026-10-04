const router = require('express').Router();
const { body, param } = require('express-validator');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/orderController');

router.use(protect);

router.post(
  '/',
  [
    body('paymentMethod').optional().isIn(['cod', 'test']).withMessage('Unsupported payment method.'),
    body('shippingAddress').isObject().withMessage('Shipping address is required.'),
    body('shippingAddress.fullName').trim().notEmpty().withMessage('Full name is required.'),
    body('shippingAddress.phone').trim().isLength({ min: 6, max: 20 }).withMessage('Valid phone is required.'),
    body('shippingAddress.line1').trim().notEmpty().withMessage('Address line is required.'),
    body('shippingAddress.city').trim().notEmpty().withMessage('City is required.'),
    body('shippingAddress.state').trim().notEmpty().withMessage('State is required.'),
    body('shippingAddress.postalCode').trim().isLength({ min: 4, max: 12 }).withMessage('Valid postal code is required.'),
  ],
  validate,
  ctrl.createOrder
);

router.get('/my-orders', ctrl.getMyOrders);
router.get('/:id', [param('id').isMongoId().withMessage('Invalid order id.')], validate, ctrl.getOrderById);
router.patch('/:id/cancel', [param('id').isMongoId().withMessage('Invalid order id.')], validate, ctrl.cancelOrder);

module.exports = router;
