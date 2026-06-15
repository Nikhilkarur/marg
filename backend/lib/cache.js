// Tiny in-memory TTL cache. Public OSRM/Nominatim have no SLA and rate-limit
// aggressively; caching identical lookups keeps us well under their limits and
// makes repeated demo requests instant. Process-local only (resets on restart),
// which is fine for a single backend instance.

function createCache({ ttlMs = 5 * 60 * 1000, max = 500 } = {}) {
  const store = new Map() // key -> { value, expires }

  function get(key) {
    const hit = store.get(key)
    if (!hit) return undefined
    if (Date.now() > hit.expires) {
      store.delete(key)
      return undefined
    }
    // refresh LRU position
    store.delete(key)
    store.set(key, hit)
    return hit.value
  }

  function set(key, value, customTtl) {
    if (store.size >= max) {
      // evict oldest (first) entry
      const oldest = store.keys().next().value
      if (oldest !== undefined) store.delete(oldest)
    }
    store.set(key, { value, expires: Date.now() + (customTtl ?? ttlMs) })
    return value
  }

  return { get, set, get size() { return store.size }, clear: () => store.clear() }
}

module.exports = { createCache }
