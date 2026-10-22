// Visits saved on the phone while there is no signal, sent when the signal returns.
// The list lives in localStorage so it survives closing the app. Each visit carries a
// client_request_id, so if a send is repeated the server saves it only once.
const KEY = 'offlineCheckins.v1';
const listeners = new Set();

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_e) { return []; }
};
const write = (items) => {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (_e) { /* storage full or blocked */ }
  listeners.forEach((fn) => { try { fn(items); } catch (_e) { /* ignore */ } });
};

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** True when the failure is "no connection" or a server fault, so the visit should wait and try again. */
export const isNetworkError = (err) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!err) return false;
  if (err.statusCode === undefined || err.statusCode === null) return true; // fetch failed before any answer
  return err.statusCode >= 500 || err.statusCode === 408 || err.statusCode === 429;
};

export const getQueue = () => read();
export const subscribeQueue = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const queueCheckin = (payload) => {
  const id = newId();
  write([...read(), { id, payload: { ...payload, client_request_id: id }, queued_at: new Date().toISOString(), status: 'waiting', error: '' }]);
  return id;
};

export const removeQueued = (id) => write(read().filter((i) => i.id !== id));

let flushing = false;
/**
 * Send waiting visits in order. Stops at the first "no connection" failure (the rest stay waiting).
 * A visit the server refuses (for example the party location is not verified) is marked failed with
 * the server's message so the salesman can see why and remove it.
 * @returns {Promise<{sent:number, failed:number}>}
 */
export const flushQueue = async (send) => {
  if (flushing) return { sent: 0, failed: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    for (const item of read().filter((i) => i.status === 'waiting')) {
      try {
        await send(item.payload);
        write(read().filter((i) => i.id !== item.id));
        sent += 1;
      } catch (err) {
        if (isNetworkError(err)) break;
        write(read().map((i) => (i.id === item.id ? { ...i, status: 'failed', error: err.message || 'The server refused this visit' } : i)));
        failed += 1;
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, failed };
};
