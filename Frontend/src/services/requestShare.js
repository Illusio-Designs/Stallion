/**
 * Request sharing helpers (pure, no browser or React dependency).
 *
 * shareRequest(key, fetcher, ttlMs)
 *   Several components often ask for the same list at the same moment (for example the
 *   dashboard asks for the party list twice). While a request for `key` is running, every
 *   caller gets that one request instead of starting its own. When `ttlMs` is above 0 the
 *   answer is also kept in memory for that long, so a second page that opens a moment later
 *   reuses it. Each caller gets its own copy of an array, so one caller sorting or pushing
 *   into its list never changes what another caller sees.
 *
 * invalidateShared(prefix)
 *   Forget kept answers (and stop sharing running requests) whose key starts with `prefix`.
 *   Called after every write and on logout, so nobody is shown a list that is older than
 *   the last change.
 *
 * mapLimit(items, limit, fn)
 *   Like Promise.all(items.map(fn)) but with at most `limit` calls running at once, results
 *   in the same order as `items`. After the first failure no new call is started.
 */

const running = new Map(); // key -> Promise of the answer
const kept = new Map(); // key -> { value, expiresAt }
let epoch = 0; // bumped by every invalidation, so an answer that was already on its way is not kept

const copyOf = (value) => (Array.isArray(value) ? value.slice() : value);
const isEmpty = (value) => value == null || (Array.isArray(value) && value.length === 0);
const matches = (key, prefix) => !prefix || key.startsWith(prefix);

export const shareRequest = (key, fetcher, ttlMs = 0) => {
  const hit = kept.get(key);
  if (hit) {
    if (hit.expiresAt > Date.now()) return Promise.resolve(copyOf(hit.value));
    kept.delete(key);
  }

  const shared = running.get(key);
  if (shared) return shared.then(copyOf);

  const startedAt = epoch;
  const promise = Promise.resolve().then(fetcher).then((value) => {
    // An empty answer is often a transient miss; it is cheap to ask again, so it is never kept.
    if (ttlMs > 0 && startedAt === epoch && !isEmpty(value)) {
      kept.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    return value;
  });
  running.set(key, promise);
  const release = () => { if (running.get(key) === promise) running.delete(key); };
  promise.then(release, release);
  return promise.then(copyOf);
};

export const invalidateShared = (prefix = '') => {
  epoch += 1;
  for (const key of [...kept.keys()]) if (matches(key, prefix)) kept.delete(key);
  for (const key of [...running.keys()]) if (matches(key, prefix)) running.delete(key);
};

export const mapLimit = async (items, limit, fn) => {
  const list = Array.from(items || []);
  const results = new Array(list.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < list.length) {
      const index = next;
      next += 1;
      try {
        results[index] = await fn(list[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  const workers = Math.max(1, Math.min(Number(limit) || 1, list.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
};
