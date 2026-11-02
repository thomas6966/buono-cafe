import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { errorKey, useT } from '../lib/i18n';
import { haptic } from '../lib/tg';
import { cartKey, money, pick } from '../lib/util';
import { useStore } from '../store';
import type { Fulfillment, Order, OrderStatus } from '../types';
import { Img } from './ui';

const ACTIVE: OrderStatus[] = ['PENDING', 'PREPARING', 'READY', 'ON_THE_WAY'];

const STEPS: Record<Fulfillment, OrderStatus[]> = {
  DELIVERY: ['PENDING', 'PREPARING', 'ON_THE_WAY', 'COMPLETED'],
  TAKEAWAY: ['PENDING', 'PREPARING', 'READY', 'COMPLETED'],
  DINE_IN: ['PENDING', 'PREPARING', 'READY', 'COMPLETED'],
};

const FULFILL_ICON: Record<Fulfillment, string> = { DINE_IN: '🍽️', TAKEAWAY: '🛍️', DELIVERY: '🛵' };

function useStatusLabel() {
  const { t } = useT();
  return (o: { status: OrderStatus; fulfillment: Fulfillment }) =>
    o.status === 'READY' ? t(`status.READY.${o.fulfillment}`) : t(`status.${o.status}`);
}

function Tracker({ order }: { order: Order }) {
  const label = useStatusLabel();
  const steps = STEPS[order.fulfillment];
  const current = Math.max(0, steps.indexOf(order.status));
  return (
    <div className="mt-4">
      <div className="relative flex justify-between">
        <div className="absolute left-[12%] right-[12%] top-[11px] h-[3px] rounded-full bg-white/10" />
        <motion.div
          className="absolute left-[12%] top-[11px] h-[3px] rounded-full bg-accent"
          initial={false}
          animate={{ width: `${(current / (steps.length - 1)) * 76}%` }}
          transition={{ duration: 0.6 }}
        />
        {steps.map((s, i) => {
          const done = i <= current;
          return (
            <div key={s} className="relative z-10 flex w-1/4 flex-col items-center">
              <motion.div
                animate={i === current ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={{ repeat: i === current ? Infinity : 0, duration: 1.6 }}
                className={`grid h-6 w-6 place-items-center rounded-full border-2 text-[11px] font-black ${done ? 'border-accent bg-accent text-[#1b110c]' : 'border-white/20 bg-surface text-transparent'}`}
              >
                ✓
              </motion.div>
              <span className={`mt-1.5 text-center text-[10.5px] font-semibold leading-tight ${done ? 'text-cream' : 'text-muted'}`}>
                {label({ status: s, fulfillment: order.fulfillment })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderLines({ order, lang }: { order: Order; lang: 'uz' | 'ru' }) {
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {order.items.map((i) => (
        <div key={i.id} className="flex items-center gap-2.5 text-[13px]">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-surface-2">
            <Img src={i.imageUrl} alt="" fallback="🍽️" className="h-full w-full object-cover" />
          </div>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-bold text-accent">{i.quantity}×</span> {pick(lang, i)}
            {i.variantLabel && <span className="text-muted"> · {i.variantLabel}</span>}
          </span>
          <span className="text-muted">{money(i.lineTotal)}</span>
        </div>
      ))}
    </div>
  );
}

export function OrdersTab() {
  const { t, lang } = useT();
  const orders = useStore((s) => s.orders);
  const menu = useStore((s) => s.menu)!;
  const refreshOrders = useStore((s) => s.refreshOrders);
  const upsertOrder = useStore((s) => s.upsertOrder);
  const addToCart = useStore((s) => s.addToCart);
  const showToast = useStore((s) => s.showToast);
  const setFlow = useStore((s) => s.setFlow);
  const setCartOpen = useStore((s) => s.setCartOpen);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const history = orders.filter((o) => !ACTIVE.includes(o.status));
  const label = useStatusLabel();

  useEffect(() => {
    refreshOrders();
    const id = setInterval(() => {
      if (!document.hidden) refreshOrders();
    }, 7000);
    return () => clearInterval(id);
  }, [refreshOrders]);

  const reorder = (o: Order) => {
    haptic.success();
    const products = new Map(menu.categories.flatMap((c) => c.products.map((p) => [p.id, p] as const)));
    const addons = new Set(menu.addons.map((a) => a.id));
    let skipped = 0;
    for (const i of o.items) {
      const p = i.productId ? products.get(i.productId) : undefined;
      if (!p) { skipped++; continue; }
      const variantId = p.variants.find((v) => v.id === i.options.variantId)?.id ?? p.variants[0]?.id ?? null;
      const item = {
        productId: p.id,
        variantId,
        milkId: i.options.milk && addons.has(i.options.milk.id) ? i.options.milk.id : null,
        sugar: p.allowSugar ? i.options.sugar ?? 50 : null,
        addonIds: (i.options.addons || []).map((a) => a.id).filter((id) => addons.has(id)),
        quantity: i.quantity,
      };
      addToCart(item);
    }
    showToast(skipped ? t('orders.reorderPartial') : `✓ ${t('orders.reordered')}`);
    if (skipped < o.items.length) setCartOpen(true);
  };

  const cancel = async (o: Order) => {
    setCancelling(o.id);
    try {
      const { order } = await api<{ order: Order }>(`/orders/${o.id}/cancel`, { method: 'POST' });
      upsertOrder(order);
    } catch (e: any) {
      showToast(t(errorKey(e?.code || 'server_error')));
    } finally {
      setCancelling(null);
    }
  };

  const when = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="safe-top px-4 pb-44 pt-4">
      <h1 className="font-display text-[30px] font-bold">{t('orders.title')}</h1>

      {orders.length === 0 && (
        <div className="py-20 text-center">
          <div className="text-6xl">🧾</div>
          <p className="mt-3 text-lg font-bold">{t('orders.empty')}</p>
          <p className="mt-1 text-sm text-muted">{t('orders.emptySub')}</p>
        </div>
      )}

      {active.length > 0 && (
        <>
          <h2 className="mb-3 mt-5 text-[13px] font-bold uppercase tracking-wider text-muted">{t('orders.active')}</h2>
          <div className="flex flex-col gap-3">
            {active.map((o) => (
              <motion.div layout key={o.id} className="rounded-3xl border border-accent/30 bg-surface p-4 shadow-[0_10px_40px_-20px_rgba(201,139,110,0.5)]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[18px] font-extrabold">{FULFILL_ICON[o.fulfillment]} {t('order.#')} #{o.number}</p>
                    <p className="text-[12px] text-muted">{when(o.createdAt)}{o.tableNumber ? ` · ${t('orders.table', { n: o.tableNumber })}` : ''}</p>
                  </div>
                  <span className="rounded-full bg-accent/15 px-3 py-1 text-[12px] font-bold text-accent">{label(o)}</span>
                </div>
                <Tracker order={o} />
                <OrderLines order={o} lang={lang} />
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <div>
                    <p className="text-[16px] font-extrabold text-gold">{money(o.total)} {t('unit.sum')}</p>
                    <p className={`text-[12px] font-semibold ${o.paymentStatus === 'PAID' ? 'text-ok' : 'text-muted'}`}>
                      {t(`pay.${o.paymentMethod}`)} · {o.paymentStatus === 'PAID' ? t('pay.paid') : t('pay.unpaid')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {o.paymentStatus === 'UNPAID' && ['CLICK', 'PAYME', 'UZUM'].includes(o.paymentMethod) && (
                      <button className="rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-[#1b110c]" onClick={() => setFlow({ order: o, stage: 'pay' })}>
                        {t('pay.payNow')}
                      </button>
                    )}
                    {o.status === 'PENDING' && o.paymentStatus === 'UNPAID' && (
                      <button className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-muted disabled:opacity-40" disabled={cancelling === o.id} onClick={() => cancel(o)}>
                        {t('orders.cancel')}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {history.length > 0 && (
        <>
          <h2 className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-wider text-muted">{t('orders.history')}</h2>
          <div className="flex flex-col gap-3">
            {history.map((o) => (
              <div key={o.id} className="rounded-3xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[16px] font-bold">{t('order.#')} #{o.number}</p>
                    <p className="text-[12px] text-muted">{when(o.createdAt)} · {t('orders.items', { n: o.items.reduce((s, i) => s + i.quantity, 0) })}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${o.status === 'COMPLETED' ? 'bg-ok/15 text-ok' : 'bg-bad/15 text-bad'}`}>{label(o)}</span>
                </div>
                <OrderLines order={o} lang={lang} />
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <p className="text-[15px] font-extrabold text-gold">{money(o.total)} {t('unit.sum')}</p>
                  <button className="rounded-full border border-accent px-4 py-2 text-[13px] font-bold text-accent active:scale-95" onClick={() => reorder(o)}>
                    ↻ {t('orders.reorder')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
