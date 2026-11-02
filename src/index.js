const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config/default');
const prisma = require('./database/connection');
const bot = require('./core/bot');
const botController = require('./controllers/botController');
const registerBotRoutes = require('./routes/bot.routes');
const clientRoutes = require('./routes/client.routes');
const adminRoutes = require('./routes/admin.routes');
const { errorHandler } = require('./middlewares/error.middleware');

const app = express();
app.set('trust proxy', false);
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/client', clientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

// product photos
fs.mkdirSync(config.uploadsDir, { recursive: true });
app.use('/uploads', express.static(config.uploadsDir, { maxAge: '7d', immutable: true }));

// built Mini App (npm run client:build) - lets one HTTPS tunnel serve app + API
if (fs.existsSync(path.join(config.clientDist, 'index.html'))) {
  app.use(express.static(config.clientDist, { maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

app.use(errorHandler);

async function main() {
  await prisma.$connect();
  console.log('[db] connected');

  registerBotRoutes(bot);
  const server = app.listen(config.port, () => {
    console.log(`[api] http://localhost:${config.port}`);
  });

  try {
    await botController.setup();
    const me = await bot.api.getMe();
    console.log(`[bot] @${me.username} started (long polling)`);
    const url = config.getWebAppUrl();
    console.log(url ? `[bot] Mini App URL: ${url}` : '[bot] No Mini App URL yet: run `npm run tunnel` so /start gets the Mini App button');
    bot.start({ drop_pending_updates: true });
  } catch (err) {
    console.error('[bot] failed to start:', err.message);
  }

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
