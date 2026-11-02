import WebApp from '@twa-dev/sdk';

export const tg = WebApp;
// Outside Telegram initData is empty: the app then runs in "browser dev mode".
export const inTelegram = Boolean(WebApp.initData);

const BG = '#17110e';

export function initTelegram() {
  const safe = (fn: () => void) => {
    try {
      fn();
    } catch {
      /* older Telegram clients lack some methods */
    }
  };
  safe(() => WebApp.ready());
  if (!inTelegram) return;
  safe(() => WebApp.expand());
  safe(() => WebApp.setHeaderColor(BG));
  safe(() => WebApp.setBackgroundColor(BG));
  safe(() => WebApp.setBottomBarColor(BG));
  safe(() => WebApp.disableVerticalSwipes());
}

const hf = () => (inTelegram ? WebApp.HapticFeedback : null);
export const haptic = {
  tap: () => { try { hf()?.impactOccurred('light'); } catch { /* noop */ } },
  select: () => { try { hf()?.selectionChanged(); } catch { /* noop */ } },
  success: () => { try { hf()?.notificationOccurred('success'); } catch { /* noop */ } },
  error: () => { try { hf()?.notificationOccurred('error'); } catch { /* noop */ } },
};

export const tgUser = () => WebApp.initDataUnsafe?.user;

// ---- Telegram BackButton shared by every open sheet (top of the stack wins) ----
const stack: (() => void)[] = [];
const onBack = () => stack[stack.length - 1]?.();
let bound = false;

export function pushBack(handler: () => void) {
  if (!inTelegram) return () => {};
  try {
    if (!bound) {
      WebApp.BackButton.onClick(onBack);
      bound = true;
    }
    stack.push(handler);
    WebApp.BackButton.show();
  } catch {
    /* noop */
  }
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
    try {
      if (!stack.length) WebApp.BackButton.hide();
    } catch {
      /* noop */
    }
  };
}

export function openLink(url: string) {
  try {
    if (inTelegram) WebApp.openLink(url);
    else window.open(url, '_blank');
  } catch {
    window.open(url, '_blank');
  }
}
