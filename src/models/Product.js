const prisma = require('../database/connection');
const config = require('../config/default');

// ---------- settings ----------
async function getSettings() {
  const rows = await prisma.setting.findMany();
  const merged = { ...config.defaultSettings };
  for (const r of rows) merged[r.key] = r.value;
  return Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, Number(v)]));
}

async function saveSettings(input) {
  const keys = Object.keys(config.defaultSettings);
  await prisma.$transaction(
    keys
      .filter((k) => input[k] !== undefined && Number.isFinite(Number(input[k])))
      .map((key) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: String(Math.max(0, Math.round(Number(input[key])))) },
          create: { key, value: String(Math.max(0, Math.round(Number(input[key])))) },
        }),
      ),
  );
  return getSettings();
}

// ---------- public menu ----------
// The menu rarely changes and the database is far away, so it is cached briefly.
// Every admin write is exported through `invalidating()` so edits show up at once.
let menuCache = null;
const MENU_TTL_MS = 60_000;

const invalidating = (fn) => async (...args) => {
  const result = await fn(...args);
  menuCache = null;
  return result;
};

async function getPublicMenu() {
  if (menuCache && Date.now() - menuCache.at < MENU_TTL_MS) return menuCache.data;
  const data = await loadPublicMenu();
  menuCache = { at: Date.now(), data };
  return data;
}

async function loadPublicMenu() {
  const [categories, addons, settings] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          where: { isAvailable: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { variants: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    }),
    prisma.addon.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    getSettings(),
  ]);
  return {
    categories: categories.filter((c) => c.products.length > 0),
    addons,
    settings: {
      deliveryFee: settings.deliveryFee,
      freeDeliveryFrom: settings.freeDeliveryFrom,
      minOrder: settings.minOrder,
      bonusPercent: settings.bonusPercent,
      maxBonusPercent: settings.maxBonusPercent,
      prepMinutes: settings.prepMinutes,
    },
  };
}

const getProductsByIds = (ids) =>
  prisma.product.findMany({
    where: { id: { in: ids } },
    include: { variants: { orderBy: { sortOrder: 'asc' } }, category: true },
  });

const getActiveAddons = () => prisma.addon.findMany({ where: { isActive: true } });

// ---------- admin: categories ----------
const listCategories = () =>
  prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });

const categoryData = (b) => ({
  slug: String(b.slug).trim().toLowerCase(),
  nameUz: String(b.nameUz).trim(),
  nameRu: String(b.nameRu).trim(),
  icon: b.icon || '🍽️',
  sortOrder: Number(b.sortOrder) || 0,
  isActive: b.isActive !== false,
});

const createCategory = (b) => prisma.category.create({ data: categoryData(b) });
const updateCategory = (id, b) => prisma.category.update({ where: { id }, data: categoryData(b) });
const deleteCategory = (id) => prisma.category.delete({ where: { id } });

// ---------- admin: products ----------
const listProducts = () =>
  prisma.product.findMany({
    orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    include: { variants: { orderBy: { sortOrder: 'asc' } }, category: { select: { id: true, slug: true, nameUz: true } } },
  });

function productData(b) {
  const variants = Array.isArray(b.variants)
    ? b.variants
        .filter((v) => v.label && Number(v.price) > 0)
        .map((v, i) => ({ label: String(v.label).trim(), price: Math.round(Number(v.price)), sortOrder: i }))
    : [];
  const basePrice = variants.length ? Math.min(...variants.map((v) => v.price)) : Math.round(Number(b.price));
  return {
    variants,
    data: {
      categoryId: Number(b.categoryId),
      nameUz: String(b.nameUz).trim(),
      nameRu: String(b.nameRu).trim(),
      descUz: String(b.descUz || '').trim(),
      descRu: String(b.descRu || '').trim(),
      price: basePrice,
      imageUrl: b.imageUrl || null,
      tags: Array.isArray(b.tags) ? b.tags.filter((t) => ['vegetarian', 'chef', 'bestseller'].includes(t)) : [],
      isAvailable: b.isAvailable !== false,
      allowMilk: !!b.allowMilk,
      allowSugar: !!b.allowSugar,
      sortOrder: Number(b.sortOrder) || 0,
    },
  };
}

async function createProduct(b) {
  const { data, variants } = productData(b);
  return prisma.product.create({ data: { ...data, variants: { create: variants } }, include: { variants: true } });
}

async function updateProduct(id, b) {
  const { data, variants } = productData(b);
  return prisma.$transaction(async (tx) => {
    await tx.productVariant.deleteMany({ where: { productId: id } });
    return tx.product.update({
      where: { id },
      data: { ...data, variants: { create: variants } },
      include: { variants: true },
    });
  });
}

const setProductAvailability = (id, isAvailable) =>
  prisma.product.update({ where: { id }, data: { isAvailable: !!isAvailable } });

const deleteProduct = (id) => prisma.product.delete({ where: { id } });

// ---------- uploaded photos (stored in the database) ----------
const createImage = (mime, data) => prisma.image.create({ data: { mime, data }, select: { id: true } });
const getImage = (id) => prisma.image.findUnique({ where: { id: String(id) } });

// ---------- admin: addons ----------
const listAddons = () => prisma.addon.findMany({ orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] });

const addonData = (b) => ({
  kind: b.kind === 'MILK' ? 'MILK' : 'EXTRA',
  nameUz: String(b.nameUz).trim(),
  nameRu: String(b.nameRu).trim(),
  price: Math.max(0, Math.round(Number(b.price) || 0)),
  categorySlugs: Array.isArray(b.categorySlugs) ? b.categorySlugs : [],
  isActive: b.isActive !== false,
  sortOrder: Number(b.sortOrder) || 0,
});

const createAddon = (b) => prisma.addon.create({ data: addonData(b) });
const updateAddon = (id, b) => prisma.addon.update({ where: { id }, data: addonData(b) });
const deleteAddon = (id) => prisma.addon.delete({ where: { id } });

module.exports = {
  getSettings,
  saveSettings: invalidating(saveSettings),
  getPublicMenu,
  getProductsByIds,
  getActiveAddons,
  listCategories,
  createCategory: invalidating(createCategory),
  updateCategory: invalidating(updateCategory),
  deleteCategory: invalidating(deleteCategory),
  listProducts,
  createProduct: invalidating(createProduct),
  updateProduct: invalidating(updateProduct),
  setProductAvailability: invalidating(setProductAvailability),
  deleteProduct: invalidating(deleteProduct),
  createImage,
  getImage,
  listAddons,
  createAddon: invalidating(createAddon),
  updateAddon: invalidating(updateAddon),
  deleteAddon: invalidating(deleteAddon),
};
