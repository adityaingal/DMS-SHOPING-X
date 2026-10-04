const router = require('express').Router();
const { body, param } = require('express-validator');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/productController');

router.get('/', ctrl.listProducts);
router.get('/meta', ctrl.productMeta);
router.get('/featured', ctrl.featuredProducts);
router.get('/search', ctrl.searchProducts);
router.get('/slug/:slug', ctrl.getProductBySlug);

router.get('/:id/reviews', ctrl.getReviews);
router.post(
  '/:id/reviews',
  protect,
  [
    param('id').isMongoId().withMessage('Invalid product id.'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
    body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Review is too long.'),
  ],
  validate,
  ctrl.createReview
);

router.get('/:id/related', ctrl.getRelatedProducts);
router.get('/:id', ctrl.getProductById);

module.exports = router;
