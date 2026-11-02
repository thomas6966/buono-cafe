import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errText, money } from '../api';
import { PageTitle } from '../ui.jsx';

const FULFILL = { DINE_IN: '🍽️ Zalda', TAKEAWAY: '🛍️ Olib ketish', DELIVERY: '🛵 Yetkazib berish' };
const PAY = { CLICK: 'Click', PAYME: 'Payme', UZUM: 'Uzum', CASH: 'Naqd', TERMINAL: 'Terminal' };
const STATUS_LABEL = {
  PENDING: 'Yangi', PREPARING: 'Tayyorlanmoqda', READY: 'Tayyor', ON_THE_WAY: "Yo'lda", COMPLETED: 'Yakunlangan', CANCELLED: 'Bekor qilingan',
};
const STATUS_TONE = {
  PENDING: 'bg-gold/20 text-gold', PREPARING: 'bg-info/20 text-info', READY: 'bg-ok/20 text-ok', ON_THE_WAY: 'bg-ok/20 text-ok',
  COMPLETED: 'bg-white/10 text-muted', CANCELLED: 'bg-bad/15 text-bad',
};

function nextStep(o) {
  if (o.status === 'PENDING') return { to: 'PREPARING', label: '👨‍🍳 Tayyorlashni boshlash' };
  if (o.status === 'PREPARING') return o.fulfillment === 'DELIVERY' ? { to: 'ON_THE_WAY', label: "🛵 Yo'lga chiqdi" } : { to: 'READY', label: '✅ Tayyor' };
  if (o.status === 'READY' || o.status === 'ON_THE_WAY') return { to: 'COMPLETED', label: '🎉 Topshirildi' };
  return null;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175, 1568].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.start(t);
      o.stop(t + 0.16);
    });
  } catch { /* audio blocked until first click */ }
}

const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  return m < 1 ? 'hozir' : m < 60 ? `${m} daq. oldin` : `${Math.floor(m / 60)} soat ${m % 60} daq.`;
};
const clock = (iso) => new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

function Options({ item }) {
  const o = item.options || {};
  const bits = [];
  if (item.variantLabel) bits.push(item.variantLabel);
  if (o.milk) bits.push(o.milk.nameUz);
  if (o.sugar !== undefined) bits.push(`shakar ${o.sugar}%`);
  (o.addons || []).forEach((a) => bits.push(`+ ${a.nameUz}`));
  return bits.length ? <span className="text-muted"> · {bits.join(' · ')}</span> : null;
}

function OrderCard({ o, onAction, busy }) {
  const step = nextStep(o);
  const closed = o.status === 'COMPLETED' || o.status === 'CANCELLED';
  const name = [o.user.firstName, o.user.lastName].filter(Boolean).join(' ');
  return (
    <div className={`card p-4 ${o.status === 'PENDING' ? 'border-gold/60 shadow-[0_0_0_1px_rgba(230,189,130,0.25)]' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xl font-extrabold">#{o.number}</p>
          <p className="text-xs text-muted">{clock(o.createdAt)} · {ago(o.createdAt)}</p>
        </div>
        <span className={`badge ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
      </div>

      <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
        <p className="font-bold">{FULFILL[o.fulfillment]}{o.tableNumber ? ` · Stol ${o.tableNumber}` : ''}</p>
        {o.scheduledFor && <p className="text-gold">🕒 {clock(o.scheduledFor)} ga</p>}
        {o.address && <p className="mt-1">📍 {o.address}{o.lat ? <> · <a className="text-info underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${o.lat},${o.lng}`}>xarita</a></> : null}</p>}
        <p className="mt-1 text-muted">
          👤 {name}{o.user.username ? ` (@${o.user.username})` : ''}
          {(o.phone || o.user.phone) && <> · 📞 <a className="text-info" href={`tel:${o.phone || o.user.phone}`}>{o.phone || o.user.phone}</a></>}
        </p>
        {o.note && <p className="mt-1 font-semibold text-gold">💬 {o.note}</p>}
      </div>

      <ul className="mt-3 space-y-1.5 text-sm">
        {o.items.map((i) => (
          <li key={i.id}>
            <span className="font-extrabold text-accent">{i.quantity}×</span> {i.nameUz}
            <Options item={i} />
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
        <div>
          <p className="text-lg font-extrabold text-gold">{money(o.total)} so'm</p>
          {(o.discount > 0 || o.bonusUsed > 0) && <p className="text-xs text-muted">{o.promoCode ? `${o.promoCode} −${money(o.discount)} ` : ''}{o.bonusUsed ? `bonus −${money(o.bonusUsed)}` : ''}</p>}
        </div>
        <button
          className={`badge ${o.paymentStatus === 'PAID' ? 'bg-ok/20 text-ok' : 'bg-bad/15 text-bad'}`}
          title="To'lov holatini almashtirish"
          onClick={() => onAction(o.id, 'payment', o.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID')}
        >
          {PAY[o.paymentMethod]} · {o.paymentStatus === 'PAID' ? "to'langan" : "to'lanmagan"}
        </button>
      </div>

      {!closed && (
        <div className="mt-3 flex gap-2">
          {step && <button className="btn-primary flex-1" disabled={busy} onClick={() => onAction(o.id, 'status', step.to)}>{step.label}</button>}
          <button className="btn btn-danger" disabled={busy} onClick={() => confirm(`#${o.number} buyurtmani bekor qilasizmi?`) && onAction(o.id, 'status', 'CANCELLED')}>Bekor</button>
        </div>
      )}
    </div>
  );
}

export default function Orders({ onActiveCount }) {
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState('active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sound, setSound] = useState(true);
  const seen = useRef(null);
  const soundRef = useRef(true);
  soundRef.current = sound;

  const load = useCallback(async () => {
    try {
      const since = view === 'today' ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString() : undefined;
      const q = new URLSearchParams({ status: view === 'active' ? 'active' : 'all', ...(since ? { since } : {}) });
      const { orders: list } = await api(`/orders?${q}`);
      setOrders(list);
      setError('');
      const pending = list.filter((o) => o.status === 'PENDING');
      onActiveCount?.(pending.length);
      const maxId = list.reduce((m, o) => Math.max(m, o.id), 0);
      if (seen.current !== null && maxId > seen.current && soundRef.current) {
        beep();
        document.title = '🔔 Yangi buyurtma! — BUONO';
      }
      seen.current = Math.max(seen.current ?? 0, maxId);
    } catch (e) {
      setError(errText(e));
    }
  }, [view, onActiveCount]);

  useEffect(() => {
    seen.current = null;
    load();
    const id = setInterval(load, 5000);
    const reset = () => (document.title = 'BUONO Admin');
    window.addEventListener('focus', reset);
    return () => { clearInterval(id); window.removeEventListener('focus', reset); };
  }, [load]);

  const act = async (id, kind, value) => {
    setBusy(true);
    try {
      await api(`/orders/${id}/${kind}`, { method: 'PATCH', body: kind === 'status' ? { status: value } : { paymentStatus: value } });
      await load();
    } catch (e) {
      alert(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const cols = [
    { id: 'PENDING', title: '🆕 Yangi', match: (o) => o.status === 'PENDING' },
    { id: 'PREPARING', title: '👨‍🍳 Tayyorlanmoqda', match: (o) => o.status === 'PREPARING' },
    { id: 'READY', title: '✅ Tayyor / yo\'lda', match: (o) => o.status === 'READY' || o.status === 'ON_THE_WAY' },
  ];

  return (
    <div>
      <PageTitle
        right={
          <>
            <div className="flex rounded-xl border border-line bg-surface p-1 text-sm font-bold">
              {[['active', 'Faol'], ['today', 'Bugun'], ['all', 'Oxirgi 200']].map(([id, label]) => (
                <button key={id} onClick={() => setView(id)} className={`rounded-lg px-4 py-2 ${view === id ? 'bg-accent text-[#1b110c]' : 'text-muted'}`}>{label}</button>
              ))}
            </div>
            <button className="btn" onClick={() => { setSound(!sound); if (!sound) beep(); }}>{sound ? '🔔 Ovoz yoqilgan' : '🔕 Ovoz o\'chiq'}</button>
          </>
        }
      >
        Buyurtmalar
      </PageTitle>
      {error && <p className="mb-4 rounded-xl bg-bad/15 p-3 text-sm font-semibold text-bad">{error}</p>}

      {view === 'active' ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {cols.map((c) => {
            const list = orders.filter(c.match).sort((a, b) => a.id - b.id);
            return (
              <section key={c.id}>
                <h2 className="mb-3 flex items-center justify-between text-sm font-extrabold uppercase tracking-wider text-muted">
                  {c.title}<span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">{list.length}</span>
                </h2>
                <div className="flex flex-col gap-4">
                  {list.map((o) => <OrderCard key={o.id} o={o} onAction={act} busy={busy} />)}
                  {list.length === 0 && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">Bo'sh</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((o) => <OrderCard key={o.id} o={o} onAction={act} busy={busy} />)}
          {orders.length === 0 && <p className="text-muted">Buyurtmalar yo'q</p>}
        </div>
      )}
    </div>
  );
}
