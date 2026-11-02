const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// The cafe is in Tashkent: "today" in the dashboard and order times must follow local time even on a UTC host.
process.env.TZ = process.env.TZ || 'Asia/Tashkent';

const required = ['DATABASE_URL', 'BOT_TOKEN', 'JWT_SECRET', 'ADMIN_PASSWORD'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[config] Missing env variable: ${key}`);
    process.exit(1);
  }
}

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

if (isProd) {
  // the admin API is reachable from the internet in production: refuse weak secrets
  if (process.env.ADMIN_PASSWORD.length < 12) {
    console.error('[config] ADMIN_PASSWORD must be at least 12 characters in production');
    process.exit(1);
  }
  if (process.env.JWT_SECRET.length < 32) {
    console.error('[config] JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }
}

const trimSlash = (s) => (s || '').trim().replace(/\/+$/, '');

module.exports = {
  env,
  isProd,
  port: Number(process.env.PORT) || 3001,
  rootDir: path.join(__dirname, '..', '..'),
  uploadsDir: path.join(__dirname, '..', '..', 'uploads'),
  clientDist: path.join(__dirname, '..', '..', 'client', 'dist'),
  botToken: process.env.BOT_TOKEN,
  // Public HTTPS URL of the Mini App. `npm run tunnel` writes it to .webapp-url,
  // which is re-read on every call so the bot picks up a new tunnel without a restart.
  getWebAppUrl() {
    let url = process.env.WEBAPP_URL || '';
    try {
      const fromTunnel = fs.readFileSync(path.join(__dirname, '..', '..', '.webapp-url'), 'utf8').trim();
      if (fromTunnel) url = fromTunnel;
    } catch {
      /* no tunnel file: fall back to WEBAPP_URL */
    }
    return trimSlash(url);
  },
  // Public URL of THIS server (Render sets RENDER_EXTERNAL_URL). When present the bot uses a webhook
  // instead of long polling, so a sleeping free instance is woken up by Telegram.
  publicApiUrl: trimSlash(process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL),
  webhookSecret: crypto.createHash('sha256').update(`${process.env.BOT_TOKEN}:webhook`).digest('hex'),
  // Origins allowed to call the API from a browser (Mini App + admin on Vercel). Empty = allow all (local dev).
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(trimSlash).filter(Boolean),
  allowDevAuth: process.env.ALLOW_DEV_AUTH === 'true' && !isProd,
  adminPassword: process.env.ADMIN_PASSWORD,
  jwtSecret: process.env.JWT_SECRET,
  adminLocalOnly: process.env.ADMIN_LOCAL_ONLY !== 'false',
  // initData older than this is rejected (seconds)
  initDataMaxAge: 60 * 60 * 24,
  // Runtime defaults for the Setting table (editable from the admin dashboard)
  defaultSettings: {
    deliveryFee: '15000',
    freeDeliveryFrom: '150000',
    minOrder: '0',
    bonusPercent: '5',
    maxBonusPercent: '50',
    prepMinutes: '15',
    deliveryMinutes: '20',
  },
};
