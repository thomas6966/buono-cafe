const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/default');
const User = require('../models/User');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// True only for requests that really come from this machine (not via a public tunnel).
function isLocalRequest(req) {
  if (!LOCAL_HOSTS.has(req.hostname)) return false;
  if (req.headers['x-forwarded-for'] || req.headers['cf-connecting-ip'] || req.headers['x-forwarded-host']) {
    return false;
  }
  return true;
}

// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function validateInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const calculated = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const a = Buffer.from(calculated, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > config.initDataMaxAge) return null;

  try {
    return JSON.parse(params.get('user'));
  } catch {
    return null;
  }
}

// Mini App user: `Authorization: tma <initData>`
async function authenticate(req, res, next) {
  try {
    let tgUser = null;
    const header = req.headers.authorization || '';

    if (header.startsWith('tma ')) {
      tgUser = validateInitData(header.slice(4));
    } else if (config.allowDevAuth && isLocalRequest(req) && req.headers['x-dev-user']) {
      tgUser = JSON.parse(req.headers['x-dev-user']);
    }

    if (!tgUser || !tgUser.id) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    req.user = await User.upsertFromTelegram(tgUser);
    next();
  } catch (err) {
    next(err);
  }
}

// Admin dashboard: only from localhost + JWT from /api/admin/login
function adminLocalOnly(req, res, next) {
  if (config.adminLocalOnly && !isLocalRequest(req)) {
    return res.status(404).json({ error: 'not_found' });
  }
  next();
}

function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret);
    if (payload.role !== 'admin') throw new Error('bad role');
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

function signAdminToken() {
  return jwt.sign({ role: 'admin' }, config.jwtSecret, { expiresIn: '12h' });
}

module.exports = { authenticate, adminLocalOnly, adminAuth, signAdminToken, validateInitData, isLocalRequest };
