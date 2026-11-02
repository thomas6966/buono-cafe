import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CartDrawer } from './components/CartDrawer';
import { OrderSuccess, PaymentSim } from './components/Flow';
import { MenuTab } from './components/MenuTab';
import { OrdersTab } from './components/OrdersTab';
import { ProfileTab } from './components/ProfileTab';
import { Splash } from './components/Splash';
import { Toast } from './components/ui';
import { useT } from './lib/i18n';
import { haptic } from './lib/tg';
import { money, priceLine } from './lib/util';
import { useStore } from './store';

const ICONS = {
  menu: <path d="M6 3v7a3 3 0 0 0 3 3v8M9 3v6M12 3v7a3 3 0 0 1-3 3M17 21V3c-2.2 1.2-3.5 3.5-3.5 6.5S14.8 14 17 14" />,
  orders: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6" />,
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6" />,
};

function BottomNav() {
  const { t } = useT();
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const activeCount = useStore((s) => s.orders.filter((o) => ['PENDING', 'PREPARING', 'READY', 'ON_THE_WAY'].includes(o.status)).length);

  return (
    <nav className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-xl justify-around rounded-t-[26px] border-x-0 border-b-0 px-4 pt-2.5">
      {(['menu', 'orders', 'profile'] as const).map((id) => {
        const active = tab === id;
        return (
          <button
            key={id}
            onClick={() => {
              haptic.select();
              if (tab === id) window.scrollTo({ top: 0, behavior: 'smooth' });
              setTab(id);
            }}
            className={`relative flex w-24 flex-col items-center gap-1 pb-1 text-[11px] font-bold transition-colors ${active ? 'text-accent' : 'text-muted'}`}
          >
            <span className="relative">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[id]}
              </svg>
              {id === 'orders' && activeCount > 0 && (
                <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-black text-[#1b110c]">{activeCount}</span>
              )}
            </span>
            {t(`nav.${id}`)}
            {active && <motion.span layoutId="navdot" className="absolute -top-2.5 h-[3px] w-8 rounded-full bg-accent" />}
          </button>
        );
      })}
    </nav>
  );
}

function CartBar() {
  const { t } = useT();
  const cart = useStore((s) => s.cart);
  const menu = useStore((s) => s.menu)!;
  const setOpen = useStore((s) => s.setCartOpen);
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const total = cart.reduce((s, i) => s + (priceLine(menu, i)?.total ?? 0), 0);

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.button
          key="cartbar"
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          onClick={() => { haptic.tap(); setOpen(true); }}
          className="btn-primary fixed inset-x-4 bottom-[calc(max(env(safe-area-inset-bottom),12px)+68px)] z-30 mx-auto flex max-w-[calc(36rem-2rem)] items-center justify-between"
        >
          <span className="flex items-center gap-2.5">
            <span className="grid h-7 min-w-7 place-items-center rounded-full bg-[#1b110c]/85 px-1.5 text-[13px] font-black text-cream">{count}</span>
            {t('cart.view')}
          </span>
          <span>{money(total)}</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

function Shell() {
  const tab = useStore((s) => s.tab);
  return (
    <div className="mx-auto min-h-full max-w-xl">
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'menu' && <MenuTab />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'profile' && <ProfileTab />}
        </motion.main>
      </AnimatePresence>
      <CartBar />
      <BottomNav />
      <CartDrawer />
      <PaymentSim />
      <OrderSuccess />
    </div>
  );
}

export default function App() {
  const bootState = useStore((s) => s.bootState);
  const boot = useStore((s) => s.boot);
  const lang = useStore((s) => s.lang);
  const [minSplash, setMinSplash] = useState(false);

  useEffect(() => {
    boot();
    const id = setTimeout(() => setMinSplash(true), 1900);
    return () => clearTimeout(id);
  }, [boot]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <>
      {bootState === 'ready' && <Shell />}
      <AnimatePresence>{(bootState !== 'ready' || !minSplash) && <Splash key="splash" failed={bootState === 'error'} onRetry={boot} />}</AnimatePresence>
      <Toast />
    </>
  );
}
