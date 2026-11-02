import type { Addon, CartItem, Lang, Menu, Product, Variant } from '../types';

export const money = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');

export const pick = (lang: Lang, o: { nameUz: string; nameRu: string }) => (lang === 'ru' ? o.nameRu : o.nameUz);
export const pickDesc = (lang: Lang, o: { descUz: string; descRu: string }) => (lang === 'ru' ? o.descRu : o.descUz);

const indexCache = new WeakMap<Menu, { products: Map<number, Product>; addons: Map<number, Addon>; slugs: Map<number, string> }>();
function index(menu: Menu) {
  let idx = indexCache.get(menu);
  if (!idx) {
    const products = new Map<number, Product>();
    const slugs = new Map<number, string>();
    for (const c of menu.categories) for (const p of c.products) { products.set(p.id, p); slugs.set(p.id, c.slug); }
    idx = { products, addons: new Map(menu.addons.map((a) => [a.id, a])), slugs };
    indexCache.set(menu, idx);
  }
  return idx;
}

export const findProduct = (menu: Menu, id: number) => index(menu).products.get(id);
export const categorySlug = (menu: Menu, productId: number) => index(menu).slugs.get(productId) || '';

export interface PricedLine {
  item: CartItem;
  product: Product;
  variant: Variant | null;
  milk: Addon | null;
  addons: Addon[];
  unit: number;
  total: number;
}

export function priceLine(menu: Menu, item: CartItem): PricedLine | null {
  const idx = index(menu);
  const product = idx.products.get(item.productId);
  if (!product) return null;
  let unit = product.price;
  let variant: Variant | null = null;
  if (product.variants.length) {
    variant = product.variants.find((v) => v.id === item.variantId) || product.variants[0];
    unit = variant.price;
  }
  const milk = item.milkId ? idx.addons.get(item.milkId) || null : null;
  if (milk) unit += milk.price;
  const addons = item.addonIds.map((id) => idx.addons.get(id)).filter(Boolean) as Addon[];
  for (const a of addons) unit += a.price;
  return { item, product, variant, milk, addons, unit, total: unit * item.quantity };
}

export const cartKey = (i: Omit<CartItem, 'key' | 'quantity'>) =>
  [i.productId, i.variantId ?? 0, i.milkId ?? 0, i.sugar ?? '-', [...i.addonIds].sort((a, b) => a - b).join(',')].join('|');

export function optionSummary(lang: Lang, line: PricedLine, tr: (k: string) => string) {
  const parts: string[] = [];
  if (line.variant) parts.push(line.variant.label);
  if (line.milk) parts.push(pick(lang, line.milk));
  if (line.item.sugar !== null && line.product.allowSugar) parts.push(`${tr('product.sugar')}: ${line.item.sugar}%`);
  for (const a of line.addons) parts.push(`+ ${pick(lang, a)}`);
  return parts.join(' · ');
}

export function useDefaultItem(menu: Menu, product: Product): Omit<CartItem, 'key'> {
  return {
    productId: product.id,
    variantId: product.variants[0]?.id ?? null,
    milkId: null,
    sugar: product.allowSugar ? 50 : null,
    addonIds: [],
    quantity: 1,
  };
}
