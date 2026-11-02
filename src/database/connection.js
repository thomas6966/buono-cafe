const { PrismaClient } = require('@prisma/client');

// BigInt (telegramId) must survive res.json()
BigInt.prototype.toJSON = function toJSON() {
  return this.toString();
};

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
