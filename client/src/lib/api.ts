import { inTelegram, tg } from './tg';

// Backend origin. Empty in local dev (Vite/Express proxy); on Vercel set VITE_API_URL to the Render URL.
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) || '').replace(/\/+$/, '');

// Photos: /menu/* are static files of the Mini App itself, /api/* ones come from the backend.
export const asset = (url: string | null) => (url && url.startsWith('/api/') ? API_BASE + url : url);

export class ApiError extends Error {
  status: number;
  code: string;
  data: any;
  constructor(status: number, code: string, data: any) {
    super(code);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// Browser dev mode (outside Telegram): the server accepts this header only from localhost.
function devHeader() {
  let user: Record<string, unknown> | null = null;
  try {
    user = JSON.parse(localStorage.getItem('buono-dev-user') || 'null');
  } catch { /* noop */ }
  if (!user) {
    user = { id: 1000000001, first_name: 'Dev', last_name: 'User', username: 'dev_user', language_code: 'uz' };
    try { localStorage.setItem('buono-dev-user', JSON.stringify(user)); } catch { /* noop */ }
  }
  return JSON.stringify(user);
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (inTelegram) headers.Authorization = `tma ${tg.initData}`;
  else headers['x-dev-user'] = devHeader();

  // a sleeping free-tier server can need ~1 minute to wake up
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 70_000);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/client${path}`, {
      signal: ctrl.signal,
      method: opts.method || 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, 'network', null);
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || 'server_error', data);
  return data as T;
}
