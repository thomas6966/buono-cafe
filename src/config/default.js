const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const required = ['DATABASE_URL', 'BOT_TOKEN', 'JWT_SECRET', 'ADMIN_PASSWORD'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[config] Missing env variable: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
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
    return url.replace(/\/$/, '');
  },
  allowDevAuth: process.env.ALLOW_DEV_AUTH === 'true',
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
