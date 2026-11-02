const express = require('express');
const admin = require('../controllers/adminController');
const { adminLocalOnly, adminAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

const router = express.Router();
const h = asyncHandler;

// The dashboard is for the café staff on this machine only (see ADMIN_LOCAL_ONLY).
router.use(adminLocalOnly);

router.post('/login', h(admin.login));

router.use(adminAuth);

router.get('/stats', h(admin.stats));

router.get('/orders', h(admin.listOrders));
router.patch('/orders/:id/status', h(admin.updateOrderStatus));
router.patch('/orders/:id/payment', h(admin.updateOrderPayment));

router.get('/users', h(admin.listUsers));

router.get('/categories', h(admin.listCategories));
router.post('/categories', h(admin.createCategory));
router.put('/categories/:id', h(admin.updateCategory));
router.delete('/categories/:id', h(admin.deleteCategory));

router.get('/products', h(admin.listProducts));
router.post('/products', h(admin.createProduct));
router.put('/products/:id', h(admin.updateProduct));
router.patch('/products/:id/availability', h(admin.setAvailability));
router.delete('/products/:id', h(admin.deleteProduct));

router.get('/addons', h(admin.listAddons));
router.post('/addons', h(admin.createAddon));
router.put('/addons/:id', h(admin.updateAddon));
router.delete('/addons/:id', h(admin.deleteAddon));

router.get('/promos', h(admin.listPromos));
router.post('/promos', h(admin.createPromo));
router.put('/promos/:id', h(admin.updatePromo));
router.delete('/promos/:id', h(admin.deletePromo));

router.get('/settings', h(admin.getSettings));
router.put('/settings', h(admin.saveSettings));

router.post('/upload', admin.uploadImage);

module.exports = router;
