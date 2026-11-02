import { useEffect, useState } from 'react';
import { api, errText, getToken, setToken } from './api';
import Dashboard from './pages/Dashboard.jsx';
import Orders from './pages/Orders.jsx';
import Menu from './pages/Menu.jsx';
import { Addons, Promos, Customers, SettingsPage } from './pages/Extras.jsx';

const PAGES = [
  { id: 'orders', label: 'Buyurtmalar', icon: '🧾', el: Orders },
  { id: 'dashboard', label: 'Statistika', icon: '📊', el: Dashboard },
  { id: 'menu', label: 'Menyu', icon: '🍽️', el: Menu },
  { id: 'addons', label: "Qo'shimchalar", icon: '➕', el: Addons },
  { id: 'promos', label: 'Promo-kodlar', icon: '🏷️', el: Promos },
  { id: 'customers', label: 'Mijozlar', icon: '👥', el: Customers },
  { id: 'settings', label: 'Sozlamalar', icon: '⚙️', el: SettingsPage },
];

function Login({ onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await api('/login', { method: 'POST', body: { password } });
      setToken(token);
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-8 text-center">
        <div className="mx-auto h-28 w-28 overflow-hidden rounded-full bg-cream">
          <img src="/logo.webp" alt="BUONO" className="h-full w-full mix-blend-multiply" />
        </div>
        <h1 className="mt-5 font-display text-3xl font-bold">Admin panel</h1>
        <p className="mt-1 text-sm text-muted">Faqat shu kompyuterdan (localhost)</p>
        <input className="field mt-6" type="password" autoFocus placeholder="Parol" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="mt-3 text-sm font-semibold text-bad">{error}</p>}
        <button className="btn-primary mt-4 w-full" disabled={busy || !password}>Kirish</button>
      </form>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [page, setPage] = useState(() => localStorage.getItem('buono-admin-page') || 'orders');
  const [newOrders, setNewOrders] = useState(0);

  useEffect(() => {
    const out = () => setAuthed(false);
    window.addEventListener('buono-logout', out);
    return () => window.removeEventListener('buono-logout', out);
  }, []);

  useEffect(() => localStorage.setItem('buono-admin-page', page), [page]);

  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  const Current = PAGES.find((p) => p.id === page)?.el || Orders;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface p-4 md:flex">
        <div className="flex items-center gap-3 px-2 pb-6 pt-2">
          <div className="h-14 w-14 overflow-hidden rounded-full bg-cream">
            <img src="/logo.webp" alt="" className="h-full w-full mix-blend-multiply" />
          </div>
          <div>
            <p className="font-display text-xl font-bold leading-tight">BUONO</p>
            <p className="text-xs text-muted">Admin dashboard</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {PAGES.map((p) => (
            <button
              key={p.id}
              onClick={() => setPage(p.id)}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[14.5px] font-bold transition-colors ${page === p.id ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-white/5'}`}
            >
              <span className="text-lg">{p.icon}</span>
              {p.label}
              {p.id === 'orders' && newOrders > 0 && <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs font-black text-[#1b110c]">{newOrders}</span>}
            </button>
          ))}
        </nav>
        <button className="btn mt-4" onClick={() => { setToken(null); setAuthed(false); }}>Chiqish</button>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 flex gap-1 overflow-x-auto border-b border-line bg-surface p-2 md:hidden">
          {PAGES.map((p) => (
            <button key={p.id} onClick={() => setPage(p.id)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${page === p.id ? 'bg-accent/15 text-accent' : 'text-muted'}`}>
              {p.icon} {p.label}
            </button>
          ))}
        </div>
        <main className="mx-auto max-w-[1500px] p-5 md:p-8">
          <Current onActiveCount={setNewOrders} />
        </main>
      </div>
    </div>
  );
}
