// Builds the admin dashboard into client/public/admin so it is served at <Mini App URL>/admin/
// (same Vercel project as the Mini App: no extra project, and the API already allows that origin).
//
//   npm run admin:publish        then redeploy the Mini App on Vercel
const { spawnSync } = require('child_process');
const path = require('path');

const api = process.env.VITE_API_URL || 'https://buono-cafe.onrender.com';
const res = spawnSync(
  'npx',
  ['vite', 'build', '--outDir', '../client/public/admin', '--emptyOutDir'],
  {
    cwd: path.join(__dirname, '..', 'admin'),
    stdio: 'inherit',
    shell: true,
    // empty VITE_CLIENT_URL: menu photos (/menu/...) are on the same origin
    env: { ...process.env, ADMIN_BASE: '/admin/', VITE_API_URL: api, VITE_CLIENT_URL: '' },
  },
);
process.exit(res.status ?? 1);
