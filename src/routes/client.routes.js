const express = require('express');
const cart = require('../controllers/cartController');
const { authenticate } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

const router = express.Router();
const h = asyncHandler;

// public
router.get('/menu', h(cart.getMenu));
router.get('/images/:id', h(cart.getImage));

// everything below needs a validated Telegram user
router.use(authenticate);

router.get('/me', h(cart.getMe));
router.patch('/me', h(cart.updateMe));

router.get('/addresses', h(cart.listAddresses));
router.post('/addresses', h(cart.createAddress));
router.delete('/addresses/:id', h(cart.deleteAddress));

router.post('/favorites/:productId', h(cart.toggleFavorite));

router.post('/cart/quote', h(cart.quote));

router.post('/orders', h(cart.createOrder));
router.get('/orders', h(cart.listOrders));
router.get('/orders/:id', h(cart.getOrder));
router.post('/orders/:id/pay', h(cart.payOrder));
router.post('/orders/:id/cancel', h(cart.cancelOrder));

module.exports = router;
