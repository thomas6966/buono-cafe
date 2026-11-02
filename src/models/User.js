const prisma = require('../database/connection');

const pickLanguage = (code) => (code && code.startsWith('ru') ? 'ru' : 'uz');

// Runs on every authenticated request, so the common case (nothing changed) is a single read.
async function upsertFromTelegram(tg) {
  const data = {
    firstName: tg.first_name || 'Guest',
    lastName: tg.last_name || null,
    username: tg.username || null,
    photoUrl: tg.photo_url || null,
  };
  const telegramId = BigInt(tg.id);
  const existing = await prisma.user.findUnique({ where: { telegramId } });
  if (!existing) {
    return prisma.user.upsert({
      where: { telegramId },
      update: data,
      create: { telegramId, language: pickLanguage(tg.language_code), ...data },
    });
  }
  const changed = Object.keys(data).some((k) => existing[k] !== data[k]);
  return changed ? prisma.user.update({ where: { id: existing.id }, data }) : existing;
}

const findById = (id) => prisma.user.findUnique({ where: { id } });

const updateProfile = (id, { language, phone }) =>
  prisma.user.update({
    where: { id },
    data: {
      ...(language && ['uz', 'ru'].includes(language) ? { language } : {}),
      ...(typeof phone === 'string' ? { phone: phone.slice(0, 20) } : {}),
    },
  });

// --- addresses ---
const listAddresses = (userId) =>
  prisma.address.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });

const createAddress = (userId, { label, address, lat, lng }) =>
  prisma.address.create({
    data: {
      userId,
      label: String(label || 'Home').slice(0, 40),
      address: String(address).slice(0, 300),
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
    },
  });

const deleteAddress = (userId, id) => prisma.address.deleteMany({ where: { id, userId } });

// --- favorites ---
async function listFavoriteIds(userId) {
  const rows = await prisma.favorite.findMany({ where: { userId }, select: { productId: true } });
  return rows.map((r) => r.productId);
}

async function toggleFavorite(userId, productId) {
  const key = { userId_productId: { userId, productId } };
  const existing = await prisma.favorite.findUnique({ where: key });
  if (existing) {
    await prisma.favorite.delete({ where: key });
    return false;
  }
  await prisma.favorite.create({ data: { userId, productId } });
  return true;
}

const listAll = () =>
  prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { _count: { select: { orders: true } } },
  });

module.exports = {
  upsertFromTelegram,
  findById,
  updateProfile,
  listAddresses,
  createAddress,
  deleteAddress,
  listFavoriteIds,
  toggleFavorite,
  listAll,
};
