const prisma = require('../database/connection');
const Product = require('./Product');
const { HttpError } = require('../middlewares/error.middleware');

const ACTIVE_STATUSES = ['PENDING', 'PREPARING', 'READY', 'ON_THE_WAY'];
const FULFILLMENTS = ['DINE_IN', 'TAKEAWAY', 'DELIVERY'];
const PAYMENTS = ['CLICK', 'PAYME', 'UZUM', 'CASH', 'TERMINAL'];
const ONLINE_PAYMENTS = ['CLICK', 'PAYME', 'UZUM'];
const SUGAR_STEPS = [0, 25, 50, 75, 100];

const orderInclude = { items: { orderBy: { id: 'asc' } } };

// ---------- promo codes ----------
const normalizeCode = (code) => String(code || '').trim().toUpperCase();

async function findPromo(code) {
  const c = normalizeCode(code);
  if (!c) return null;
  return prisma.promoCode.findUnique({ where: { code: c } });
}

// Returns { promo, discount } or throws HttpError(400, <reason>)
function applyPromo(promo, subtotal) {
  if (!promo || !promo.isActive) throw new HttpError(400, 'promo_invalid');
  if (promo.expiresAt && promo.expiresAt < new Date()) throw new HttpError(400, 'promo_expired');
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) throw new HttpError(400, 'promo_used_up');
  if (subtotal < promo.minOrder) throw new HttpError(400, 'promo_min_order', { minOrder: promo.minOrder });
  const discount =
    promo.type === 'PERCENT' ? Math.floor((subtotal * promo.value) / 100) : Math.min(promo.value, subtotal);
  return { promo, discount };
}

// ---------- pricing (server is the single source of truth) ----------
async function priceItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
    throw new HttpError(400, 'cart_invalid');
  }

  const ids = [...new Set(rawItems.map((i) => Number(i.productId)).filter(Number.isInteger))];
  const [products, addons] = await Promise.all([Product.getProductsByIds(ids), Product.getActiveAddons()]);
  const byId = new Map(products.map((p) => [p.id, p]));

  return rawItems.map((raw) => {
    const product = byId.get(Number(raw.productId));
    if (!product || !product.isAvailable || !product.category.isActive) {
      throw new HttpError(409, 'product_unavailable', { productId: Number(raw.productId) });
    }
    const quantity = Math.min(50, Math.max(1, Math.floor(Number(raw.quantity) || 1)));
    const slug = product.category.slug;

    let unitPrice = product.price;
    let variantLabel = null;
    const options = {};

    if (product.variants.length) {
      const variant = product.variants.find((v) => v.id === Number(raw.variantId)) || product.variants[0];
      unitPrice = variant.price;
      variantLabel = variant.label;
      options.variantId = variant.id;
    }

    if (raw.milkId) {
      const milk = addons.find((a) => a.id === Number(raw.milkId) && a.kind === 'MILK' && a.categorySlugs.includes(slug));
      if (!product.allowMilk || !milk) throw new HttpError(400, 'option_invalid');
      unitPrice += milk.price;
      options.milk = { id: milk.id, nameUz: milk.nameUz, nameRu: milk.nameRu, price: milk.price };
    }

    if (raw.sugar !== undefined && raw.sugar !== null && product.allowSugar) {
      const s = Number(raw.sugar);
      options.sugar = SUGAR_STEPS.reduce((best, step) => (Math.abs(step - s) < Math.abs(best - s) ? step : best), 0);
    }

    const addonIds = [...new Set((Array.isArray(raw.addonIds) ? raw.addonIds : []).map(Number))];
    if (addonIds.length) {
      options.addons = addonIds.map((id) => {
        const a = addons.find((x) => x.id === id && x.kind === 'EXTRA' && x.categorySlugs.includes(slug));
        if (!a) throw new HttpError(400, 'option_invalid');
        unitPrice += a.price;
        return { id: a.id, nameUz: a.nameUz, nameRu: a.nameRu, price: a.price };
      });
    }

    return {
      productId: product.id,
      nameUz: product.nameUz,
      nameRu: product.nameRu,
      imageUrl: product.imageUrl,
      variantLabel,
      options,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
    };
  });
}

async function computeTotals({ user, items, fulfillment, promoCode, useBonus }) {
  const settings = await Product.getSettings();
  const lines = await priceItems(items);
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  let promo = null;
  let discount = 0;
  let promoError = null;
  if (promoCode) {
    try {
      ({ promo, discount } = applyPromo(await findPromo(promoCode), subtotal));
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      promoError = err.code;
    }
  }

  const afterPromo = subtotal - discount;
  const bonusUsed = useBonus
    ? Math.min(user.bonusPoints, Math.floor((afterPromo * settings.maxBonusPercent) / 100))
    : 0;
  const deliveryFee =
    fulfillment === 'DELIVERY' && !(settings.freeDeliveryFrom > 0 && subtotal >= settings.freeDeliveryFrom)
      ? settings.deliveryFee
      : 0;
  const total = afterPromo - bonusUsed + deliveryFee;
  const bonusEarned = Math.floor(((afterPromo - bonusUsed) * settings.bonusPercent) / 100);
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
  const prep = settings.prepMinutes + Math.min(10, Math.max(0, totalQty - 2) * 2);
  const estimatedMinutes = fulfillment === 'DELIVERY' ? prep + settings.deliveryMinutes : prep;

  return {
    lines,
    settings,
    promo,
    promoError,
    totals: { subtotal, discount, bonusUsed, bonusEarned, deliveryFee, total, estimatedMinutes },
  };
}

// ---------- create ----------
function validateFulfillment(b) {
  if (!FULFILLMENTS.includes(b.fulfillment)) throw new HttpError(400, 'fulfillment_invalid');
  if (!PAYMENTS.includes(b.paymentMethod)) throw new HttpError(400, 'payment_invalid');

  const out = { tableNumber: null, scheduledFor: null, address: null, lat: null, lng: null };

  if (b.fulfillment === 'DINE_IN') {
    const table = String(b.tableNumber || '').trim();
    if (!table || table.length > 10) throw new HttpError(400, 'table_required');
    out.tableNumber = table;
  }
  if (b.fulfillment === 'TAKEAWAY' && b.pickupTime && b.pickupTime !== 'asap') {
    const when = new Date(b.pickupTime);
    const now = Date.now();
    if (Number.isNaN(when.getTime()) || when.getTime() < now - 60_000 || when.getTime() > now + 24 * 3600_000) {
      throw new HttpError(400, 'pickup_invalid');
    }
    out.scheduledFor = when;
  }
  if (b.fulfillment === 'DELIVERY') {
    const address = String(b.address || '').trim();
    if (address.length < 5) throw new HttpError(400, 'address_required');
    out.address = address.slice(0, 300);
    if (typeof b.lat === 'number' && typeof b.lng === 'number') {
      out.lat = b.lat;
      out.lng = b.lng;
    }
  }
  return out;
}

async function createOrder(user, body) {
  const place = validateFulfillment(body);
  const priced = await computeTotals({
    user,
    items: body.items,
    fulfillment: body.fulfillment,
    promoCode: body.promoCode,
    useBonus: !!body.useBonus,
  });
  if (body.promoCode && priced.promoError) throw new HttpError(400, priced.promoError);

  const { lines, promo, totals, settings } = priced;
  if (totals.subtotal < settings.minOrder) {
    throw new HttpError(400, 'min_order', { minOrder: settings.minOrder });
  }

  return prisma.$transaction(
    async (tx) => {
      if (promo) {
        const claimed = await tx.promoCode.updateMany({
          where: { id: promo.id, ...(promo.maxUses != null ? { usedCount: { lt: promo.maxUses } } : {}) },
          data: { usedCount: { increment: 1 } },
        });
        if (!claimed.count) throw new HttpError(400, 'promo_used_up');
      }
      if (totals.bonusUsed > 0) {
        const taken = await tx.user.updateMany({
          where: { id: user.id, bonusPoints: { gte: totals.bonusUsed } },
          data: { bonusPoints: { decrement: totals.bonusUsed } },
        });
        if (!taken.count) throw new HttpError(409, 'bonus_insufficient');
      }
      if (typeof body.phone === 'string' && body.phone.trim() && body.phone.trim() !== user.phone) {
        await tx.user.update({ where: { id: user.id }, data: { phone: body.phone.trim().slice(0, 20) } });
      }
      return tx.order.create({
        data: {
          userId: user.id,
          fulfillment: body.fulfillment,
          paymentMethod: body.paymentMethod,
          ...place,
          phone: typeof body.phone === 'string' ? body.phone.trim().slice(0, 20) || null : null,
          note: typeof body.note === 'string' ? body.note.trim().slice(0, 300) || null : null,
          promoCode: promo ? promo.code : null,
          ...totals,
          items: { create: lines },
        },
        include: orderInclude,
      });
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}

// ---------- customer reads ----------
const listForUser = (userId) =>
  prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50, include: orderInclude });

const getForUser = (userId, id) => prisma.order.findFirst({ where: { id, userId }, include: orderInclude });

async function markPaidSimulated(user, id) {
  const order = await getForUser(user.id, id);
  if (!order) throw new HttpError(404, 'not_found');
  if (!ONLINE_PAYMENTS.includes(order.paymentMethod)) throw new HttpError(400, 'payment_invalid');
  if (order.status === 'CANCELLED') throw new HttpError(409, 'order_cancelled');
  if (order.paymentStatus === 'PAID') return order;
  return prisma.order.update({ where: { id }, data: { paymentStatus: 'PAID' }, include: orderInclude });
}

// ---------- status machine ----------
const OPEN = ['PENDING', 'PREPARING', 'READY', 'ON_THE_WAY'];

// Moves that touch no money or points need only one guarded write (the DB is a long way away).
async function simpleTransition(id, status) {
  const moved = await prisma.order.updateMany({
    where: {
      id,
      status: { in: OPEN },
      ...(status === 'ON_THE_WAY' ? { fulfillment: 'DELIVERY' } : {}),
    },
    data: { status },
  });
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, user: true } });
  if (!order) throw new HttpError(404, 'not_found');
  if (!moved.count && order.status !== status) {
    throw new HttpError(order.status === 'COMPLETED' || order.status === 'CANCELLED' ? 409 : 400, order.status === 'COMPLETED' || order.status === 'CANCELLED' ? 'order_closed' : 'status_invalid');
  }
  return order;
}

async function updateStatus(id, status) {
  if (OPEN.includes(status)) return simpleTransition(id, status);
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, user: true } });
  if (!order) throw new HttpError(404, 'not_found');
  if (['COMPLETED', 'CANCELLED'].includes(order.status)) throw new HttpError(409, 'order_closed');
  if (order.status === status) return order;
  if (status === 'ON_THE_WAY' && order.fulfillment !== 'DELIVERY') throw new HttpError(400, 'status_invalid');

  return prisma.$transaction(async (tx) => {
    const data = { status };
    if (status === 'CANCELLED' && order.bonusUsed > 0) {
      await tx.user.update({ where: { id: order.userId }, data: { bonusPoints: { increment: order.bonusUsed } } });
    }
    if (status === 'COMPLETED') {
      data.paymentStatus = 'PAID';
      if (order.bonusEarned > 0) {
        await tx.user.update({ where: { id: order.userId }, data: { bonusPoints: { increment: order.bonusEarned } } });
      }
    }
    return tx.order.update({ where: { id }, data, include: { items: true, user: true } });
  });
}

async function cancelByCustomer(user, id) {
  const order = await getForUser(user.id, id);
  if (!order) throw new HttpError(404, 'not_found');
  if (order.status !== 'PENDING' || order.paymentStatus === 'PAID') throw new HttpError(409, 'cannot_cancel');
  return updateStatus(id, 'CANCELLED');
}

// ---------- admin ----------
async function listForAdmin({ status, since }) {
  const where = {};
  if (status === 'active') where.status = { in: ACTIVE_STATUSES };
  else if (status && status !== 'all') where.status = status;
  if (since) where.createdAt = { gte: new Date(since) };
  return prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      items: { orderBy: { id: 'asc' } },
      user: { select: { id: true, firstName: true, lastName: true, username: true, phone: true, telegramId: true } },
    },
  });
}

const setPaymentStatus = (id, paymentStatus) =>
  prisma.order.update({
    where: { id },
    data: { paymentStatus: paymentStatus === 'PAID' ? 'PAID' : 'UNPAID' },
    include: { items: true, user: true },
  });

async function getStats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date(startOfDay.getTime() - 6 * 24 * 3600_000);

  const [today, active, users, week, top] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: startOfDay }, status: { not: 'CANCELLED' } }, select: { total: true } }),
    prisma.order.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    prisma.user.count(),
    prisma.order.findMany({
      where: { createdAt: { gte: weekAgo }, status: { not: 'CANCELLED' } },
      select: { total: true, createdAt: true },
    }),
    prisma.orderItem.groupBy({
      by: ['nameUz', 'nameRu'],
      where: { order: { createdAt: { gte: weekAgo }, status: { not: 'CANCELLED' } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
  ]);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfDay.getTime() - i * 24 * 3600_000);
    const next = new Date(d.getTime() + 24 * 3600_000);
    const rows = week.filter((o) => o.createdAt >= d && o.createdAt < next);
    days.push({ date: d.toISOString().slice(0, 10), orders: rows.length, revenue: rows.reduce((s, o) => s + o.total, 0) });
  }

  return {
    todayOrders: today.length,
    todayRevenue: today.reduce((s, o) => s + o.total, 0),
    activeOrders: active,
    customers: users,
    days,
    top: top.map((t) => ({ nameUz: t.nameUz, nameRu: t.nameRu, quantity: t._sum.quantity })),
  };
}

// ---------- promo admin ----------
const listPromos = () => prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });

const promoData = (b) => ({
  code: normalizeCode(b.code),
  type: b.type === 'FIXED' ? 'FIXED' : 'PERCENT',
  value: Math.max(1, Math.round(Number(b.value) || 0)),
  minOrder: Math.max(0, Math.round(Number(b.minOrder) || 0)),
  maxUses: b.maxUses === '' || b.maxUses == null ? null : Math.max(1, Math.round(Number(b.maxUses))),
  isActive: b.isActive !== false,
  expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
});

const createPromo = (b) => prisma.promoCode.create({ data: promoData(b) });
const updatePromo = (id, b) => prisma.promoCode.update({ where: { id }, data: promoData(b) });
const deletePromo = (id) => prisma.promoCode.delete({ where: { id } });

module.exports = {
  ACTIVE_STATUSES,
  ONLINE_PAYMENTS,
  findPromo,
  applyPromo,
  computeTotals,
  createOrder,
  listForUser,
  getForUser,
  markPaidSimulated,
  updateStatus,
  cancelByCustomer,
  listForAdmin,
  setPaymentStatus,
  getStats,
  listPromos,
  createPromo,
  updatePromo,
  deletePromo,
};
