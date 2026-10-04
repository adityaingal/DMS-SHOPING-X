const router = require('express').Router();
const { body, param } = require('express-validator');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/wishlistController');

router.use(protect);

router.get('/', ctrl.getWishlist);
router.post('/items', [body('productId').isMongoId().withMessage('Invalid product id.')], validate, ctrl.addItem);
router.delete(
  '/items/:productId',
  [param('productId').isMongoId().withMessage('Invalid product id.')],
  validate,
  ctrl.removeItem
);

module.exports = router;
