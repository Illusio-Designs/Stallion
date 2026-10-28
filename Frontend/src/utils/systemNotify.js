// Phone/computer notifications (the system kind) for new in-app notifications.
// Permission can only be asked from a tap, so the prompt component calls askPermission().
const KEY_SNOOZE = 'stl-notify-snooze-until';
const KEY_SEEN = 'stl-notify-seen';

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const notifyPermission = () => (notifySupported() ? Notification.permission : 'unsupported');

export const isInstalledApp = () =>
  typeof window !== 'undefined' &&
  ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true);

export const shouldAskPermission = () => {
  if (!notifySupported() || Notification.permission !== 'default') return false;
  try {
    const until = Number(localStorage.getItem(KEY_SNOOZE) || 0);
    if (until && Date.now() < until) return false;
  } catch (_e) { /* storage blocked: ask anyway */ }
  return true;
};

export const snoozeAsking = (days = 7) => {
  try { localStorage.setItem(KEY_SNOOZE, String(Date.now() + days * 86400000)); } catch (_e) { /* ignore */ }
};

export const askPermission = async () => {
  if (!notifySupported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch (_e) { return Notification.permission; }
};

const readSeen = () => {
  try { return JSON.parse(localStorage.getItem(KEY_SEEN) || '[]'); } catch (_e) { return []; }
};
const writeSeen = (ids) => {
  try { localStorage.setItem(KEY_SEEN, JSON.stringify(ids.slice(-100))); } catch (_e) { /* ignore */ }
};

const show = async (title, body, tag) => {
  const opts = { body, tag, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: '/dashboard' } };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) { await reg.showNotification(title, opts); return; }
  } catch (_e) { /* fall through to the page notification */ }
  try { new Notification(title, opts); } catch (_e) { /* not allowed here */ }
};

// Call with the latest list on every refresh. The first call only records what already exists,
// so opening the app never floods the phone with old items.
export const announceNew = (notes) => {
  if (!notifySupported() || Notification.permission !== 'granted' || !Array.isArray(notes)) return;
  const seen = readSeen();
  const first = seen.length === 0;
  const fresh = notes.filter((n) => !n.read_at && !seen.includes(n.notification_id));
  if (!fresh.length) return;
  writeSeen([...seen, ...fresh.map((n) => n.notification_id)]);
  if (first || document.visibilityState === 'visible') return;
  fresh.slice(0, 3).forEach((n) => show(n.title || 'Stallion', n.message || n.body || '', String(n.notification_id)));
};
