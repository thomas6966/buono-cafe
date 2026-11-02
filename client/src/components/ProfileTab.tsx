import { useState } from 'react';
import { motion } from 'framer-motion';
import { errorKey, useT } from '../lib/i18n';
import { haptic } from '../lib/tg';
import { money, pick } from '../lib/util';
import { useStore } from '../store';
import { Avatar, LangSwitch } from './MenuTab';
import { Img } from './ui';

export function ProfileTab() {
  const { t, lang } = useT();
  const user = useStore((s) => s.user)!;
  const menu = useStore((s) => s.menu)!;
  const addresses = useStore((s) => s.addresses);
  const favoriteIds = useStore((s) => s.favoriteIds);
  const { addAddress, removeAddress, setPhone, toggleFavorite, showToast, addToCart, setTab } = useStore.getState();

  const [label, setLabel] = useState('');
  const [addr, setAddr] = useState('');
  const [phone, setPhoneInput] = useState(user.phone || '');
  const [adding, setAdding] = useState(false);

  const favorites = menu.categories.flatMap((c) => c.products.map((p) => ({ p, c }))).filter(({ p }) => favoriteIds.includes(p.id));
  const { bonusPercent } = menu.settings;

  const saveAddress = async () => {
    if (addr.trim().length < 5) return showToast(t('err.address_required'));
    try {
      await addAddress({ label: label.trim() || t('common.home'), address: addr.trim() });
      setLabel(''); setAddr(''); setAdding(false);
      haptic.success();
    } catch (e: any) {
      showToast(t(errorKey(e?.code || 'server_error')));
    }
  };

  return (
    <div className="safe-top px-4 pb-44 pt-4">
      <div className="flex items-center gap-4">
        <Avatar size={68} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[26px] font-bold leading-tight">{user.firstName} {user.lastName || ''}</h1>
          <p className="truncate text-[13px] text-muted">{user.username ? `@${user.username} · ` : ''}ID {user.telegramId}</p>
        </div>
      </div>

      {/* BUONO Club */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mt-5 overflow-hidden rounded-[26px] p-5"
        style={{ background: 'linear-gradient(135deg,#c98b6e 0%,#8c4f3b 55%,#4a2a20 100%)' }}
      >
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <p className="text-[12px] font-extrabold uppercase tracking-[0.25em] text-white/75">{t('profile.club')}</p>
        <p className="mt-3 text-[44px] font-black leading-none text-white">⭐ {money(user.bonusPoints)}</p>
        <p className="mt-1 text-[13px] font-semibold text-white/80">{t('profile.points')}</p>
        <p className="mt-4 text-[12px] leading-snug text-white/75">{t('profile.clubInfo', { p: bonusPercent })}</p>
      </motion.div>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
        <span className="text-[14px] font-bold">🌐 {t('profile.language')}</span>
        <LangSwitch />
      </div>

      <div className="mt-3 flex gap-2">
        <input className="field" type="tel" inputMode="tel" placeholder={t('profile.phone')} value={phone} onChange={(e) => setPhoneInput(e.target.value)} />
        <button
          className="shrink-0 rounded-[14px] border border-accent px-4 text-[14px] font-bold text-accent disabled:opacity-40"
          disabled={phone.trim() === (user.phone || '')}
          onClick={() => setPhone(phone.trim()).then(() => { haptic.success(); showToast('✓'); }).catch(() => showToast(t('err.server_error')))}
        >
          {t('profile.save')}
        </button>
      </div>

      {/* addresses */}
      <div className="mb-3 mt-7 flex items-center justify-between">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted">{t('profile.addresses')}</h2>
        <button className="text-[13px] font-bold text-accent" onClick={() => setAdding(!adding)}>{adding ? '✕' : `+ ${t('profile.addAddress')}`}</button>
      </div>
      {adding && (
        <div className="mb-3 grid gap-2 rounded-2xl border border-line bg-surface p-3">
          <input className="field" placeholder={t('profile.addressLabel')} value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
          <textarea className="field resize-none" rows={2} placeholder={t('cart.addressPlaceholder')} value={addr} onChange={(e) => setAddr(e.target.value)} />
          <button className="btn-primary" onClick={saveAddress}>{t('profile.save')}</button>
        </div>
      )}
      {addresses.length === 0 && !adding && <p className="text-[13px] text-muted">{t('profile.noAddresses')}</p>}
      <div className="flex flex-col gap-2">
        {addresses.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
            <span className="text-xl">📍</span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold">{a.label}</p>
              <p className="truncate text-[12.5px] text-muted">{a.address}</p>
            </div>
            <button aria-label="delete" className="p-2 text-muted" onClick={() => { haptic.tap(); removeAddress(a.id); }}>🗑</button>
          </div>
        ))}
      </div>

      {/* favorites */}
      <h2 className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-wider text-muted">❤️ {t('profile.favorites')}</h2>
      {favorites.length === 0 ? (
        <p className="text-[13px] text-muted">{t('profile.noFavorites')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {favorites.map(({ p, c }) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                <Img src={p.imageUrl} alt="" fallback={c.icon} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold">{pick(lang, p)}</p>
                <p className="text-[13px] font-bold text-gold">{p.variants.length > 1 ? `${t('price.from')} ` : ''}{money(p.price)}</p>
              </div>
              <button
                aria-label="add"
                className="grid h-9 w-9 place-items-center rounded-full bg-accent text-xl font-bold text-[#1b110c]"
                onClick={() => {
                  haptic.success();
                  addToCart({ productId: p.id, variantId: p.variants[0]?.id ?? null, milkId: null, sugar: p.allowSugar ? 50 : null, addonIds: [], quantity: 1 });
                  showToast(`✓ ${pick(lang, p)}`);
                }}
              >
                +
              </button>
              <button aria-label="remove" className="p-1.5 text-lg" onClick={() => toggleFavorite(p.id)}>💔</button>
            </div>
          ))}
        </div>
      )}
      <button className="mt-6 w-full py-2 text-[13px] font-semibold text-muted" onClick={() => setTab('menu')}>← {t('nav.menu')}</button>
    </div>
  );
}
