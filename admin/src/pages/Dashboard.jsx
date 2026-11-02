import { useEffect, useState } from 'react';
import { api, errText, money } from '../api';
import { PageTitle } from '../ui.jsx';

function Stat({ label, value, sub }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-[30px] font-extrabold leading-none">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () => api('/stats').then(setS).catch((e) => setError(errText(e)));
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  if (error) return <p className="text-bad">{error}</p>;
  if (!s) return <p className="text-muted">Yuklanmoqda…</p>;

  const max = Math.max(1, ...s.days.map((d) => d.revenue));
  const dayName = (iso) => new Date(iso).toLocaleDateString('uz-UZ', { weekday: 'short', day: 'numeric' });

  return (
    <div>
      <PageTitle>Statistika</PageTitle>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Bugungi buyurtmalar" value={s.todayOrders} />
        <Stat label="Bugungi tushum" value={`${money(s.todayRevenue)}`} sub="so'm (bekor qilinganlarsiz)" />
        <Stat label="Faol buyurtmalar" value={s.activeOrders} />
        <Stat label="Mijozlar" value={s.customers} sub="botdan foydalanganlar" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-5 text-sm font-extrabold uppercase tracking-wider text-muted">Oxirgi 7 kun tushumi</h2>
          <div className="flex h-52 items-end gap-3">
            {s.days.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[11px] font-bold text-muted">{d.revenue ? money(d.revenue / 1000) + 'k' : ''}</span>
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-lg bg-gradient-to-t from-accent-deep to-accent" style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%` }} title={`${d.orders} ta buyurtma`} />
                </div>
                <span className="text-[11px] font-semibold text-muted">{dayName(d.date)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-muted">Eng ko'p sotilgan (7 kun)</h2>
          {s.top.length === 0 && <p className="text-sm text-muted">Ma'lumot yo'q</p>}
          <ol className="space-y-3">
            {s.top.map((t, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/15 text-xs font-black text-accent">{i + 1}</span>
                <span className="flex-1 font-semibold">{t.nameUz}</span>
                <span className="font-extrabold text-gold">{t.quantity}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
