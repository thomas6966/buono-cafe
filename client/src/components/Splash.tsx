import { motion } from 'framer-motion';
import { useT } from '../lib/i18n';

// Branded loading animation: ring draws itself, logo pops in, wordmark fades up.
export function Splash({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const { t } = useT();
  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-bg"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.45 }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(201,139,110,0.22),transparent_62%)]" />
      <div className="relative grid h-[190px] w-[190px] place-items-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 190 190">
          <motion.circle
            cx="95" cy="95" r="90" fill="none" stroke="#c98b6e" strokeWidth="2" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0.2 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.3, ease: 'easeInOut' }}
          />
        </svg>
        <motion.div
          className="h-[162px] w-[162px] overflow-hidden rounded-full bg-cream shadow-[0_14px_50px_-8px_rgba(201,139,110,0.6)]"
          initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.15 }}
        >
          <img src="/logo.webp" alt="BUONO" className="h-full w-full mix-blend-multiply" draggable={false} />
        </motion.div>
      </div>

      <motion.p
        className="mt-9 font-display text-[15px] tracking-[0.28em] text-accent"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.6 }}
      >
        {t('app.tagline').toUpperCase()}
      </motion.p>

      {failed ? (
        <motion.div className="mt-8 flex flex-col items-center gap-4 px-8 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="text-sm text-muted">{t('app.loadError')}</p>
          <button className="btn-primary px-8" onClick={onRetry}>{t('app.retry')}</button>
        </motion.div>
      ) : (
        <motion.div className="mt-8 flex gap-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-accent"
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -4, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
