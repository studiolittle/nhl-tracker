// In-memory cache for upstream NHL data. It lives in one server instance, so on Vercel it is lost on a cold start.
// Entries are capped (oldest-read goes first) so request-driven keys cannot grow memory without limit.
// A failed refresh is remembered briefly, so an outage does not send every request back to NHL.
export function createCache({ maxEntries = 1000, failureTtl = 15_000, now = Date.now } = {}) {
  const cache = new Map();
  const failures = new Map();
  const pending = new Map();
  const remember = (map, key, entry) => {
    map.delete(key); map.set(key, entry);
    while (map.size > maxEntries) map.delete(map.keys().next().value);
  };
  const fresh = entry => ({ ...entry.value, stale: false, fetchedAt: new Date(entry.time).toISOString() });
  return async function cached(key, loader, ttl = 300_000) {
    const old = cache.get(key);
    if (old && now() - old.time < ttl) { remember(cache, key, old); return fresh(old); }
    if (pending.has(key)) return pending.get(key);
    const failure = failures.get(key);
    if (failure && now() - failure.time < Math.min(failureTtl, ttl)) {
      if (old) return { ...fresh(old), stale: true };
      throw failure.error;
    }
    const request = (async () => {
      try {
        const value = await loader(); const time = now();
        failures.delete(key); remember(cache, key, { value, time });
        return { ...value, stale: false, fetchedAt: new Date(time).toISOString() };
      } catch (error) {
        remember(failures, key, { error, time: now() });
        if (old) return { ...fresh(old), stale: true };
        throw error;
      } finally { pending.delete(key); }
    })();
    pending.set(key, request);
    return request;
  };
}

// Shared CDN caching for API routes. The browser always revalidates; Vercel's edge may reuse a response for a few seconds.
export const edgeCache = seconds => `public, max-age=0, s-maxage=${seconds}`;
