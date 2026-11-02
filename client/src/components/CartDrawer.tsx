import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { api, ApiError } from '../lib/api';
import { errorKey, useT } from '../lib/i18n';
import { haptic } from '../lib/tg';
import { money, optionSummary, pick, priceLine, type PricedLine } from '../lib/util';
import { useStore } from '../store';
import type { Fulfillment, Order, PaymentMethod, Quote } from '../types';
import { Chip, Img, Sheet, Stepper } from './ui';

const PAYMENTS: { id: PaymentMethod; color: string; glyph: string }[] = [
  { id: 'CLICK', color: '#1aa6e6', glyph: 'C' },
  { id: 'PAYME', color: '#2cc5bd', glyph: 'P' },
  { id: 'UZUM', color: '#8a4dff', glyph: 'U' },
  { id: 'CASH', color: '#8fc79a', glyph: '💵' },
  { id: 'TERMINAL', color: '#e6bd82', glyph: '💳' },
];

const FULFILLMENTS: { id: Fulfillment; key: string; icon: string }[] = [
  { id: 'DINE_IN', key: 'cart.dinein', icon: '🍽️' },
  { id: 'TAKEAWAY', key: 'cart.takeaway', icon: '🛍️' },
  { id: 'DELIVERY', key: 'cart.delivery', icon: '🛵' },
];

type Pickup = 'asap' | 15 | 30 | 45 | 60 | 'custom';

function Label({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2 mt-5 text-[13px] font-bold uppercase tracking-wider text-muted">{children}</h4>;
}

export function CartDrawer() {
  const { t, lang } = useT();
  const open = useStore((s) => s.cartOpen);
  const setOpen = useStore((s) => s.setCartOpen);
  const menu = useStore((s) => s.menu)!;
  const cart = useStore((s) => s.cart);
  const user = useStore((s) => s.user)!;
  const addresses = useStore((s) => s.addresses);
  const { setQty, addAddress, setPhone, upsertOrder, clearCart, setFlow, refreshMe, showToast, boot } = useStore.getState();

  const [fulfillment, setFulfillment] = useState<Fulfillment>('TAKEAWAY');
  const [table, setTable] = useState('');
  const [pickup, setPickup] = useState<Pickup>('asap');
  const [customTime, setCustomTime] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saveAddr, setSaveAddr] = useState(false);
  const [phone, setPhoneInput] = useState(user.phone || '');
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('CASH');
  const [promoInput, setPromoInput] = useState('');
  const [applied, setApplied] = useState<string | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);
  const [useBonus, setUseBonus] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(
    () => cart.map((i) => priceLine(menu, i)).filter(Boolean) as PricedLine[],
    [cart, menu],
  );
  const localSubtotal = lines.reduce((s, l) => s + l.total, 0);

  useEffect(() => {
    if (!open) return;
    setPhoneInput((p) => p || user.phone || '');
  }, [open, user.phone]);

  // server-side price quote (promo, bonus, delivery fee)
  useEffect(() => {
    if (!open || !cart.length) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const r = await api<Quote>('/cart/quote', {
          method: 'POST',
          body: {
            items: cart.map(({ key, ...rest }) => rest),
            fulfillment,
            promoCode: applied || undefined,
            useBonus,
          },
        });
        if (cancelled) return;
        setQuote(r);
        if (r.promoError) {
          setPromoErr(r.promoError);
          setApplied(null);
        }
      } catch (e) {
        if (e instanceof ApiError && e.code === 'product_unavailable') {
          showToast(t('err.product_unavailable'));
          boot();
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [open, cart, fulfillment, applied, useBonus]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = quote?.totals ?? {
    subtotal: localSubtotal, discount: 0, bonusUsed: 0, bonusEarned: 0, deliveryFee: 0, total: localSubtotal, estimatedMinutes: 15,
  };
  const belowMin = menu.settings.minOrder > 0 && localSubtotal < menu.settings.minOrder;

  const pin = () => {
    haptic.tap();
    if (!navigator.geolocation) return showToast(t('cart.pinFail'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        showToast(`📍 ${t('cart.pinned')}`);
      },
      () => showToast(t('cart.pinFail')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const pickupIso = () => {
    if (fulfillment !== 'TAKEAWAY' || pickup === 'asap') return undefined;
    if (pickup === 'custom') {
      if (!customTime) return undefined;
      const [h, m] = customTime.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      return d.toISOString();
    }
    return new Date(Date.now() + pickup * 60_000).toISOString();
  };

  const validate = (): string | null => {
    if (fulfillment === 'DINE_IN' && !table.trim()) return 'table_required';
    if (fulfillment === 'DELIVERY') {
      if (address.trim().length < 5) return 'address_required';
      if (phone.replace(/\D/g, '').length < 9) return 'phone_required';
    }
    return null;
  };

  const place = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      haptic.error();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { order } = await api<{ order: Order }>('/orders', {
        method: 'POST',
        body: {
          items: cart.map(({ key, ...rest }) => rest),
          fulfillment,
          tableNumber: fulfillment === 'DINE_IN' ? table.trim() : undefined,
          pickupTime: pickupIso(),
          address: fulfillment === 'DELIVERY' ? address.trim() : undefined,
          lat: fulfillment === 'DELIVERY' ? coords?.lat : undefined,
          lng: fulfillment === 'DELIVERY' ? coords?.lng : undefined,
          phone: phone.trim() || undefined,
          note: note.trim() || undefined,
          paymentMethod: payment,
          promoCode: applied || undefined,
          useBonus,
        },
      });
      if (fulfillment === 'DELIVERY' && saveAddr && !addresses.some((a) => a.address === address.trim())) {
        addAddress({ label: t('common.home'), address: address.trim(), lat: coords?.lat, lng: coords?.lng }).catch(() => {});
      }
      if (phone.trim() && phone.trim() !== user.phone) setPhone(phone.trim()).catch(() => {});
      haptic.success();
      upsertOrder(order);
      clearCart();
      setQuote(null);
      setApplied(null);
      setPromoInput('');
      setUseBonus(false);
      setNote('');
      setOpen(false);
      refreshMe();
      setFlow({ order, stage: ['CLICK', 'PAYME', 'UZUM'].includes(order.paymentMethod) ? 'pay' : 'done' });
    } catch (e) {
      haptic.error();
      const code = e instanceof ApiError ? e.code : 'server_error';
      setError(code === 'product_unavailable' ? 'product_unavailable' : code);
      if (code === 'product_unavailable') boot();
    } finally {
      setBusy(false);
    }
  };

  const applyPromo = () => {
    if (!promoInput.trim()) return;
    haptic.tap();
    setPromoErr(null);
    setApplied(promoInput.trim());
  };

  const selectField = 'field';

  return (
    <Sheet open={open} onClose={() => setOpen(false)}>
      <div className="flex shrink-0 items-center justify-between px-5 pb-2">
        <h2 className="font-display text-[26px] font-bold">{t('cart.title')}</h2>
        {lines.length > 0 && (
          <button className="text-[13px] font-semibold text-muted" onClick={() => { clearCart(); setOpen(false); }}>
            ✕ {t('common.cancel')}
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="px-5 pb-12 pt-10 text-center">
          <div className="text-6xl">🛒</div>
          <p className="mt-3 text-lg font-bold">{t('cart.empty')}</p>
          <p className="mt-1 text-sm text-muted">{t('cart.emptySub')}</p>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
            {/* items */}
            <div className="flex flex-col gap-3">
              {lines.map((l) => (
                <motion.div layout key={l.item.key} className="flex gap-3 rounded-2xl border border-line bg-surface-2 p-2.5">
                  <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-surface">
                    <Img src={l.product.imageUrl} alt="" fallback="🍽️" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-[14px] font-bold">{pick(lang, l.product)}</p>
                    <p className="line-clamp-2 text-[11.5px] leading-snug text-muted">{optionSummary(lang, l, t)}</p>
                    <div className="mt-auto flex items-center justify-between pt-1.5">
                      <span className="text-[14px] font-extrabold text-gold">{money(l.total)}</span>
                      <Stepper value={l.item.quantity} onChange={(n) => { haptic.select(); setQty(l.item.key, n); }} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* promo */}
            <Label>{t('cart.promo')}</Label>
            <div className="flex gap-2">
              <input className={selectField} placeholder="BUONO10" value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} autoCapitalize="characters" />
              <button className="shrink-0 rounded-[14px] border border-accent px-4 text-[14px] font-bold text-accent" onClick={applyPromo}>
                {t('cart.promoApply')}
              </button>
            </div>
            {quote?.promo && applied && <p className="mt-2 text-[13px] font-semibold text-ok">✓ {t('cart.promoOk')}: {quote.promo.code} {quote.promo.type === 'PERCENT' ? `−${quote.promo.value}%` : `−${money(quote.promo.value)}`}</p>}
            {promoErr && <p className="mt-2 text-[13px] font-semibold text-bad">{t(errorKey(promoErr))}</p>}

            {/* fulfillment */}
            <Label>{t('cart.fulfillment')}</Label>
            <div className="grid grid-cols-3 gap-2">
              {FULFILLMENTS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { haptic.select(); setFulfillment(f.id); setError(null); }}
                  className={`rounded-2xl border px-2 py-3 text-center text-[12.5px] font-bold transition-colors ${fulfillment === f.id ? 'border-accent bg-accent/15 text-cream' : 'border-line bg-surface-2 text-muted'}`}
                >
                  <div className="text-xl">{f.icon}</div>
                  <div className="mt-1">{t(f.key)}</div>
                </button>
              ))}
            </div>

            {fulfillment === 'DINE_IN' && (
              <div className="mt-3">
                <input className={selectField} inputMode="numeric" maxLength={10} placeholder={t('cart.table')} value={table} onChange={(e) => setTable(e.target.value)} />
              </div>
            )}

            {fulfillment === 'TAKEAWAY' && (
              <div className="mt-3">
                <p className="mb-2 text-[12.5px] text-muted">{t('cart.pickup')}</p>
                <div className="flex flex-wrap gap-2">
                  <Chip active={pickup === 'asap'} onClick={() => setPickup('asap')}>⚡ {t('cart.asap')}</Chip>
                  {([15, 30, 45, 60] as const).map((m) => (
                    <Chip key={m} active={pickup === m} onClick={() => setPickup(m)}>{t('cart.inMin', { n: m })}</Chip>
                  ))}
                  <Chip active={pickup === 'custom'} onClick={() => setPickup('custom')}>🕒</Chip>
                </div>
                {pickup === 'custom' && <input type="time" className={`${selectField} mt-2`} value={customTime} onChange={(e) => setCustomTime(e.target.value)} />}
              </div>
            )}

            {fulfillment === 'DELIVERY' && (
              <div className="mt-3">
                {addresses.length > 0 && (
                  <div className="mb-2 flex gap-2 overflow-x-auto">
                    {addresses.map((a) => (
                      <Chip key={a.id} active={address === a.address} onClick={() => { setAddress(a.address); setCoords(a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : null); }}>
                        📍 {a.label}
                      </Chip>
                    ))}
                  </div>
                )}
                <textarea className={`${selectField} resize-none`} rows={2} placeholder={t('cart.addressPlaceholder')} value={address} onChange={(e) => setAddress(e.target.value)} />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button onClick={pin} className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold ${coords ? 'border-ok text-ok' : 'border-line text-muted'}`}>
                    📍 {coords ? t('cart.pinned') : t('cart.pin')}
                  </button>
                  <label className="flex items-center gap-2 text-[13px] text-muted">
                    <input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} />
                    {t('cart.saveAddress')}
                  </label>
                </div>
              </div>
            )}

            <div className="mt-3 grid gap-2">
              <input className={selectField} type="tel" inputMode="tel" placeholder={`${t('cart.phone')}${fulfillment === 'DELIVERY' ? ' *' : ''}`} value={phone} onChange={(e) => setPhoneInput(e.target.value)} />
              <input className={selectField} placeholder={t('cart.note')} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {/* payment */}
            <Label>{t('cart.payment')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { haptic.select(); setPayment(p.id); }}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left text-[14px] font-bold transition-colors ${payment === p.id ? 'border-accent bg-accent/15' : 'border-line bg-surface-2 text-muted'}`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[14px] font-black text-white" style={{ background: p.glyph.length === 1 ? p.color : `${p.color}33` }}>
                    {p.glyph}
                  </span>
                  {t(`pay.${p.id}`)}
                </button>
              ))}
            </div>

            {user.bonusPoints > 0 && (
              <button
                onClick={() => { haptic.select(); setUseBonus(!useBonus); }}
                className={`mt-4 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${useBonus ? 'border-gold bg-gold/10' : 'border-line bg-surface-2'}`}
              >
                <span>
                  <span className="block text-[14px] font-bold">⭐ {t('cart.useBonus')}</span>
                  <span className="text-[12px] text-muted">{t('cart.bonusHave', { n: money(user.bonusPoints) })}</span>
                </span>
                <span className={`grid h-6 w-6 place-items-center rounded-full border text-[13px] ${useBonus ? 'border-gold bg-gold text-[#1b110c]' : 'border-white/25'}`}>{useBonus && '✓'}</span>
              </button>
            )}

            {/* totals */}
            <div className="mt-5 space-y-2 rounded-2xl border border-line bg-surface-2 p-4 text-[14px]">
              <Row label={t('cart.subtotal')} value={money(totals.subtotal)} />
              {totals.discount > 0 && <Row label={t('cart.discount')} value={`−${money(totals.discount)}`} tone="ok" />}
              {totals.bonusUsed > 0 && <Row label={t('cart.bonus')} value={`−${money(totals.bonusUsed)}`} tone="ok" />}
              {fulfillment === 'DELIVERY' && (
                <Row label={t('cart.deliveryFee')} value={totals.deliveryFee > 0 ? money(totals.deliveryFee) : t('cart.free')} tone={totals.deliveryFee > 0 ? undefined : 'ok'} />
              )}
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-[15px] font-bold">{t('cart.total')}</span>
                <span className="text-[22px] font-extrabold text-gold">{money(totals.total)} <span className="text-[12px] font-semibold text-muted">{t('unit.sum')}</span></span>
              </div>
              {totals.bonusEarned > 0 && <p className="text-right text-[12px] text-muted">⭐ {t('cart.earn', { n: money(totals.bonusEarned) })}</p>}
            </div>
          </div>

          <div className="glass safe-bottom shrink-0 border-x-0 border-b-0 px-5 pt-3">
            {(error || belowMin) && (
              <p className="mb-2 text-center text-[13px] font-semibold text-bad">
                {belowMin ? `${t('err.min_order')}: ${money(menu.settings.minOrder)}` : t(errorKey(error!))}
              </p>
            )}
            <button className="btn-primary flex w-full items-center justify-between" disabled={busy || belowMin} onClick={place}>
              <span>{busy ? t('cart.placing') : t('cart.place')}</span>
              {!busy && <span>{money(totals.total)}</span>}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'ok' }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className={`font-semibold ${tone === 'ok' ? 'text-ok' : ''}`}>{value}</span>
    </div>
  );
}
