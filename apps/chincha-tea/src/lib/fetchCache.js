/** In-memory TTL cache for Firestore REST reads (per browser tab). */
const store = new Map();

export function cachedFetch(key, fetcher, ttlMs = 5 * 60 * 1000) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return Promise.resolve(hit.data);
  return fetcher().then((data) => {
    store.set(key, { data, at: Date.now() });
    return data;
  });
}

/** Drop one key or all keys starting with `prefix`. */
export function invalidateCache(keyOrPrefix) {
  for (const k of [...store.keys()]) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) store.delete(k);
  }
}
