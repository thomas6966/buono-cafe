// Loads the BUONO menu (prisma/data/menu.snapshot.json, taken from the café's public menu)
// into the database and downloads every product photo into /uploads/products.
//
//   npm run db:seed
//
// Safe to re-run: products are matched by externalId, so your edits to prices/photos
// made in the admin dashboard are NOT overwritten (only missing items are added).
// Use `node prisma/seed.js --reset-menu` to wipe and re-import the whole menu.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const snapshot = require('./data/menu.snapshot.json');
const IMG_BASE = 'https://menu.scaninfo.uz/storage/load?id=';
const UPLOADS = path.join(__dirname, '..', 'uploads');
const PRODUCT_DIR = path.join(UPLOADS, 'products');

const CATEGORIES = {
  pasta: { slug: 'pasta', uz: 'Pasta', ru: 'Паста', icon: '🍝' },
  pizza: { slug: 'pizza', uz: 'Pitsa va setlar', ru: 'Пицца и сеты', icon: '🍕' },
  'san sebastian': { slug: 'san-sebastian', uz: 'San Sebastian', ru: 'Сан Себастьян', icon: '🍰' },
  waffles: { slug: 'waffles', uz: 'Vafli', ru: 'Вафли', icon: '🧇' },
  desserts: { slug: 'desserts', uz: 'Desertlar', ru: 'Десерты', icon: '🍮' },
  tea: { slug: 'tea', uz: 'Choy', ru: 'Чай', icon: '🫖' },
  moxito: { slug: 'mojito', uz: 'Mohito', ru: 'Мохито', icon: '🍹' },
  lemonade: { slug: 'lemonade', uz: 'Limonad', ru: 'Лимонад', icon: '🍋' },
  cocktail: { slug: 'cocktail', uz: 'Kokteyllar', ru: 'Коктейли', icon: '🥤' },
  smoothie: { slug: 'smoothie', uz: 'Smuzi', ru: 'Смузи', icon: '🥭' },
  'bubble tea': { slug: 'bubble-tea', uz: 'Bubble tea', ru: 'Bubble tea', icon: '🧋' },
  'coffee - ice coffee': { slug: 'coffee', uz: 'Qahva va muzdak qahva', ru: 'Кофе и айс-кофе', icon: '☕' },
  fresh: { slug: 'fresh', uz: 'Fresh', ru: 'Фреш', icon: '🍊' },
  detox: { slug: 'detox', uz: 'Detox', ru: 'Детокс', icon: '🥬' },
  'ice cream': { slug: 'ice-cream', uz: 'Muzqaymoq', ru: 'Мороженое', icon: '🍦' },
  sushi: { slug: 'sushi', uz: 'Sushi', ru: 'Суши', icon: '🍣' },
};

// Placeholders: the café did not give prices for these. Edit them in the admin dashboard.
const ADDONS = [
  { kind: 'MILK', nameUz: 'Oat sut', nameRu: 'Овсяное молоко', price: 8000, categorySlugs: ['coffee'] },
  { kind: 'MILK', nameUz: 'Bodom suti', nameRu: 'Миндальное молоко', price: 10000, categorySlugs: ['coffee'] },
  { kind: 'EXTRA', nameUz: 'Qo\'shimcha shot', nameRu: 'Доп. шот эспрессо', price: 8000, categorySlugs: ['coffee'] },
  { kind: 'EXTRA', nameUz: 'Sirop (vanil/karamel)', nameRu: 'Сироп (ваниль/карамель)', price: 5000, categorySlugs: ['coffee', 'cocktail'] },
  { kind: 'EXTRA', nameUz: 'Shokolad bo\'laklari', nameRu: 'Шоколадная крошка', price: 4000, categorySlugs: ['coffee', 'waffles', 'cocktail'] },
  { kind: 'EXTRA', nameUz: 'Qo\'shimcha shokolad sousi', nameRu: 'Доп. шоколадный соус', price: 5000, categorySlugs: ['waffles', 'san-sebastian', 'desserts'] },
  { kind: 'EXTRA', nameUz: 'Muzqaymoq sharchasi', nameRu: 'Шарик мороженого', price: 13000, categorySlugs: ['waffles', 'desserts'] },
  { kind: 'EXTRA', nameUz: 'Qo\'shimcha pishloq', nameRu: 'Доп. сыр', price: 8000, categorySlugs: ['pizza', 'pasta'] },
  { kind: 'EXTRA', nameUz: 'Sarimsoqli sous', nameRu: 'Чесночный соус', price: 3000, categorySlugs: ['pizza'] },
  { kind: 'EXTRA', nameUz: 'Xalapeno', nameRu: 'Халапеньо', price: 3000, categorySlugs: ['pizza'] },
  { kind: 'EXTRA', nameUz: 'Tapioka sharchalari', nameRu: 'Доп. тапиока', price: 5000, categorySlugs: ['bubble-tea'] },
];

const PROMOS = [{ code: 'BUONO10', type: 'PERCENT', value: 10, minOrder: 50000 }];

// Placeholder badges (edit in the dashboard): which dishes get a tag.
const BESTSELLERS = /pepperoni pizza|margarita pizza|^latte$|cappucino|cappuccino|san sebastian classic|^chocolate$|waffle ice-cream|bubble tea . (vanilla|mango)|^classical$|french fries/i;
const CHEF = /buono (pizza|sandwich)|san sebastian (fistashka|mango)|^with fruits$|set party|dragon fruit|kasarli pide/i;
const MEAT_FISH = /chiken|chicken|pepperoni|martadella|bbq|kombo|club sandwich|buono sandwich|tuna|salmon|set |mexican|shrimp|eel|crab|roll|maki|philadelphia|sushi|burger|tempura|canada|california|saki|rainbow|sakura|beauty|kusima|spicy|buono pizza|pasta|carbonara|bolognese|ham|bacon|lasagna|beef|meat/i;

const hasCyrillic = (s) => /[Ѐ-ӿ]/.test(s || '');
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const cleanMultiline = (s) =>
  String(s || '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(', ');

function portionLabel(p) {
  const unit = (p.unit || '').toLowerCase();
  let v = p.value;
  if (unit === 'sm') return `${v} sm`;
  if (unit === 'l') return `${v} L`;
  if (unit === 'ml') {
    if (v > 5000) v = v / 100; // data typo: 40000ml -> 400ml
    if (v < 10) v = Math.round(v * 1000); // 0.45 -> 450
    return `${v} ml`;
  }
  return `${v} ${p.unit || ''}`.trim();
}

async function download(id, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return true;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(IMG_BASE + id);
      if (!res.ok) continue;
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return true;
    } catch {
      /* retry */
    }
  }
  return false;
}

async function mapLimit(items, limit, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx], idx);
      }
    }),
  );
}

async function main() {
  fs.mkdirSync(PRODUCT_DIR, { recursive: true });

  if (process.argv.includes('--reset-menu')) {
    console.log('Resetting menu tables...');
    await prisma.orderItem.updateMany({ data: { productId: null } });
    await prisma.favorite.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
  }

  // logo (used by the Mini App and the dashboard)
  const logoDir = path.join(__dirname, '..', 'client', 'public');
  fs.mkdirSync(logoDir, { recursive: true });
  if (snapshot.logo) await download(snapshot.logo, path.join(logoDir, 'logo.webp'));

  // categories
  const catBySlug = new Map();
  for (const c of snapshot.categories) {
    const key = clean(c.name_en).toLowerCase().replace(/с/g, 'c'); // Cyrillic 'с' typo in source data
    const def = CATEGORIES[key];
    if (!def) {
      console.warn('No category mapping for', key);
      continue;
    }
    const row = await prisma.category.upsert({
      where: { slug: def.slug },
      update: {},
      create: { slug: def.slug, nameUz: def.uz, nameRu: def.ru, icon: def.icon, sortOrder: c.order_num },
    });
    catBySlug.set(def.slug, { row, src: c });
  }

  // products
  const jobs = [];
  for (const { row: cat, src } of catBySlug.values()) {
    src.products.forEach((p, idx) => jobs.push({ cat, p, idx }));
  }
  console.log(`Importing ${jobs.length} products (photos download in parallel)...`);

  let added = 0;
  let photoFails = 0;
  await mapLimit(jobs, 8, async ({ cat, p, idx }) => {
    const existing = await prisma.product.findUnique({ where: { externalId: p.id } });

    const imageFile = `${p.id}.webp`;
    const ok = p.photo ? await download(p.photo, path.join(PRODUCT_DIR, imageFile)) : false;
    if (!ok) photoFails++;
    if (existing) {
      if (ok && !existing.imageUrl) {
        await prisma.product.update({ where: { id: existing.id }, data: { imageUrl: `/uploads/products/${imageFile}` } });
      }
      return;
    }

    const en = clean(p.name_en);
    const nameUz = clean(p.name_uz && !hasCyrillic(p.name_uz) ? p.name_uz : en);
    const nameRu = clean(p.name_ru || en);
    const descEn = cleanMultiline(p.description_en);
    const descUz = p.description_uz && !hasCyrillic(p.description_uz) ? cleanMultiline(p.description_uz) : descEn;
    const descRu = cleanMultiline(p.description_ru) || descEn;
    // mojito/lemonade carry "0,450ml 40 000 1L 80 000" in the description: it is already in the sizes
    const hideDesc = /\d\s?ml\s+\d/i.test(descEn);

    const portions = [...(p.portions || [])].sort((a, b) => a.order - b.order);
    const variants = portions.length > 1 ? portions : [];
    const price = portions.length ? Math.min(...portions.map((x) => x.price)) : Math.round(p.price);

    const slug = cat.slug;
    const tags = [];
    if (BESTSELLERS.test(en)) tags.push('bestseller');
    if (CHEF.test(en)) tags.push('chef');
    const meaty = MEAT_FISH.test(en) && !['tea', 'cocktail', 'bubble-tea', 'smoothie', 'fresh', 'detox', 'lemonade', 'mojito', 'coffee', 'desserts', 'waffles', 'san-sebastian', 'ice-cream'].includes(slug);
    const veggie = ['tea', 'cocktail', 'bubble-tea', 'smoothie', 'fresh', 'detox', 'lemonade', 'mojito', 'coffee', 'desserts', 'waffles', 'san-sebastian', 'ice-cream'].includes(slug) || /cheese|margarita|mushroom|french fries|avocado|cucumber|choco pizza|kasarli/i.test(en) && !meaty;
    if (veggie) tags.push('vegetarian');

    await prisma.product.create({
      data: {
        externalId: p.id,
        categoryId: cat.id,
        nameUz,
        nameRu,
        descUz: hideDesc ? '' : descUz,
        descRu: hideDesc ? '' : descRu,
        price,
        imageUrl: ok ? `/uploads/products/${imageFile}` : null,
        tags,
        isAvailable: p.is_available !== false,
        allowMilk: slug === 'coffee' && !/americano|espresso|frapp|frapper|glace|cacao|chocolate|raf/i.test(en),
        allowSugar: ['coffee', 'tea'].includes(slug) && !/frapper/i.test(en),
        sortOrder: idx,
        variants: variants.length
          ? { create: variants.map((v, i) => ({ label: portionLabel(v), price: v.price, sortOrder: i })) }
          : undefined,
      },
    });
    added++;
  });
  console.log(`Products added: ${added}. Photos failed: ${photoFails}.`);

  // add-ons + promo (only when empty, so dashboard edits are kept)
  if ((await prisma.addon.count()) === 0) {
    await prisma.addon.createMany({ data: ADDONS.map((a, i) => ({ ...a, sortOrder: i })) });
    console.log(`Add-ons created: ${ADDONS.length} (placeholder prices)`);
  }
  if ((await prisma.promoCode.count()) === 0) {
    await prisma.promoCode.createMany({ data: PROMOS });
    console.log('Promo codes created: BUONO10 (-10%, from 50 000)');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
