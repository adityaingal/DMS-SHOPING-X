const router = require('express').Router();
const ctrl = require('../controllers/categoryController');

router.get('/', ctrl.listCategories);
router.get('/:slug', ctrl.getCategoryBySlug);

module.exports = router;
