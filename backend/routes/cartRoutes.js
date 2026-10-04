const router = require('express').Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/cartController');

router.use(protect);

router.get('/', ctrl.getCart);
router.post(
  '/items',
  [
    body('productId').isMongoId().withMessage('Invalid product id.'),
    body('quantity').optional().isInt({ min: 1, max: 99 }).withMessage('Quantity must be 1-99.'),
  ],
  validate,
  ctrl.addItem
);
router.patch(
  '/items/:itemId',
  [body('quantity').isInt({ min: 1, max: 99 }).withMessage('Quantity must be 1-99.')],
  validate,
  ctrl.updateItem
);
router.delete('/items/:itemId', ctrl.removeItem);
router.post('/merge', ctrl.mergeCart);

module.exports = router;
