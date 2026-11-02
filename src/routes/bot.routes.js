const botController = require('../controllers/botController');

// Registers every Telegram update handler on the bot instance.
function registerBotRoutes(bot) {
  bot.command('start', botController.start);
  bot.command('menu', botController.start);
  bot.command('help', botController.help);
  bot.command('lang', botController.chooseLanguage);
  bot.callbackQuery(/^lang:(uz|ru)$/, botController.setLanguage);
  // keep last: every other message in a private chat gets the "open the menu" button
  bot.on('message', botController.fallback);
}

module.exports = registerBotRoutes;
