// Mini App (customer) API: menu, profile, addresses, favorites, cart quote, orders.
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const botController = require('./botController');
const { HttpError } = require('../middlewares/error.middleware');

const toId = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'bad_id');
  return n;
};

const publicOrder = (order) => ({ ...order, number: botController.orderNumber(order) });

// ---------- menu ----------
async function getMenu(req, res) {
  res.json(await Product.getPublicMenu());
}

// ---------- uploaded photos ----------
async function getImage(req, res) {
  const image = await Product.getImage(req.params.id);
  if (!image) throw new HttpError(404, 'not_found');
  res.set({ 'Content-Type': image.mime, 'Cache-Control': 'public, max-age=31536000, immutable' });
  res.send(Buffer.from(image.data));
}

// ---------- profile ----------
async function getMe(req, res) {
  const [addresses, favoriteIds] = await Promise.all([
    User.listAddresses(req.user.id),
    User.listFavoriteIds(req.user.id),
  ]);
  res.json({ user: req.user, addresses, favoriteIds });
}

async function updateMe(req, res) {
  res.json({ user: await User.updateProfile(req.user.id, req.body || {}) });
}

// ---------- addresses ----------
async function listAddresses(req, res) {
  res.json({ addresses: await User.listAddresses(req.user.id) });
}

async function createAddress(req, res) {
  const address = String(req.body?.address || '').trim();
  if (address.length < 5) throw new HttpError(400, 'address_required');
  res.status(201).json({ address: await User.createAddress(req.user.id, { ...req.body, address }) });
}

async function deleteAddress(req, res) {
  await User.deleteAddress(req.user.id, toId(req.params.id));
  res.json({ ok: true });
}

// ---------- favorites ----------
async function toggleFavorite(req, res) {
  const isFavorite = await User.toggleFavorite(req.user.id, toId(req.params.productId));
  res.json({ isFavorite });
}

// ---------- cart quote ----------
async function quote(req, res) {
  const { items, fulfillment, promoCode, useBonus } = req.body || {};
  const result = await Order.computeTotals({
    user: req.user,
    items,
    fulfillment,
    promoCode,
    useBonus: !!useBonus,
  });
  res.json({
    totals: result.totals,
    promo: result.promo ? { code: result.promo.code, type: result.promo.type, value: result.promo.value } : null,
    promoError: result.promoError,
    lines: result.lines.map((l) => ({ productId: l.productId, unitPrice: l.unitPrice, lineTotal: l.lineTotal })),
  });
}

// ---------- orders ----------
async function createOrder(req, res) {
  const order = await Order.createOrder(req.user, req.body || {});
  // fire and forget: the customer gets the Telegram message, staff watch the admin dashboard
  botController.notifyOrderCreated(order, req.user);
  res.status(201).json({ order: publicOrder(order) });
}

async function listOrders(req, res) {
  const orders = await Order.listForUser(req.user.id);
  res.json({ orders: orders.map(publicOrder) });
}

async function getOrder(req, res) {
  const order = await Order.getForUser(req.user.id, toId(req.params.id));
  if (!order) throw new HttpError(404, 'not_found');
  res.json({ order: publicOrder(order) });
}

// Simulated Click / Payme / Uzum confirmation. Replace with the real gateway callback later.
async function payOrder(req, res) {
  const order = await Order.markPaidSimulated(req.user, toId(req.params.id));
  res.json({ order: publicOrder(order) });
}

async function cancelOrder(req, res) {
  const order = await Order.cancelByCustomer(req.user, toId(req.params.id));
  botController.notifyStatus(order, req.user);
  res.json({ order: publicOrder(order) });
}

module.exports = {
  getMenu,
  getImage,
  getMe,
  updateMe,
  listAddresses,
  createAddress,
  deleteAddress,
  toggleFavorite,
  quote,
  createOrder,
  listOrders,
  getOrder,
  payOrder,
  cancelOrder,
};
