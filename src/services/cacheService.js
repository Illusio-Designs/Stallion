/**
 * Cache Service
 * Lightweight TTL cache to avoid re-fetching the same data on every page mount
 * and on full page reloads.
 *
 * Two layers:
 *  - In-memory Map: survives client-side navigation between dashboard tabs (fast).
 *  - sessionStorage: survives a full page reload (F5) within the same tab.
 *
 * sessionStorage writes are best-effort: large payloads that exceed the quota
 * fall back to in-memory only instead of throwing.
 */

const STORAGE_PREFIX = 'cache:';

// In-memory store: key -> { value, expiresAt }
const memory = new Map();

const now = () => Date.now();

const isFresh = (entry) => entry && (entry.expiresAt === 0 || entry.expiresAt > now());

/**
 * Read a cached entry (memory first, then sessionStorage). Returns the raw
 * { value, expiresAt } entry if fresh, otherwise null.
 */
const readEntry = (key) => {
  const memEntry = memory.get(key);
  if (isFresh(memEntry)) return memEntry;
  if (memEntry) memory.delete(key); // expired

  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (isFresh(entry)) {
      // Re-hydrate memory so subsequent reads stay fast
      memory.set(key, entry);
      return entry;
    }
    sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // Corrupt entry or storage unavailable - ignore
  }
  return null;
};

/**
 * Write an entry to both layers. sessionStorage write is best-effort.
 */
const writeEntry = (key, value, ttlMs) => {
  const expiresAt = ttlMs > 0 ? now() + ttlMs : 0;
  const entry = { value, expiresAt };
  memory.set(key, entry);

  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Quota exceeded or storage disabled - in-memory cache still applies.
  }
};

/**
 * Get a value from cache or run the fetcher and cache its result.
 *
 * @param {string} key - Unique cache key for this request
 * @param {() => Promise<any>} fetcher - Function that fetches fresh data
 * @param {number} ttlMs - Time-to-live in milliseconds (0 = no expiry)
 * @returns {Promise<any>}
 */
export const getCached = async (key, fetcher, ttlMs) => {
  const entry = readEntry(key);
  if (entry) return entry.value;

  const value = await fetcher();
  // Don't cache empty/missing results - they're often transient (a 404 or a
  // failed-but-swallowed call returning []). Caching them would hide real data
  // for the full TTL. Empty responses are cheap to re-fetch anyway.
  const isEmpty = value == null || (Array.isArray(value) && value.length === 0);
  if (!isEmpty) {
    writeEntry(key, value, ttlMs);
  }
  return value;
};

/**
 * Invalidate cache entries whose key starts with the given prefix.
 * Pass no argument to clear everything.
 *
 * @param {string} [prefix]
 */
export const invalidateCache = (prefix = '') => {
  // Memory
  for (const key of memory.keys()) {
    if (!prefix || key.startsWith(prefix)) memory.delete(key);
  }
  // sessionStorage
  if (typeof window === 'undefined') return;
  try {
    const toRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const storageKey = sessionStorage.key(i);
      if (!storageKey || !storageKey.startsWith(STORAGE_PREFIX)) continue;
      const cacheKey = storageKey.slice(STORAGE_PREFIX.length);
      if (!prefix || cacheKey.startsWith(prefix)) toRemove.push(storageKey);
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
};

/**
 * Clear the entire cache. Call on logout so a different user never sees
 * cached data from the previous session.
 */
export const clearCache = () => invalidateCache('');
