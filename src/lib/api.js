import { HEATMAP_ZONES } from '@/data/heatmapZones'
import { supabase } from '@/lib/supabase'

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'

/** Authorization header carrying the current Supabase session token, if any.
 *  The backend verifies this and uses the token's uid (never a body user_id). */
async function authHeaders() {
  try {
    if (!supabase) return {}
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

/** Quick reachability probe for the "backend unavailable" banner (TASK 4 #2). */
export async function checkBackend(timeoutMs = 4000) {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(`${BASE}/`, { signal: ctrl.signal })
    clearTimeout(t)
    return res.ok
  } catch {
    return false
  }
}

/** Fetch multi-modal routes from the backend. `mode` (optional) restricts to a
 *  single mode (metro/train/bus/auto) so the backend routes over only that. */
export async function fetchRoutes(origin, destination, safeMode, mode = null) {
  const res = await fetch(`${BASE}/api/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_lat: origin.lat,
      from_lng: origin.lng,
      to_lat: destination.lat,
      to_lng: destination.lng,
      safe_mode: safeMode,
      hour: new Date().getHours(),
      mode,
    }),
  })
  if (!res.ok) throw new Error(`routes ${res.status}`)
  return res.json()
}

/** Crime heatmap zones — backend first, local seed as fallback. */
export async function fetchHeatmap() {
  try {
    const res = await fetch(`${BASE}/api/safety/heatmap?city=chennai`)
    if (!res.ok) throw new Error()
    const data = await res.json()
    if (data.zones?.length) return data.zones
  } catch {
    /* fall through to local */
  }
  return HEATMAP_ZONES
}

/** Ask the AI assistant. Falls back to backend's offline reply automatically. */
export async function askAssistant(payload) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`chat ${res.status}`)
  return res.json()
}

/** Trigger an SOS alert via the backend (sends the session token). */
export async function triggerSos(payload) {
  const res = await fetch(`${BASE}/api/sos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(payload),
  })
  return res.json()
}

/** Save a trip for the signed-in user (no-op for demo users without a token). */
export async function saveTrip(payload) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  if (!headers.Authorization) return { saved: false, reason: 'not-authenticated' }
  const res = await fetch(`${BASE}/api/trips`, { method: 'POST', headers, body: JSON.stringify(payload) })
  return res.json()
}

/** Recent trips for the signed-in user. Returns [] when not authenticated. */
export async function fetchTrips() {
  const headers = await authHeaders()
  if (!headers.Authorization) return []
  try {
    const res = await fetch(`${BASE}/api/trips`, { headers })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

/**
 * Road-following polyline between two points via the free OSRM service.
 * Returns GeoJSON coordinates ([lng, lat]). Lets the map draw a real route
 * even when the backend is offline.
 */
export async function fetchDirections(origin, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?geometries=geojson&overview=full`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`directions ${res.status}`)
  const data = await res.json()
  return data.routes?.[0]?.geometry?.coordinates || null
}

// --- Geocoding (free OSM Nominatim, Chennai-biased) ------------------------
// Hardening (TASK 4 #4): in-memory cache, ≥1 req/s throttle, an identifying
// `email` param (browsers can't set a custom User-Agent), AbortController
// cancellation, and graceful 429 handling. Self-host Nominatim for production.
const NOMINATIM_EMAIL = 'hello@marg.app' // replace with a real contact for prod
const geoCache = new Map()
let lastGeocodeAt = 0

export async function geocode(query, { signal } = {}) {
  const q = query?.trim()
  if (!q) return []
  const key = q.toLowerCase()
  if (geoCache.has(key)) return geoCache.get(key)

  // Respect Nominatim's ≤1 req/s policy.
  const since = Date.now() - lastGeocodeAt
  if (since < 1100) await new Promise((r) => setTimeout(r, 1100 - since))
  lastGeocodeAt = Date.now()

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '5',
    countrycodes: 'in',
    viewbox: '79.7,13.4,80.6,12.7', // left,top,right,bottom around Chennai
    bounded: '1',
    email: NOMINATIM_EMAIL,
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (res.status === 429) return geoCache.get(key) || [] // backed off — don't hammer
  if (!res.ok) return []
  const data = await res.json()
  const results = data
    .map((d) => ({
      name: d.display_name,
      short: d.display_name.split(',')[0],
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng)) // drop NaN (TASK 4 #24)
  geoCache.set(key, results)
  return results
}
