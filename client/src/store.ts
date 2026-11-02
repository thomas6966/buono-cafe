import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './lib/api';
import { cartKey } from './lib/util';
import type { Address, CartItem, Lang, Menu, Order, User } from './types';

interface State {
  lang: Lang;
  langChosen: boolean;
  bootState: 'loading' | 'ready' | 'error';
  menu: Menu | null;
  user: User | null;
  addresses: Address[];
  favoriteIds: number[];
  orders: Order[];
  cart: CartItem[];
  toast: string | null;
  tab: "menu" | "orders" | "profile";
  cartOpen: boolean;
  flow: { order: Order; stage: "pay" | "done" } | null;

  setTab: (tab: State["tab"]) => void;
  setCartOpen: (open: boolean) => void;
  setFlow: (flow: State["flow"]) => void;
  boot: () => Promise<void>;
  setLang: (lang: Lang) => void;
  refreshOrders: () => Promise<void>;
  upsertOrder: (order: Order) => void;
  toggleFavorite: (productId: number) => Promise<void>;
  addToCart: (item: Omit<CartItem, 'key'>) => void;
  setQty: (key: string, quantity: number) => void;
  clearCart: () => void;
  setPhone: (phone: string) => Promise<void>;
  addAddress: (a: { label: string; address: string; lat?: number | null; lng?: number | null }) => Promise<Address>;
  removeAddress: (id: number) => Promise<void>;
  refreshMe: () => Promise<void>;
  showToast: (msg: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      lang: 'uz',
      langChosen: false,
      bootState: 'loading',
      menu: null,
      user: null,
      addresses: [],
      favoriteIds: [],
      orders: [],
      cart: [],
      toast: null,
      tab: "menu",
      cartOpen: false,
      flow: null,

      setTab: (tab) => set({ tab }),
      setCartOpen: (cartOpen) => set({ cartOpen }),
      setFlow: (flow) => set({ flow }),

      async boot() {
        set({ bootState: 'loading' });
        try {
          const [menu, me] = await Promise.all([
            api<Menu>('/menu'),
            api<{ user: User; addresses: Address[]; favoriteIds: number[] }>('/me'),
          ]);
          const { langChosen } = get();
          // drop cart lines whose product disappeared from the menu
          const ids = new Set(menu.categories.flatMap((c) => c.products.map((p) => p.id)));
          set({
            menu,
            user: me.user,
            addresses: me.addresses,
            favoriteIds: me.favoriteIds,
            cart: get().cart.filter((i) => ids.has(i.productId)),
            lang: langChosen ? get().lang : me.user.language,
            bootState: 'ready',
          });
          get().refreshOrders();
        } catch {
          set({ bootState: 'error' });
        }
      },

      setLang(lang) {
        set({ lang, langChosen: true });
        api('/me', { method: 'PATCH', body: { language: lang } }).catch(() => {});
      },

      async refreshOrders() {
        try {
          const { orders } = await api<{ orders: Order[] }>('/orders');
          set({ orders });
        } catch { /* keep the old list */ }
      },

      upsertOrder(order) {
        const rest = get().orders.filter((o) => o.id !== order.id);
        set({ orders: [order, ...rest].sort((a, b) => b.id - a.id) });
      },

      async toggleFavorite(productId) {
        const had = get().favoriteIds.includes(productId);
        set({ favoriteIds: had ? get().favoriteIds.filter((i) => i !== productId) : [...get().favoriteIds, productId] });
        try {
          await api(`/favorites/${productId}`, { method: 'POST' });
        } catch {
          set({ favoriteIds: had ? [...get().favoriteIds, productId] : get().favoriteIds.filter((i) => i !== productId) });
        }
      },

      addToCart(item) {
        const key = cartKey(item);
        const cart = get().cart;
        const existing = cart.find((c) => c.key === key);
        set({
          cart: existing
            ? cart.map((c) => (c.key === key ? { ...c, quantity: Math.min(50, c.quantity + item.quantity) } : c))
            : [...cart, { ...item, key }],
        });
      },

      setQty(key, quantity) {
        set({
          cart: get()
            .cart.map((c) => (c.key === key ? { ...c, quantity: Math.min(50, quantity) } : c))
            .filter((c) => c.quantity > 0),
        });
      },

      clearCart: () => set({ cart: [] }),

      async setPhone(phone) {
        const { user } = await api<{ user: User }>('/me', { method: 'PATCH', body: { phone } });
        set({ user });
      },

      async addAddress(a) {
        const { address } = await api<{ address: Address }>('/addresses', { method: 'POST', body: a });
        set({ addresses: [address, ...get().addresses] });
        return address;
      },

      async removeAddress(id) {
        await api(`/addresses/${id}`, { method: 'DELETE' });
        set({ addresses: get().addresses.filter((a) => a.id !== id) });
      },

      async refreshMe() {
        try {
          const me = await api<{ user: User }>('/me');
          set({ user: me.user });
        } catch { /* noop */ }
      },

      showToast(msg) {
        clearTimeout(toastTimer);
        set({ toast: msg });
        toastTimer = setTimeout(() => set({ toast: null }), 2200);
      },
    }),
    {
      name: 'buono-app',
      partialize: (s) => ({ lang: s.lang, langChosen: s.langChosen, cart: s.cart }),
    },
  ),
);
