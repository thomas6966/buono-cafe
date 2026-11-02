import { useEffect, useMemo, useState } from 'react';
import { useT } from '../lib/i18n';
import { haptic } from '../lib/tg';
import { cartKey, money, pick, pickDesc, priceLine } from '../lib/util';
import { useStore } from '../store';
import type { Menu, Product } from '../types';
import { HeartButton, Img, Sheet, Stepper, TAG_EMOJI } from './ui';

const SUGAR_STEPS = [0, 25, 50, 75, 100];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h4 className="mb-2.5 text-[13px] font-bold uppercase tracking-wider text-muted">{title}</h4>
      {children}
    </div>
  );
}

export function ProductModal({
  menu,
  product,
  slug,
  icon,
  onClose,
}: {
  menu: Menu;
  product: Product | null;
  slug: string;
  icon: string;
  onClose: () => void;
}) {
  const { t, lang } = useT();
  const addToCart = useStore((s) => s.addToCart);
  const showToast = useStore((s) => s.showToast);
  const fav = useStore((s) => (product ? s.favoriteIds.includes(product.id) : false));
  const toggleFavorite = useStore((s) => s.toggleFavorite);

  const [variantId, setVariantId] = useState<number | null>(null);
  const [milkId, setMilkId] = useState<number | null>(null);
  const [sugar, setSugar] = useState(50);
  const [addonIds, setAddonIds] = useState<number[]>([]);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!product) return;
    setVariantId(product.variants[0]?.id ?? null);
    setMilkId(null);
    setSugar(50);
    setAddonIds([]);
    setQty(1);
  }, [product?.id]);

  const milks = useMemo(() => menu.addons.filter((a) => a.kind === 'MILK' && a.categorySlugs.includes(slug)), [menu, slug]);
  const extras = useMemo(() => menu.addons.filter((a) => a.kind === 'EXTRA' && a.categorySlugs.includes(slug)), [menu, slug]);

  const draft = product
    ? { productId: product.id, variantId, milkId, sugar: product.allowSugar ? sugar : null, addonIds, quantity: qty }
    : null;
  const priced = draft && product ? priceLine(menu, { ...draft, key: cartKey(draft) }) : null;

  const add = () => {
    if (!draft) return;
    haptic.success();
    addToCart(draft);
    showToast(`✓ ${t('product.added')}`);
    onClose();
  };

  const pill = (active: boolean) =>
    `rounded-2xl border px-3.5 py-2.5 text-[14px] font-semibold transition-colors ${
      active ? 'border-accent bg-accent/15 text-cream' : 'border-line bg-surface-2 text-muted'
    }`;

  return (
    <Sheet open={!!product} onClose={onClose}>
      {product && priced && (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="relative aspect-[16/11] bg-surface-2">
              <Img src={product.imageUrl} alt={pick(lang, product)} fallback={icon} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface to-transparent" />
              <div className="absolute right-3 top-3">
                <HeartButton active={fav} onClick={() => { haptic.select(); toggleFavorite(product.id); }} />
              </div>
            </div>

            <div className="px-5 pb-4">
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted">
                    {TAG_EMOJI[tag]} {t(`tag.${tag}`)}
                  </span>
                ))}
              </div>
              <h2 className="mt-2 font-display text-[26px] font-bold leading-tight">{pick(lang, product)}</h2>
              {pickDesc(lang, product) && <p className="mt-2 text-[14px] leading-relaxed text-muted">{pickDesc(lang, product)}</p>}

              {product.variants.length > 1 && (
                <Section title={t('product.size')}>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((v) => (
                      <button key={v.id} className={pill(variantId === v.id)} onClick={() => { haptic.select(); setVariantId(v.id); }}>
                        {v.label}
                        <span className="ml-2 text-[12px] text-gold">{money(v.price)}</span>
                      </button>
                    ))}
                  </div>
                </Section>
              )}

              {product.allowMilk && milks.length > 0 && (
                <Section title={t('product.milk')}>
                  <div className="flex flex-wrap gap-2">
                    <button className={pill(milkId === null)} onClick={() => { haptic.select(); setMilkId(null); }}>
                      {t('product.milkRegular')}
                    </button>
                    {milks.map((m) => (
                      <button key={m.id} className={pill(milkId === m.id)} onClick={() => { haptic.select(); setMilkId(m.id); }}>
                        {pick(lang, m)}
                        {m.price > 0 && <span className="ml-2 text-[12px] text-gold">+{money(m.price)}</span>}
                      </button>
                    ))}
                  </div>
                </Section>
              )}

              {product.allowSugar && (
                <Section title={`${t('product.sugar')} · ${sugar}%`}>
                  <input
                    type="range" min={0} max={100} step={25} value={sugar}
                    onChange={(e) => { setSugar(Number(e.target.value)); haptic.select(); }}
                    className="w-full"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-muted">
                    {SUGAR_STEPS.map((s) => (
                      <span key={s} className={s === sugar ? 'font-bold text-accent' : ''}>{t(`sugar.${s}`)}</span>
                    ))}
                  </div>
                </Section>
              )}

              {extras.length > 0 && (
                <Section title={t('product.extras')}>
                  <div className="flex flex-col gap-2">
                    {extras.map((a) => {
                      const on = addonIds.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          onClick={() => { haptic.select(); setAddonIds(on ? addonIds.filter((i) => i !== a.id) : [...addonIds, a.id]); }}
                          className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${on ? 'border-accent bg-accent/10' : 'border-line bg-surface-2'}`}
                        >
                          <span className="flex items-center gap-3 text-[14px] font-semibold">
                            <span className={`grid h-5 w-5 place-items-center rounded-md border text-[12px] ${on ? 'border-accent bg-accent text-[#1b110c]' : 'border-white/20'}`}>
                              {on && '✓'}
                            </span>
                            {pick(lang, a)}
                          </span>
                          <span className="text-[13px] font-bold text-gold">+{money(a.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                </Section>
              )}
            </div>
          </div>

          <div className="glass safe-bottom flex shrink-0 items-center gap-3 border-x-0 border-b-0 px-5 pt-3">
            <Stepper value={qty} min={1} onChange={setQty} />
            <button className="btn-primary flex flex-1 items-center justify-between gap-3 whitespace-nowrap !px-4" onClick={add}>
              <span>{t('product.add')}</span>
              <span>{money(priced.total)}</span>
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
