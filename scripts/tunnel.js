// Opens a public HTTPS tunnel to the local server (Telegram only opens HTTPS Mini Apps),
// saves the URL to .webapp-url and points the bot's menu button at it.
//
//   npm run tunnel        (keep this window open while testing)
//
// The free *.trycloudflare.com address changes every time the tunnel restarts; this script
// re-registers the new one automatically. For a permanent address deploy to a host (see README).
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PORT = process.env.PORT || 3001;
const FILE = path.join(__dirname, '..', '.webapp-url');
const BIN = ['C:\Program Files (x86)\cloudflared\cloudflared.exe', 'C:\Program Files\cloudflared\cloudflared.exe'].find((p) => fs.existsSync(p)) || 'cloudflared';

async function telegram(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
}

async function publish(url) {
  fs.writeFileSync(FILE, url);
  await telegram('setChatMenuButton', { menu_button: { type: 'web_app', text: 'BUONO', web_app: { url } } });
  console.log(`\n✅ Mini App manzili: ${url}`);
  console.log('✅ Botning menyu tugmasi yangilandi. Telegram\'da botga /start yozing.\n');
}

const child = spawn(BIN, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
let announced = false;
const onData = (chunk) => {
  const text = chunk.toString();
  const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m && !announced) {
    announced = true;
    publish(m[0]).catch((err) => console.error('Telegram xatosi:', err.message));
  } else if (/ERR|error/i.test(text) && !announced) {
    console.error(text.trim());
  }
};
child.stdout.on('data', onData);
child.stderr.on('data', onData);
child.on('error', (err) => {
  console.error(`cloudflared ishga tushmadi: ${err.message}`);
  process.exit(1);
});
child.on('exit', (code) => {
  try { fs.unlinkSync(FILE); } catch { /* already gone */ }
  console.log(`Tunnel yopildi (kod ${code}).`);
  process.exit(code || 0);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill());
console.log('Tunnel ochilmoqda…');
