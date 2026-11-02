import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useT } from '../lib/i18n';
import { haptic } from '../lib/tg';
import { pick, pickDesc, useDefaultItem } from '../lib/util';
import { useStore } from '../store';
import type { Product, Tag } from '../types';
import { ProductCard } from './ProductCard';
import { ProductModal } from './ProductModal';
import { Chip, Logo, TAG_EMOJI } from './ui';

const TAGS: Tag[] = ['vegetarian', 'chef', 'bestseller'];

export function LangSwitch() {
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  return (
    <div className="flex rounded-full border border-line bg-surface p-0.5 text-[12px] font-extrabold">
      {(['uz', 'ru'] as const).map((l) => (
        <button
          key={l}
          onClick={() => { haptic.select(); setLang(l); }}
          className={`rounded-full px-3 py-1.5 transition-colors ${lang === l ? 'bg-accent text-[#1b110c]' : 'text-muted'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ size = 38 }: { size?: number }) {
  const user = useStore((s) => s.user)!;
  const [failed, setFailed] = useState(false);
  return user.photoUrl && !failed ? (
    <img src={user.photoUrl} alt="" onError={() => setFailed(true)} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="grid place-items-center rounded-full bg-accent/20 font-bold text-accent" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {user.firstName.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function MenuTab() {
  const { t, lang } = useT();
  const menu = useStore((s) => s.menu)!;
  const user = useStore((s) => s.user)!;
  const addToCart = useStore((s) => s.addToCart);
  const showToast = useStore((s) => s.showToast);
  const setTab = useStore((s) => s.setTab);

  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Tag[]>([]);
  const [active, setActive] = useState(menu.categories[0]?.slug ?? '');
  const [open, setOpen] = useState<{ product: Product; slug: string; icon: string } | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const lockUntil = useRef(0);

  const filtering = q.trim().length > 0 || filters.length > 0;

  const results = useMemo(() => {
    if (!filtering) return [];
    const needle = q.trim().toLowerCase();
    const out: { product: Product; slug: string; icon: string }[] = [];
    for (const c of menu.categories) {
      for (const p of c.products) {
        if (filters.some((f) => !p.tags.includes(f))) continue;
        if (needle && !`${p.nameUz} ${p.nameRu} ${p.descUz} ${p.descRu}`.toLowerCase().includes(needle)) continue;
        out.push({ product: p, slug: c.slug, icon: c.icon });
      }
    }
    return out;
  }, [menu, q, filters, filtering]);

  // scroll-spy: highlight the category whose section is under the sticky header
  useEffect(() => {
    if (filtering) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (Date.now() < lockUntil.current) return;
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive((hit.target as HTMLElement).dataset.slug || '');
      },
      { rootMargin: '-190px 0px -65% 0px' },
    );
    document.querySelectorAll('[data-slug]').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [menu, filtering]);

  // keep the active tab centred in the horizontal strip
  useEffect(() => {
    const strip = tabsRef.current;
    const el = strip?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (strip && el) strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [active]);

  const goTo = (slug: string) => {
    haptic.select();
    setActive(slug);
    lockUntil.current = Date.now() + 900;
    document.getElementById(`cat-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const quickAdd = useCallback(
    (p: Product) => {
      addToCart(useDefaultItem(menu, p));
      haptic.success();
      showToast(`✓ ${pick(lang, p)}`);
    },
    [menu, lang, addToCart, showToast],
  );

  const closeModal = useCallback(() => setOpen(null), []);

  const grid = (items: { product: Product; slug: string; icon: string }[]) => (
    <div className="grid grid-cols-2 gap-3">
      {items.map(({ product, slug, icon }) => (
        <ProductCard
          key={product.id}
          product={product}
          icon={icon}
          onOpen={() => setOpen({ product, slug, icon })}
          onQuickAdd={() => quickAdd(product)}
        />
      ))}
    </div>
  );

  return (
    <div>
      <div className="safe-top px-4 pt-3">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[19px] font-bold leading-tight">{t('home.hello', { name: user.firstName })}</p>
            <p className="truncate text-[12.5px] text-muted">{t('home.sub')}</p>
          </div>
          <LangSwitch />
          <button onClick={() => setTab('profile')} aria-label="profile"><Avatar /></button>
        </div>
      </div>

      <div className="glass sticky top-0 z-30 mt-3 rounded-b-3xl border-x-0 border-t-0 px-4 pb-2.5 pt-2.5">
        <div className="relative">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input className="field !rounded-full !py-2.5 !pl-10 !pr-10" placeholder={t('home.search')} value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
          {q && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" onClick={() => setQ('')} aria-label="clear">✕</button>
          )}
        </div>
        <div className="-mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4">
          {TAGS.map((tag) => (
            <Chip key={tag} active={filters.includes(tag)} onClick={() => { haptic.select(); setFilters(filters.includes(tag) ? filters.filter((f) => f !== tag) : [...filters, tag]); }}>
              {TAG_EMOJI[tag]} {t(`tag.${tag}`)}
            </Chip>
          ))}
        </div>
        {!filtering && (
          <div ref={tabsRef} className="-mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4">
            {menu.categories.map((c) => (
              <button
                key={c.slug}
                data-tab={c.slug}
                onClick={() => goTo(c.slug)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors ${active === c.slug ? 'bg-cream text-[#2a1b13]' : 'bg-surface-2 text-muted'}`}
              >
                <span>{c.icon}</span>
                {pick(lang, c)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-44 pt-4">
        {filtering ? (
          results.length ? (
            grid(results)
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center">
              <div className="text-5xl">🔎</div>
              <p className="mt-3 text-lg font-bold">{t('home.empty')}</p>
              <p className="mt-1 text-sm text-muted">{t('home.emptySub')}</p>
            </motion.div>
          )
        ) : (
          menu.categories.map((c) => (
            <section key={c.slug} id={`cat-${c.slug}`} data-slug={c.slug} className="mb-8 scroll-mt-[210px]">
              <h2 className="mb-3 flex items-center gap-2 font-display text-[22px] font-bold">
                <span>{c.icon}</span> {pick(lang, c)}
              </h2>
              {grid(c.products.map((p) => ({ product: p, slug: c.slug, icon: c.icon })))}
            </section>
          ))
        )}
      </div>

      <ProductModal menu={menu} product={open?.product ?? null} slug={open?.slug ?? ''} icon={open?.icon ?? '🍽️'} onClose={closeModal} />
    </div>
  );
}
