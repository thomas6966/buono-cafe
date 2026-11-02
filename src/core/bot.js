const { Bot } = require('grammy');
const config = require('../config/default');

const bot = new Bot(config.botToken);

bot.catch((err) => {
  console.error('[bot] error:', err.error?.message || err.message);
});

module.exports = bot;
