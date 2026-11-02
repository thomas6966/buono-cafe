import { motion } from 'framer-motion';
import { useT } from '../lib/i18n';
import { haptic } from '../lib/tg';
import { pick, pickDesc, money } from '../lib/util';
import { useStore } from '../store';
import type { Product } from '../types';
import { HeartButton, Img, TAG_EMOJI } from './ui';

export function ProductCard({
  product,
  icon,
  onOpen,
  onQuickAdd,
}: {
  product: Product;
  icon: string;
  onOpen: () => void;
  onQuickAdd: () => void;
}) {
  const { t, lang } = useT();
  const fav = useStore((s) => s.favoriteIds.includes(product.id));
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const hasChoice = product.variants.length > 1 || product.allowMilk;
  const desc = pickDesc(lang, product);

  return (
    <motion.article
      layout="position"
      whileTap={{ scale: 0.975 }}
      onClick={onOpen}
      className="flex flex-col overflow-hidden rounded-[22px] border border-line bg-surface"
    >
      <div className="relative aspect-[4/3] overflow-hidden skeleton">
        <Img src={product.imageUrl} alt={pick(lang, product)} fallback={icon} className="h-full w-full object-cover" />
        <div className="absolute left-2 top-2 flex gap-1">
          {product.tags.map((tag) => (
            <span key={tag} title={t(`tag.${tag}`)} className="glass grid h-7 w-7 place-items-center rounded-full text-[13px]">
              {TAG_EMOJI[tag]}
            </span>
          ))}
        </div>
        <div className="absolute right-2 top-2">
          <HeartButton active={fav} size={32} onClick={() => { haptic.select(); toggleFavorite(product.id); }} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-[14px] font-bold leading-tight">{pick(lang, product)}</h3>
        {desc && <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-muted">{desc}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <div className="leading-tight">
            {product.variants.length > 1 && <span className="mr-1 text-[10px] font-semibold uppercase text-muted">{t('price.from')}</span>}
            <span className="text-[15px] font-extrabold text-gold">{money(product.price)}</span>
            <span className="ml-1 text-[10px] text-muted">{t('unit.sum')}</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.8 }}
            aria-label="add"
            onClick={(e) => {
              e.stopPropagation();
              haptic.tap();
              if (hasChoice) onOpen();
              else onQuickAdd();
            }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-xl font-bold leading-none text-[#1b110c] shadow-[0_6px_16px_-6px_rgba(201,139,110,0.9)]"
          >
            +
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
