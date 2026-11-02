import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The dashboard talks to the API through this dev proxy (same origin, so no CORS needed).
// API_PROXY=https://buono-cafe.onrender.com points it at the live server; default is the local API.
const target = process.env.API_PROXY || 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: 'localhost',
    port: 5174,
    proxy: {
      '/api': { target, changeOrigin: true, secure: true },
      '/uploads': { target, changeOrigin: true, secure: true },
    },
  },
});
