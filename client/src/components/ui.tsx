import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { pushBack } from '../lib/tg';
import { asset } from '../lib/api';
import { useStore } from '../store';

export function Logo({ size = 96 }: { size?: number }) {
  return (
    <div
      className="overflow-hidden rounded-full bg-cream shadow-[0_10px_40px_-8px_rgba(201,139,110,0.55)]"
      style={{ width: size, height: size }}
    >
      <img src="/logo.webp" alt="BUONO" className="h-full w-full select-none mix-blend-multiply" draggable={false} />
    </div>
  );
}

let locks = 0;
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    locks++;
    document.body.style.overflow = 'hidden';
    return () => {
      locks--;
      if (locks <= 0) document.body.style.overflow = '';
    };
  }, [active]);
}

export function Sheet({
  open,
  onClose,
  children,
  z = 50,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  z?: number;
}) {
  const controls = useDragControls();
  useScrollLock(open);
  useEffect(() => (open ? pushBack(onClose) : undefined), [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0" style={{ zIndex: z }} initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border-t border-line bg-surface"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 340 }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 700) onClose();
            }}
          >
            <div className="flex shrink-0 cursor-grab justify-center py-2.5 touch-none" onPointerDown={(e) => controls.start(e)}>
              <div className="h-1.5 w-11 rounded-full bg-white/15" />
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-surface-2 p-1">
      <button
        aria-label="minus"
        className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-lg font-bold leading-none text-cream active:scale-90 disabled:opacity-30"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span className="min-w-7 text-center text-[15px] font-bold tabular-nums">{value}</span>
      <button
        aria-label="plus"
        className="grid h-8 w-8 place-items-center rounded-full bg-accent text-lg font-bold leading-none text-[#1b110c] active:scale-90"
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  className = '',
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
        active ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-surface text-muted'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast}
          className="glass pointer-events-none fixed inset-x-0 top-[calc(var(--tg-content-safe-area-inset-top,0px)+16px)] z-[100] mx-auto w-fit max-w-[88%] rounded-full px-5 py-2.5 text-center text-sm font-semibold shadow-xl"
          initial={{ opacity: 0, y: -16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Img({ src, alt, fallback, className = '' }: { src: string | null; alt: string; fallback: string; className?: string }) {
  return src ? (
    <img
      src={asset(src) || undefined}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={className}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  ) : (
    <div className={`grid place-items-center text-5xl opacity-70 ${className}`}>{fallback}</div>
  );
}

export const TAG_EMOJI: Record<string, string> = { vegetarian: '🌱', chef: '👨‍🍳', bestseller: '🔥' };

export function HeartButton({ active, onClick, size = 36 }: { active: boolean; onClick: () => void; size?: number }) {
  return (
    <motion.button
      whileTap={{ scale: 0.8 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="glass grid place-items-center rounded-full"
      style={{ width: size, height: size }}
      aria-label="favorite"
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill={active ? '#ef8f84' : 'none'} stroke={active ? '#ef8f84' : '#f6ebdc'} strokeWidth="2" strokeLinejoin="round">
        <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2 0 3.5 1.1 4.4 2.6.9-1.5 2.4-2.6 4.4-2.6 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z" />
      </svg>
    </motion.button>
  );
}
