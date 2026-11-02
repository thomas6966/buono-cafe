// Admin Web Dashboard API (localhost only): orders, menu CRUD, promos, settings.
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const config = require('../config/default');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const botController = require('./botController');
const { signAdminToken } = require('../middlewares/auth.middleware');
const { HttpError } = require('../middlewares/error.middleware');

const toId = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'bad_id');
  return n;
};
const withNumber = (o) => ({ ...o, number: botController.orderNumber(o) });

// ---------- auth ----------
const attempts = new Map(); // ip -> { count, resetAt }
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function login(req, res) {
  const key = req.ip;
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
    throw new HttpError(429, 'too_many_attempts');
  }

  const given = Buffer.from(String(req.body?.password || ''));
  const expected = Buffer.from(config.adminPassword);
  const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);

  if (!ok) {
    const fresh = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + WINDOW_MS };
    fresh.count += 1;
    attempts.set(key, fresh);
    throw new HttpError(401, 'wrong_password');
  }
  attempts.delete(key);
  res.json({ token: signAdminToken() });
}

// ---------- dashboard / orders ----------
async function stats(req, res) {
  res.json(await Order.getStats());
}

async function listOrders(req, res) {
  const orders = await Order.listForAdmin({ status: req.query.status, since: req.query.since });
  res.json({ orders: orders.map(withNumber) });
}

async function updateOrderStatus(req, res) {
  const allowed = ['PENDING', 'PREPARING', 'READY', 'ON_THE_WAY', 'COMPLETED', 'CANCELLED'];
  if (!allowed.includes(req.body?.status)) throw new HttpError(400, 'status_invalid');
  const order = await Order.updateStatus(toId(req.params.id), req.body.status);
  botController.notifyStatus(order, order.user);
  res.json({ order: withNumber(order) });
}

async function updateOrderPayment(req, res) {
  const order = await Order.setPaymentStatus(toId(req.params.id), req.body?.paymentStatus);
  res.json({ order: withNumber(order) });
}

async function listUsers(req, res) {
  res.json({ users: await User.listAll() });
}

// ---------- categories ----------
const listCategories = async (req, res) => res.json({ categories: await Product.listCategories() });
const createCategory = async (req, res) => res.status(201).json({ category: await Product.createCategory(req.body) });
const updateCategory = async (req, res) =>
  res.json({ category: await Product.updateCategory(toId(req.params.id), req.body) });
const deleteCategory = async (req, res) => {
  await Product.deleteCategory(toId(req.params.id));
  res.json({ ok: true });
};

// ---------- products ----------
const listProducts = async (req, res) => res.json({ products: await Product.listProducts() });
const createProduct = async (req, res) => res.status(201).json({ product: await Product.createProduct(req.body) });
const updateProduct = async (req, res) =>
  res.json({ product: await Product.updateProduct(toId(req.params.id), req.body) });
const setAvailability = async (req, res) =>
  res.json({ product: await Product.setProductAvailability(toId(req.params.id), req.body?.isAvailable) });
const deleteProduct = async (req, res) => {
  await Product.deleteProduct(toId(req.params.id));
  res.json({ ok: true });
};

// ---------- addons ----------
const listAddons = async (req, res) => res.json({ addons: await Product.listAddons() });
const createAddon = async (req, res) => res.status(201).json({ addon: await Product.createAddon(req.body) });
const updateAddon = async (req, res) => res.json({ addon: await Product.updateAddon(toId(req.params.id), req.body) });
const deleteAddon = async (req, res) => {
  await Product.deleteAddon(toId(req.params.id));
  res.json({ ok: true });
};

// ---------- promo codes ----------
const listPromos = async (req, res) => res.json({ promos: await Order.listPromos() });
const createPromo = async (req, res) => res.status(201).json({ promo: await Order.createPromo(req.body) });
const updatePromo = async (req, res) => res.json({ promo: await Order.updatePromo(toId(req.params.id), req.body) });
const deletePromo = async (req, res) => {
  await Order.deletePromo(toId(req.params.id));
  res.json({ ok: true });
};

// ---------- settings ----------
const getSettings = async (req, res) => res.json({ settings: await Product.getSettings() });
const saveSettings = async (req, res) => res.json({ settings: await Product.saveSettings(req.body || {}) });

// ---------- image upload ----------
// Photos are resized and stored in the database (the host disk is ephemeral).
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(ALLOWED.has(file.mimetype) ? null : new HttpError(400, 'bad_image'), ALLOWED.has(file.mimetype)),
}).single('image');

function uploadImage(req, res, next) {
  upload(req, res, async (err) => {
    if (err) return next(err instanceof HttpError ? err : new HttpError(400, 'upload_failed'));
    if (!req.file) return next(new HttpError(400, 'no_file'));
    try {
      const data = await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const image = await Product.createImage('image/webp', data);
      res.status(201).json({ url: `/api/client/images/${image.id}` });
    } catch {
      next(new HttpError(400, 'bad_image'));
    }
  });
}

module.exports = {
  login,
  stats,
  listOrders,
  updateOrderStatus,
  updateOrderPayment,
  listUsers,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listProducts,
  createProduct,
  updateProduct,
  setAvailability,
  deleteProduct,
  listAddons,
  createAddon,
  updateAddon,
  deleteAddon,
  listPromos,
  createPromo,
  updatePromo,
  deletePromo,
  getSettings,
  saveSettings,
  uploadImage,
};
