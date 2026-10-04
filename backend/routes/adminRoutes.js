const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const ctrl = require('../controllers/adminController');

router.use(protect, authorize('admin'));

router.get('/dashboard', ctrl.getDashboard);

router.get('/products', ctrl.listAdminProducts);
router.post('/products', upload.array('imageFiles', 5), ctrl.createProduct);
router.patch('/products/:id', upload.array('imageFiles', 5), ctrl.updateProduct);
router.delete('/products/:id', ctrl.deleteProduct);

router.get('/orders', ctrl.listAdminOrders);
router.patch('/orders/:id', ctrl.updateOrderStatus);

router.get('/customers', ctrl.listCustomers);
router.get('/customers/:id', ctrl.getCustomer);

router.get('/categories', ctrl.listCategories);
router.post('/categories', ctrl.createCategory);
router.patch('/categories/:id', ctrl.updateCategory);
router.delete('/categories/:id', ctrl.deleteCategory);

router.delete('/reviews/:id', ctrl.deleteReview);

module.exports = router;
