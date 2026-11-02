const { InlineKeyboard } = require('grammy');
const bot = require('../core/bot');
const config = require('../config/default');
const User = require('../models/User');

const orderNumber = (order) => 1000 + order.id;
const money = (n) => `${Number(n).toLocaleString('ru-RU')}`;
const webAppUrl = () => config.getWebAppUrl();
const hasWebApp = () => webAppUrl().startsWith('https://');

const T = {
  uz: {
    welcome: (name) =>
      `Assalomu alaykum, ${name}! 👋\n\n*BUONO* — vafli, gelato va qahva.\nMenyuni ochish va buyurtma berish uchun pastdagi tugmani bosing.`,
    open: '🍽 Menyuni ochish',
    noUrl: 'Mini App hozircha ulanmagan. Iltimos, keyinroq urinib ko\'ring.',
    help: 'Buyurtma berish uchun /start ni bosing.\nTilni o\'zgartirish: /lang',
    chooseLang: 'Tilni tanlang / Выберите язык:',
    langSet: 'Til o\'zgartirildi: O\'zbekcha 🇺🇿',
    created: (o) =>
      `✅ *Buyurtma #${orderNumber(o)} qabul qilindi!*\n\nJami: *${money(o.total)} so'm*\nTaxminiy vaqt: ~${o.estimatedMinutes} daqiqa\n\nHolat o'zgarganda xabar beramiz.`,
    status: {
      PREPARING: () => '👨‍🍳 Buyurtmangiz tayyorlanmoqda.',
      READY: (o) =>
        o.fulfillment === 'TAKEAWAY'
          ? '🛍 Buyurtmangiz tayyor! Olib ketishingiz mumkin.'
          : '🍽 Buyurtmangiz tayyor! Hozir olib kelamiz.',
      ON_THE_WAY: () => '🛵 Buyurtmangiz yo\'lda!',
      COMPLETED: (o) =>
        `🎉 Yoqimli ishtaha!${o.bonusEarned ? `\n+${money(o.bonusEarned)} BUONO Club balli qo'shildi.` : ''}`,
      CANCELLED: () => '❌ Buyurtmangiz bekor qilindi.',
    },
    title: (o) => `Buyurtma #${orderNumber(o)}`,
  },
  ru: {
    welcome: (name) =>
      `Здравствуйте, ${name}! 👋\n\n*BUONO* — вафли, джелато и кофе.\nНажмите кнопку ниже, чтобы открыть меню и сделать заказ.`,
    open: '🍽 Открыть меню',
    noUrl: 'Mini App пока не подключено. Попробуйте позже.',
    help: 'Чтобы сделать заказ, нажмите /start.\nСменить язык: /lang',
    chooseLang: 'Tilni tanlang / Выберите язык:',
    langSet: 'Язык изменён: Русский 🇷🇺',
    created: (o) =>
      `✅ *Заказ #${orderNumber(o)} принят!*\n\nИтого: *${money(o.total)} сум*\nПримерное время: ~${o.estimatedMinutes} мин\n\nМы сообщим, когда статус изменится.`,
    status: {
      PREPARING: () => '👨‍🍳 Ваш заказ готовится.',
      READY: (o) =>
        o.fulfillment === 'TAKEAWAY'
          ? '🛍 Ваш заказ готов! Можете забирать.'
          : '🍽 Ваш заказ готов! Сейчас принесём.',
      ON_THE_WAY: () => '🛵 Ваш заказ уже в пути!',
      COMPLETED: (o) =>
        `🎉 Приятного аппетита!${o.bonusEarned ? `\n+${money(o.bonusEarned)} баллов BUONO Club.` : ''}`,
      CANCELLED: () => '❌ Ваш заказ отменён.',
    },
    title: (o) => `Заказ #${orderNumber(o)}`,
  },
};

const tr = (lang) => T[lang] || T.uz;

// ---------- handlers ----------
async function start(ctx) {
  const user = await User.upsertFromTelegram({ ...ctx.from, language_code: ctx.from.language_code });
  const t = tr(user.language);
  const text = t.welcome(user.firstName);
  if (!hasWebApp()) {
    return ctx.reply(`${text}\n\n_${t.noUrl}_`, { parse_mode: 'Markdown' });
  }
  const kb = new InlineKeyboard().webApp(t.open, webAppUrl());
  return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}

async function help(ctx) {
  const user = await User.upsertFromTelegram(ctx.from);
  return ctx.reply(tr(user.language).help);
}

function chooseLanguage(ctx) {
  const kb = new InlineKeyboard().text('🇺🇿 O\'zbekcha', 'lang:uz').text('🇷🇺 Русский', 'lang:ru');
  return ctx.reply(T.uz.chooseLang, { reply_markup: kb });
}

async function setLanguage(ctx) {
  const lang = ctx.match[1];
  const user = await User.upsertFromTelegram(ctx.from);
  await User.updateProfile(user.id, { language: lang });
  await ctx.answerCallbackQuery();
  return ctx.editMessageText(tr(lang).langSet);
}

// ---------- outbound notifications (customers only) ----------
async function send(user, text) {
  try {
    await bot.api.sendMessage(Number(user.telegramId), text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.warn(`[bot] could not message ${user.telegramId}: ${err.description || err.message}`);
  }
}

const notifyOrderCreated = (order, user) => send(user, tr(user.language).created(order));

function notifyStatus(order, user) {
  const t = tr(user.language);
  const body = t.status[order.status]?.(order);
  if (!body) return Promise.resolve();
  return send(user, `*${t.title(order)}*\n${body}`);
}

// ---------- boot ----------
async function setup() {
  await bot.api.setMyCommands([
    { command: 'start', description: 'BUONO — menyu / меню' },
    { command: 'lang', description: 'Til / Язык' },
    { command: 'help', description: 'Yordam / Помощь' },
  ]);
  if (hasWebApp()) {
    await bot.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: 'BUONO', web_app: { url: webAppUrl() } },
    });
  }
}

module.exports = { start, help, chooseLanguage, setLanguage, notifyOrderCreated, notifyStatus, setup, orderNumber };
