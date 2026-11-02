const KEY = 'buono-admin-token';

// Backend origin: empty in local dev (Vite proxy); set VITE_API_URL on Vercel.
const trimSlash = (s) => s.replace(/\/+$/, '');
const API_URL = trimSlash(import.meta.env.VITE_API_URL || '');
const CLIENT_URL = trimSlash(import.meta.env.VITE_CLIENT_URL || '');

// Product photos: /menu/* live on the Mini App host, /api/* ones on the backend.
export function imgUrl(url) {
  if (!url) return '';
  if (url.startsWith('/api/')) return API_URL + url;
  if (url.startsWith('/menu/')) return CLIENT_URL + url;
  return url;
}

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

export class ApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}/api/admin${path}`, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401 && path !== '/login') {
    setToken(null);
    window.dispatchEvent(new Event('buono-logout'));
  }
  if (!res.ok) throw new ApiError(res.status, data?.error || 'server_error');
  return data;
}

export const money = (n) => Math.round(n || 0).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');

export const ERRORS = {
  wrong_password: "Parol noto'g'ri",
  too_many_attempts: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring",
  duplicate: 'Bu qiymat allaqachon mavjud',
  in_use: "Bu yozuv ishlatilmoqda, o'chirib bo'lmaydi (avval ichidagilarni o'chiring)",
  order_closed: 'Buyurtma allaqachon yopilgan',
  bad_image: 'Faqat JPG, PNG yoki WEBP (5 MB gacha)',
  server_error: 'Server xatosi',
};
export const errText = (e) => ERRORS[e?.code] || e?.code || 'Xatolik';
