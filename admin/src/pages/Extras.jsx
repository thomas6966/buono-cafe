import { useCallback, useEffect, useState } from 'react';
import { api, errText, money } from '../api';
import { Field, Modal, PageTitle, Toggle } from '../ui.jsx';

function useList(path, key) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setRows((await api(path))[key]);
    } catch (e) {
      setError(errText(e));
    }
  }, [path, key]);
  useEffect(() => { load(); }, [load]);
  return { rows, error, load };
}

async function save(path, row, body) {
  if (row.id) return api(`${path}/${row.id}`, { method: 'PUT', body });
  return api(path, { method: 'POST', body });
}

// ---------------- Add-ons (milk types, extras) ----------------
export function Addons() {
  const { rows, error, load } = useList('/addons', 'addons');
  const [cats, setCats] = useState([]);
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/categories').then((r) => setCats(r.categories)).catch(() => {}); }, []);

  const submit = async () => {
    setErr('');
    try {
      await save('/addons', edit, { ...edit, price: Number(edit.price) || 0 });
      setEdit(null);
      load();
    } catch (e) {
      setErr(errText(e));
    }
  };
  const remove = async (a) => {
    if (!confirm(`"${a.nameUz}" o'chirilsinmi?`)) return;
    await api(`/addons/${a.id}`, { method: 'DELETE' }).catch((e) => alert(errText(e)));
    load();
  };

  return (
    <div>
      <PageTitle right={<button className="btn-primary" onClick={() => setEdit({ kind: 'EXTRA', nameUz: '', nameRu: '', price: 0, categorySlugs: [], isActive: true, sortOrder: 0 })}>+ Yangi qo'shimcha</button>}>Qo'shimchalar</PageTitle>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Sut turlari (oat, bodom) va qo'shimcha shot, sirop, muzqaymoq kabi pullik qo'shimchalar. Har biri faqat tanlangan kategoriyalardagi mahsulotlarda ko'rinadi.
        Kategoriya ichida mahsulotda "Sut turini tanlash" yoqilgan bo'lishi kerak.
      </p>
      {error && <p className="text-bad">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead><tr><th>Turi</th><th>Nomi</th><th>Narx</th><th>Kategoriyalar</th><th>Holat</th><th /></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><span className={`badge ${a.kind === 'MILK' ? 'bg-info/20 text-info' : 'bg-gold/20 text-gold'}`}>{a.kind === 'MILK' ? 'Sut' : "Qo'shimcha"}</span></td>
                <td><p className="font-bold">{a.nameUz}</p><p className="text-xs text-muted">{a.nameRu}</p></td>
                <td className="font-bold text-gold">+{money(a.price)}</td>
                <td className="text-sm text-muted">{a.categorySlugs.join(', ') || '—'}</td>
                <td><span className={`badge ${a.isActive ? 'bg-ok/20 text-ok' : 'bg-white/10 text-muted'}`}>{a.isActive ? 'Faol' : "O'chiq"}</span></td>
                <td className="text-right whitespace-nowrap"><button className="btn mr-2" onClick={() => setEdit({ ...a })}>✏️</button><button className="btn btn-danger" onClick={() => remove(a)}>🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Qo\'shimchani tahrirlash' : "Yangi qo'shimcha"}>
        {edit && (
          <div className="grid gap-4">
            <Field label="Turi">
              <select className="field" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
                <option value="EXTRA">Qo'shimcha (shot, sirop…)</option>
                <option value="MILK">Sut turi</option>
              </select>
            </Field>
            <Field label="Nomi (O'zbekcha)"><input className="field" value={edit.nameUz} onChange={(e) => setEdit({ ...edit, nameUz: e.target.value })} /></Field>
            <Field label="Nomi (Ruscha)"><input className="field" value={edit.nameRu} onChange={(e) => setEdit({ ...edit, nameRu: e.target.value })} /></Field>
            <Field label="Qo'shimcha narx (so'm)"><input className="field" type="number" min="0" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></Field>
            <div>
              <span className="mb-2 block text-[12px] font-bold uppercase tracking-wider text-muted">Qaysi kategoriyalarda ko'rinadi</span>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => {
                  const on = edit.categorySlugs.includes(c.slug);
                  return (
                    <button key={c.id} type="button" onClick={() => setEdit({ ...edit, categorySlugs: on ? edit.categorySlugs.filter((s) => s !== c.slug) : [...edit.categorySlugs, c.slug] })}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted'}`}>{c.icon} {c.nameUz}</button>
                  );
                })}
              </div>
            </div>
            <Toggle label="Faol" checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} />
            {err && <p className="text-sm font-semibold text-bad">{err}</p>}
            <div className="flex justify-end gap-2"><button className="btn" onClick={() => setEdit(null)}>Bekor qilish</button><button className="btn-primary" onClick={submit}>Saqlash</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------- Promo codes ----------------
export function Promos() {
  const { rows, error, load } = useList('/promos', 'promos');
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!edit.code.trim()) return setErr('Kodni kiriting');
    try {
      await save('/promos', edit, { ...edit, value: Number(edit.value), minOrder: Number(edit.minOrder) || 0, maxUses: edit.maxUses === '' ? null : Number(edit.maxUses) });
      setEdit(null);
      load();
    } catch (e) {
      setErr(errText(e));
    }
  };
  const remove = async (p) => {
    if (!confirm(`${p.code} o'chirilsinmi?`)) return;
    await api(`/promos/${p.id}`, { method: 'DELETE' }).catch((e) => alert(errText(e)));
    load();
  };

  return (
    <div>
      <PageTitle right={<button className="btn-primary" onClick={() => setEdit({ code: '', type: 'PERCENT', value: 10, minOrder: 0, maxUses: '', isActive: true, expiresAt: '' })}>+ Yangi promo-kod</button>}>Promo-kodlar</PageTitle>
      {error && <p className="text-bad">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead><tr><th>Kod</th><th>Chegirma</th><th>Min. summa</th><th>Ishlatilgan</th><th>Muddati</th><th>Holat</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="font-mono font-extrabold tracking-wider">{p.code}</td>
                <td className="font-bold text-gold">{p.type === 'PERCENT' ? `${p.value}%` : `${money(p.value)} so'm`}</td>
                <td>{p.minOrder ? money(p.minOrder) : '—'}</td>
                <td>{p.usedCount}{p.maxUses ? ` / ${p.maxUses}` : ''}</td>
                <td className="text-muted">{p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('uz-UZ') : 'Cheksiz'}</td>
                <td><span className={`badge ${p.isActive ? 'bg-ok/20 text-ok' : 'bg-white/10 text-muted'}`}>{p.isActive ? 'Faol' : "O'chiq"}</span></td>
                <td className="text-right whitespace-nowrap"><button className="btn mr-2" onClick={() => setEdit({ ...p, maxUses: p.maxUses ?? '', expiresAt: p.expiresAt ? p.expiresAt.slice(0, 10) : '' })}>✏️</button><button className="btn btn-danger" onClick={() => remove(p)}>🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-muted">Promo-kodlar yo'q</p>}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Promo-kod' : 'Yangi promo-kod'}>
        {edit && (
          <div className="grid gap-4">
            <Field label="Kod"><input className="field font-mono uppercase" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Turi">
                <select className="field" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>
                  <option value="PERCENT">Foiz (%)</option>
                  <option value="FIXED">Aniq summa (so'm)</option>
                </select>
              </Field>
              <Field label={edit.type === 'PERCENT' ? 'Foiz' : "Summa (so'm)"}><input className="field" type="number" min="1" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} /></Field>
              <Field label="Minimal buyurtma (so'm)"><input className="field" type="number" min="0" value={edit.minOrder} onChange={(e) => setEdit({ ...edit, minOrder: e.target.value })} /></Field>
              <Field label="Maksimal ishlatilish" hint="Bo'sh — cheksiz"><input className="field" type="number" min="1" value={edit.maxUses} onChange={(e) => setEdit({ ...edit, maxUses: e.target.value })} /></Field>
            </div>
            <Field label="Amal qilish muddati" hint="Bo'sh — cheksiz"><input className="field" type="date" value={edit.expiresAt} onChange={(e) => setEdit({ ...edit, expiresAt: e.target.value })} /></Field>
            <Toggle label="Faol" checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} />
            {err && <p className="text-sm font-semibold text-bad">{err}</p>}
            <div className="flex justify-end gap-2"><button className="btn" onClick={() => setEdit(null)}>Bekor qilish</button><button className="btn-primary" onClick={submit}>Saqlash</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------- Customers ----------------
export function Customers() {
  const { rows, error } = useList('/users', 'users');
  return (
    <div>
      <PageTitle>Mijozlar</PageTitle>
      {error && <p className="text-bad">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead><tr><th>Ism</th><th>Telegram</th><th>Telefon</th><th>Til</th><th>Buyurtmalar</th><th>Bonus</th><th>Qo'shilgan</th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="font-bold">{u.firstName} {u.lastName || ''}</td>
                <td className="text-muted">{u.username ? `@${u.username}` : u.telegramId}</td>
                <td>{u.phone || '—'}</td>
                <td>{u.language.toUpperCase()}</td>
                <td>{u._count.orders}</td>
                <td className="font-bold text-gold">⭐ {money(u.bonusPoints)}</td>
                <td className="text-muted">{new Date(u.createdAt).toLocaleDateString('uz-UZ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-muted">Hali mijozlar yo'q</p>}
      </div>
    </div>
  );
}

// ---------------- Settings ----------------
const SETTING_FIELDS = [
  ['deliveryFee', "Yetkazib berish narxi (so'm)"],
  ['freeDeliveryFrom', "Shu summadan boshlab yetkazib berish bepul (so'm, 0 — o'chiq)"],
  ['minOrder', "Minimal buyurtma summasi (so'm, 0 — cheklov yo'q)"],
  ['bonusPercent', 'Bonus ball foizi (buyurtma summasidan %)'],
  ['maxBonusPercent', "Bonus bilan to'lash mumkin bo'lgan maksimal ulush (%)"],
  ['prepMinutes', 'Tayyorlash vaqti (daqiqa)'],
  ['deliveryMinutes', "Yo'lda ketadigan vaqt (daqiqa)"],
];

export function SettingsPage() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/settings').then((r) => setS(r.settings)).catch((e) => setMsg(errText(e))); }, []);
  if (!s) return <p className="text-muted">{msg || 'Yuklanmoqda…'}</p>;

  const submit = async () => {
    try {
      const r = await api('/settings', { method: 'PUT', body: s });
      setS(r.settings);
      setMsg('✓ Saqlandi');
    } catch (e) {
      setMsg(errText(e));
    }
  };

  return (
    <div>
      <PageTitle>Sozlamalar</PageTitle>
      <div className="card max-w-2xl p-6">
        <div className="grid gap-4">
          {SETTING_FIELDS.map(([key, label]) => (
            <Field key={key} label={label}>
              <input className="field" type="number" min="0" value={s[key]} onChange={(e) => setS({ ...s, [key]: e.target.value })} />
            </Field>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-4">
          <button className="btn-primary" onClick={submit}>Saqlash</button>
          {msg && <span className="text-sm font-semibold text-ok">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
