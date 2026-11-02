import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errText, money } from '../api';
import { Field, Modal, PageTitle, TAG_LABEL, Toggle } from '../ui.jsx';

const EMPTY_PRODUCT = {
  categoryId: '', nameUz: '', nameRu: '', descUz: '', descRu: '', price: '', imageUrl: '',
  tags: [], isAvailable: true, allowMilk: false, allowSugar: false, sortOrder: 0, variants: [],
};
const EMPTY_CATEGORY = { slug: '', nameUz: '', nameRu: '', icon: '🍽️', sortOrder: 0, isActive: true };

function ProductForm({ initial, categories, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ ...EMPTY_PRODUCT, ...initial, price: initial?.price ?? '', variants: (initial?.variants || []).map((v) => ({ label: v.label, price: v.price })) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const isNew = !initial?.id;

  const upload = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    try {
      const { url } = await api('/upload', { method: 'POST', form });
      set({ imageUrl: url });
    } catch (e) {
      setError(errText(e));
    }
  };

  const save = async () => {
    if (!f.categoryId || !f.nameUz.trim() || !f.nameRu.trim()) return setError("Kategoriya va ikkala tildagi nomni to'ldiring");
    if (!f.variants.length && !(Number(f.price) > 0)) return setError("Narxni kiriting yoki hajm/variantlar qo'shing");
    setBusy(true);
    setError('');
    try {
      const body = { ...f, categoryId: Number(f.categoryId), price: Number(f.price) || 0 };
      if (isNew) await api('/products', { method: 'POST', body });
      else await api(`/products/${initial.id}`, { method: 'PUT', body });
      onSaved();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={isNew ? 'Yangi mahsulot' : 'Mahsulotni tahrirlash'} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Kategoriya">
          <select className="field" value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
            <option value="">— tanlang —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.nameUz}</option>)}
          </select>
        </Field>
        <Field label="Tartib raqami" hint="Kichik raqam — yuqorida">
          <input className="field" type="number" value={f.sortOrder} onChange={(e) => set({ sortOrder: e.target.value })} />
        </Field>
        <Field label="Nomi (O'zbekcha)"><input className="field" value={f.nameUz} onChange={(e) => set({ nameUz: e.target.value })} /></Field>
        <Field label="Nomi (Ruscha)"><input className="field" value={f.nameRu} onChange={(e) => set({ nameRu: e.target.value })} /></Field>
        <Field label="Tavsif (O'zbekcha)"><textarea className="field" rows={2} value={f.descUz} onChange={(e) => set({ descUz: e.target.value })} /></Field>
        <Field label="Tavsif (Ruscha)"><textarea className="field" rows={2} value={f.descRu} onChange={(e) => set({ descRu: e.target.value })} /></Field>

        <Field label="Narx (so'm)" hint="Hajm/variantlar bo'lsa, eng arzoni avtomatik olinadi">
          <input className="field" type="number" min="0" value={f.price} onChange={(e) => set({ price: e.target.value })} disabled={f.variants.length > 0} />
        </Field>

        <div>
          <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-muted">Rasm</span>
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">{f.imageUrl && <img src={f.imageUrl} className="h-full w-full object-cover" alt="" />}</div>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:font-bold file:text-cream" onChange={(e) => upload(e.target.files?.[0])} />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <span className="mb-2 block text-[12px] font-bold uppercase tracking-wider text-muted">Hajm / variantlar (S, M, L, 25 sm…)</span>
        {f.variants.map((v, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <input className="field" placeholder="Nomi (masalan 25 sm)" value={v.label} onChange={(e) => set({ variants: f.variants.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <input className="field !w-40" type="number" placeholder="Narx" value={v.price} onChange={(e) => set({ variants: f.variants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })} />
            <button className="btn btn-danger" onClick={() => set({ variants: f.variants.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <button className="btn" onClick={() => set({ variants: [...f.variants, { label: '', price: '' }] })}>+ Variant qo'shish</button>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
        {Object.entries(TAG_LABEL).map(([tag, label]) => (
          <Toggle key={tag} label={label} checked={f.tags.includes(tag)} onChange={(on) => set({ tags: on ? [...f.tags, tag] : f.tags.filter((t) => t !== tag) })} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
        <Toggle label="Sut turini tanlash (oat/bodom)" checked={f.allowMilk} onChange={(v) => set({ allowMilk: v })} />
        <Toggle label="Shakar darajasi" checked={f.allowSugar} onChange={(v) => set({ allowSugar: v })} />
        <Toggle label="Mavjud (sotuvda)" checked={f.isAvailable} onChange={(v) => set({ isAvailable: v })} />
      </div>

      {error && <p className="mt-4 text-sm font-semibold text-bad">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Bekor qilish</button>
        <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
      </div>
    </Modal>
  );
}

function CategoryManager({ categories, onChanged }) {
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');
  const save = async () => {
    setError('');
    try {
      const body = { ...edit, sortOrder: Number(edit.sortOrder) || 0 };
      if (edit.id) await api(`/categories/${edit.id}`, { method: 'PUT', body });
      else await api('/categories', { method: 'POST', body });
      setEdit(null);
      onChanged();
    } catch (e) {
      setError(errText(e));
    }
  };
  const remove = async (c) => {
    if (!confirm(`"${c.nameUz}" kategoriyasi va ichidagi ${c._count.products} ta mahsulot o'chiriladi. Davom etasizmi?`)) return;
    try {
      await api(`/categories/${c.id}`, { method: 'DELETE' });
      onChanged();
    } catch (e) {
      alert(errText(e));
    }
  };
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <p className="text-sm text-muted">Kategoriyalar tartibi va ko'rinishini boshqaring</p>
        <button className="btn-primary" onClick={() => setEdit({ ...EMPTY_CATEGORY })}>+ Yangi kategoriya</button>
      </div>
      <table className="w-full">
        <thead><tr><th>Tartib</th><th>Nomi</th><th>Slug</th><th>Mahsulotlar</th><th>Holat</th><th /></tr></thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <td>{c.sortOrder}</td>
              <td className="font-bold">{c.icon} {c.nameUz} <span className="font-normal text-muted">/ {c.nameRu}</span></td>
              <td className="text-muted">{c.slug}</td>
              <td>{c._count.products}</td>
              <td><span className={`badge ${c.isActive ? 'bg-ok/20 text-ok' : 'bg-white/10 text-muted'}`}>{c.isActive ? "Ko'rinadi" : 'Yashirin'}</span></td>
              <td className="text-right">
                <button className="btn mr-2" onClick={() => setEdit({ ...c })}>✏️</button>
                <button className="btn btn-danger" onClick={() => remove(c)}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Kategoriya' : 'Yangi kategoriya'}>
        {edit && (
          <div className="grid gap-4">
            <Field label="Nomi (O'zbekcha)"><input className="field" value={edit.nameUz} onChange={(e) => setEdit({ ...edit, nameUz: e.target.value })} /></Field>
            <Field label="Nomi (Ruscha)"><input className="field" value={edit.nameRu} onChange={(e) => setEdit({ ...edit, nameRu: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Slug (lotin)"><input className="field" value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></Field>
              <Field label="Emoji"><input className="field" value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} /></Field>
              <Field label="Tartib"><input className="field" type="number" value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: e.target.value })} /></Field>
            </div>
            <Toggle label="Mini App'da ko'rinsin" checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} />
            {error && <p className="text-sm font-semibold text-bad">{error}</p>}
            <div className="flex justify-end gap-2"><button className="btn" onClick={() => setEdit(null)}>Bekor qilish</button><button className="btn-primary" onClick={save}>Saqlash</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function Menu() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [onlyOff, setOnlyOff] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState('products');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([api('/categories'), api('/products')]);
      setCategories(c.categories);
      setProducts(p.products);
    } catch (e) {
      setError(errText(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => (cat === 'all' || p.categoryId === Number(cat)) && (!onlyOff || !p.isAvailable) && (!needle || `${p.nameUz} ${p.nameRu}`.toLowerCase().includes(needle)));
  }, [products, cat, q, onlyOff]);

  const toggle = async (p) => {
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, isAvailable: !x.isAvailable } : x)));
    try {
      await api(`/products/${p.id}/availability`, { method: 'PATCH', body: { isAvailable: !p.isAvailable } });
    } catch (e) {
      alert(errText(e));
      load();
    }
  };

  const remove = async (p) => {
    if (!confirm(`"${p.nameUz}" o'chirilsinmi?`)) return;
    try {
      await api(`/products/${p.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      alert(errText(e));
    }
  };

  return (
    <div>
      <PageTitle
        right={
          <>
            <div className="flex rounded-xl border border-line bg-surface p-1 text-sm font-bold">
              {[['products', 'Mahsulotlar'], ['categories', 'Kategoriyalar']].map(([id, l]) => (
                <button key={id} onClick={() => setTab(id)} className={`rounded-lg px-4 py-2 ${tab === id ? 'bg-accent text-[#1b110c]' : 'text-muted'}`}>{l}</button>
              ))}
            </div>
            {tab === 'products' && <button className="btn-primary" onClick={() => setEditing({})}>+ Yangi mahsulot</button>}
          </>
        }
      >
        Menyu
      </PageTitle>
      {error && <p className="mb-4 text-bad">{error}</p>}

      {tab === 'categories' ? (
        <CategoryManager categories={categories} onChanged={load} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <input className="field !w-72" placeholder="🔎 Qidirish…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="field !w-60" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="all">Barcha kategoriyalar ({products.length})</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.nameUz} ({c._count.products})</option>)}
            </select>
            <Toggle label="Faqat mavjud emaslar" checked={onlyOff} onChange={setOnlyOff} />
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead><tr><th /><th>Nomi</th><th>Kategoriya</th><th>Narx</th><th>Belgilar</th><th>Mavjud</th><th /></tr></thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className={p.isAvailable ? '' : 'opacity-60'}>
                    <td className="w-16"><div className="h-12 w-12 overflow-hidden rounded-lg bg-surface-2">{p.imageUrl && <img src={p.imageUrl} loading="lazy" className="h-full w-full object-cover" alt="" />}</div></td>
                    <td><p className="font-bold">{p.nameUz}</p><p className="text-xs text-muted">{p.nameRu}</p></td>
                    <td className="text-muted">{p.category.nameUz}</td>
                    <td>
                      {p.variants.length > 1 ? p.variants.map((v) => <div key={v.id} className="text-sm"><span className="text-muted">{v.label}:</span> <b className="text-gold">{money(v.price)}</b></div>) : <b className="text-gold">{money(p.price)}</b>}
                    </td>
                    <td className="text-lg">{p.tags.map((t) => TAG_LABEL[t]?.split(' ')[0]).join(' ')}</td>
                    <td><Toggle checked={p.isAvailable} onChange={() => toggle(p)} /></td>
                    <td className="whitespace-nowrap text-right">
                      <button className="btn mr-2" onClick={() => setEditing(p)}>✏️</button>
                      <button className="btn btn-danger" onClick={() => remove(p)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && <p className="p-8 text-center text-muted">Hech narsa topilmadi</p>}
          </div>
        </>
      )}

      {editing && (
        <ProductForm
          key={editing.id || 'new'}
          initial={editing.id ? editing : { categoryId: cat !== 'all' ? cat : '' }}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
