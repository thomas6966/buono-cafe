import { useEffect } from 'react';

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`card my-6 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} p-6`}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-2xl font-bold">{title}</h3>
          <button className="text-xl text-muted hover:text-cream" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2.5 text-sm font-semibold">
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-ok' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}

export function PageTitle({ children, right }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-[32px] font-bold">{children}</h1>
      <div className="flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}

export const TAG_LABEL = { vegetarian: '🌱 Vegetarian', chef: '👨‍🍳 Shef tavsiyasi', bestseller: '🔥 Best seller' };
