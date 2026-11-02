import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../lib/api';
import { errorKey, useT } from '../lib/i18n';
import { haptic } from '../lib/tg';
import { money } from '../lib/util';
import { useStore } from '../store';
import type { Order } from '../types';
import { Sheet } from './ui';

const GATEWAY: Record<string, { name: string; color: string }> = {
  CLICK: { name: 'Click', color: '#1aa6e6' },
  PAYME: { name: 'Payme', color: '#2cc5bd' },
  UZUM: { name: 'Uzum', color: '#8a4dff' },
};

// Simulated gateway. Swap `/orders/:id/pay` for a real Click/Payme/Uzum redirect + webhook later.
export function PaymentSim() {
  const { t } = useT();
  const flow = useStore((s) => s.flow);
  const setFlow = useStore((s) => s.setFlow);
  const upsertOrder = useStore((s) => s.upsertOrder);
  const showToast = useStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  const order = flow?.stage === 'pay' ? flow.order : null;
  const gw = order ? GATEWAY[order.paymentMethod] : null;

  const later = () => flow && setFlow({ order: flow.order, stage: 'done' });

  const pay = async () => {
    if (!order) return;
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 1100)); // feels like a real gateway round-trip
      const res = await api<{ order: Order }>(`/orders/${order.id}/pay`, { method: 'POST' });
      upsertOrder(res.order);
      haptic.success();
      setFlow({ order: res.order, stage: 'done' });
    } catch (e: any) {
      haptic.error();
      showToast(t(errorKey(e?.code || 'server_error')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!order} onClose={later} z={70}>
      {order && gw && (
        <div className="px-5 pb-6">
          <div className="rounded-3xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${gw.color}, ${gw.color}99)` }}>
            <p className="text-[13px] font-semibold opacity-80">{t('pay.sim.title')}</p>
            <p className="mt-1 text-3xl font-black tracking-tight">{gw.name}</p>
            <p className="mt-6 text-[13px] opacity-80">BUONO · #{order.number}</p>
            <p className="text-[30px] font-extrabold">{money(order.total)} <span className="text-base font-semibold">{t('unit.sum')}</span></p>
          </div>
          <p className="mt-4 text-center text-[12.5px] text-muted">{t('pay.sim.hint')}</p>
          <button className="btn-primary mt-4 w-full" disabled={busy} onClick={pay}>
            {busy ? t('pay.sim.paying') : `${t('pay.sim.confirm')} · ${money(order.total)}`}
          </button>
          <button className="mt-2 w-full py-3 text-[14px] font-semibold text-muted" disabled={busy} onClick={later}>
            {t('pay.sim.later')}
          </button>
        </div>
      )}
    </Sheet>
  );
}

export function OrderSuccess() {
  const { t } = useT();
  const flow = useStore((s) => s.flow);
  const setFlow = useStore((s) => s.setFlow);
  const setTab = useStore((s) => s.setTab);
  const order = flow?.stage === 'done' ? flow.order : null;

  const close = (tab: 'menu' | 'orders') => {
    setTab(tab);
    setFlow(null);
    window.scrollTo({ top: 0 });
  };

  return (
    <AnimatePresence>
      {order && (
        <motion.div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-bg px-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(143,199,154,0.16),transparent_60%)]" />
          <motion.svg width="124" height="124" viewBox="0 0 124 124" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
            <motion.circle cx="62" cy="62" r="56" fill="rgba(143,199,154,0.12)" stroke="#8fc79a" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
            <motion.path d="M38 64l17 17 32-36" fill="none" stroke="#8fc79a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.45, duration: 0.5 }} />
          </motion.svg>

          <motion.h1 className="mt-7 font-display text-[30px] font-bold" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
            {t('ok.title')}
          </motion.h1>

          <motion.div className="mt-6 w-full max-w-sm rounded-3xl border border-line bg-surface p-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}>
            <p className="text-[12px] font-bold uppercase tracking-widest text-muted">{t('ok.number')}</p>
            <p className="mt-1 text-[34px] font-black tracking-wide text-gold">#{order.number}</p>
            <div className="my-4 h-px bg-line" />
            <p className="text-[12px] font-bold uppercase tracking-widest text-muted">{t('ok.eta')}</p>
            <p className="mt-1 text-[22px] font-extrabold">⏱ ~{t('ok.min', { n: order.estimatedMinutes })}</p>
            <div className="mt-4 flex justify-between text-[14px]">
              <span className="text-muted">{t('cart.total')}</span>
              <span className="font-bold">{money(order.total)} {t('unit.sum')}</span>
            </div>
          </motion.div>

          <motion.div className="mt-7 flex w-full max-w-sm flex-col gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
            <button className="btn-primary w-full" onClick={() => close('orders')}>{t('ok.track')}</button>
            <button className="w-full py-3 text-[14px] font-semibold text-muted" onClick={() => close('menu')}>{t('ok.toMenu')}</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
