const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { webhookCallback } = require('grammy');
const config = require('./config/default');
const prisma = require('./database/connection');
const bot = require('./core/bot');
const botController = require('./controllers/botController');
const registerBotRoutes = require('./routes/bot.routes');
const clientRoutes = require('./routes/client.routes');
const adminRoutes = require('./routes/admin.routes');
const { errorHandler } = require('./middlewares/error.middleware');

const app = express();
// behind Render's proxy: needed so req.ip (login rate limit) is the real client address
app.set('trust proxy', config.isProd ? 1 : false);
app.disable('x-powered-by');

app.use(
  cors(
    config.corsOrigins.length
      ? { origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)) }
      : {},
  ),
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/client', clientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

// Telegram -> server (production). Telegram sends our secret in a header; grammY rejects anything else.
const useWebhook = Boolean(config.publicApiUrl) && !/localhost|127\.0\.0\.1/.test(config.publicApiUrl);
if (useWebhook) {
  app.post('/telegram/webhook', webhookCallback(bot, 'express', { secretToken: config.webhookSecret }));
}

// legacy local product photos (dev only; production photos are static files of the Mini App or DB images)
fs.mkdirSync(config.uploadsDir, { recursive: true });
app.use('/uploads', express.static(config.uploadsDir, { maxAge: '7d', immutable: true }));

// built Mini App (npm run client:build) - lets one HTTPS tunnel serve app + API locally
if (fs.existsSync(path.join(config.clientDist, 'index.html'))) {
  app.use(express.static(config.clientDist, { maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
} else {
  app.get('/', (req, res) => res.json({ name: 'BUONO Cafe API', ok: true }));
}

app.use(errorHandler);

async function startBot() {
  registerBotRoutes(bot);
  try {
    await botController.setup();
  } catch (err) {
    console.error('[bot] setup failed:', err.message);
  }

  const url = config.getWebAppUrl();
  console.log(url ? `[bot] Mini App URL: ${url}` : '[bot] No Mini App URL yet: set WEBAPP_URL (or run `npm run tunnel` locally)');

  if (useWebhook) {
    await bot.init();
    await bot.api.setWebhook(`${config.publicApiUrl}/telegram/webhook`, {
      secret_token: config.webhookSecret,
      allowed_updates: ['message', 'callback_query'],
    });
    console.log(`[bot] @${bot.botInfo.username} webhook -> ${config.publicApiUrl}/telegram/webhook`);
    return;
  }

  // Local development: long polling. Starting it would DELETE the production webhook,
  // so refuse when one is active (use a separate test bot token locally).
  const info = await bot.api.getWebhookInfo();
  if (info.url && process.env.FORCE_POLLING !== 'true') {
    console.warn(`[bot] A webhook is active (${info.url}). Not starting long polling so production keeps working.`);
    console.warn('[bot] Use a separate test bot token in your local .env, or set FORCE_POLLING=true to take over.');
    return;
  }
  const me = await bot.api.getMe();
  console.log(`[bot] @${me.username} started (long polling)`);
  bot.start({ drop_pending_updates: true });
}

async function main() {
  await prisma.$connect();
  console.log('[db] connected');

  const server = app.listen(config.port, () => {
    console.log(`[api] http://localhost:${config.port}`);
  });

  startBot().catch((err) => console.error('[bot] failed to start:', err.message));

  const shutdown = async () => {
    await bot.stop().catch(() => {});
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
