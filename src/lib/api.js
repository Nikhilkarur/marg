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
export async function fetchRoutes(origin, destination, safeMode, mode = null, departMin = null) {
  const res = await fetch(`${BASE}/api/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_lat: origin.lat,
      from_lng: origin.lng,
      to_lat: destination.lat,
      to_lng: destination.lng,
      safe_mode: safeMode,
      mode,
      // Don't send the browser's local hour — the backend uses Chennai (IST)
      // time so results are correct for judges in any timezone. Only send an
      // explicit departure when the user scheduled one.
      ...(Number.isFinite(departMin) ? { depart_min: departMin } : {}),
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

/**
 * Snap a planned route's polyline to the road network so the line drawn on the
 * map follows real streets instead of straight chords between transit stations.
 * We feed the leg endpoints (origin → board → alight → … → destination) to OSRM
 * as ordered waypoints and use the returned road geometry. Cached by waypoint
 * signature; falls back to the route's raw coordinates if OSRM is unreachable.
 */
const snapCache = new Map()
export async function snapRouteToRoads(route) {
  const raw = route?.coordinates?.length ? route.coordinates : null
  if (!route?.steps?.length) return raw

  // Ordered leg endpoints, de-duplicating points that coincide.
  const pts = []
  const near = (a, b) => a && b && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6
  for (const s of route.steps) {
    const c = s.coordinates
    if (!c?.length) continue
    const a = c[0]
    const b = c[c.length - 1]
    if (!near(pts[pts.length - 1], a)) pts.push(a)
    if (!near(pts[pts.length - 1], b)) pts.push(b)
  }
  if (pts.length < 2) return raw

  const sig = pts.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(';')
  if (snapCache.has(sig)) return snapCache.get(sig)

  try {
    const coordStr = pts.map((p) => `${p[0]},${p[1]}`).join(';')
    const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?geometries=geojson&overview=full`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`snap ${res.status}`)
    const data = await res.json()
    const line = data.routes?.[0]?.geometry?.coordinates
    if (line?.length) {
      snapCache.set(sig, line)
      return line
    }
  } catch {
    /* fall through to raw coords */
  }
  return raw
}

// --- Safe-havens (live OpenStreetMap data, no API key) ---------------------
// Real police stations, hospitals and 24×7 pharmacies near a point, via the free
// Overpass API. Replaces the hardcoded list so the overlay reflects whatever city
// area the user is actually in. Cached by rounded centre; the caller falls back to
// the curated seed list if this returns nothing (Overpass down/rate-limited).
const havenCache = new Map()
const OVERPASS = 'https://overpass-api.de/api/interpreter'

export async function fetchSafeHavens(center, radiusM = 4000) {
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return null
  const key = `${center.lat.toFixed(2)},${center.lng.toFixed(2)},${radiusM}`
  if (havenCache.has(key)) return havenCache.get(key)

  const { lat, lng } = center
  const q = `[out:json][timeout:20];(` +
    `node["amenity"="police"](around:${radiusM},${lat},${lng});` +
    `node["amenity"="hospital"](around:${radiusM},${lat},${lng});` +
    `node["amenity"="pharmacy"]["opening_hours"="24/7"](around:${radiusM},${lat},${lng});` +
    `);out body 80;`
  try {
    const res = await fetch(OVERPASS, { method: 'POST', body: q })
    if (!res.ok) throw new Error(`overpass ${res.status}`)
    const data = await res.json()
    const seen = new Set()
    const caps = { police: 12, hospital: 12, pharmacy: 10 }
    const counts = { police: 0, hospital: 0, pharmacy: 0 }
    const havens = []
    for (const el of data.elements || []) {
      const type = el.tags?.amenity
      if (!caps[type] || counts[type] >= caps[type]) continue
      const name = el.tags?.name
      if (!name || !Number.isFinite(el.lat) || !Number.isFinite(el.lon)) continue
      const dedupe = `${type}:${name}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      counts[type] += 1
      havens.push({ name, type, lat: el.lat, lng: el.lon })
    }
    if (!havens.length) return null
    havenCache.set(key, havens)
    return havens
  } catch {
    return null
  }
}

// --- Safe-Walk last-mile (P3) ---------------------------------------------
// For a walking leg, ask OSRM for *alternative* paths and pick the one that
// spends the least time inside known crime zones. This ports the wsf/safenav.py
// idea (penalise routes by nearby crime) onto our own zones + free OSRM. The
// fastest path is kept as a baseline so the UI can show "rerouted around N zones".

const R_EARTH_M = 6371000
function metersBetween(aLat, aLng, bLat, bLng) {
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const lat1 = (aLat * Math.PI) / 180
  const lat2 = (bLat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Crime exposure of a [lng,lat][] line against zones. Each sampled point inside a
// zone adds risk_score scaled by how deep it sits (centre = full, edge = 0).
// Returns { score, zones:Set<area_name> } — lower score is safer.
function exposureOf(line, zones) {
  let score = 0
  const hit = new Set()
  if (!line?.length) return { score, zones: hit }
  // Sample ~every 6th point to keep it cheap on long geometries.
  const stride = Math.max(1, Math.floor(line.length / 120))
  for (let i = 0; i < line.length; i += stride) {
    const [lng, lat] = line[i]
    for (const z of zones) {
      const d = metersBetween(lat, lng, z.latitude, z.longitude)
      if (d < z.radius_m) {
        score += (z.risk_score || 50) * (1 - d / z.radius_m)
        hit.add(z.area_name)
      }
    }
  }
  return { score, zones: hit }
}

const safeWalkCache = new Map()
/**
 * Pick the safest walking path between two points given crime zones.
 * Returns { coordinates:[lng,lat][], avoided:string[], rerouted:boolean,
 * exposure:number } or null on failure (caller falls back to the straight leg).
 */
export async function safeWalkRoute(origin, destination, zones = []) {
  if (!origin || !destination) return null
  const sig = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)};${destination.lat.toFixed(4)},${destination.lng.toFixed(4)};z${zones.length}`
  if (safeWalkCache.has(sig)) return safeWalkCache.get(sig)
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?alternatives=true&geometries=geojson&overview=full`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`safewalk ${res.status}`)
    const data = await res.json()
    const routes = data.routes || []
    if (!routes.length) throw new Error('no routes')

    const scored = routes.map((r) => {
      const line = r.geometry?.coordinates || []
      const exp = exposureOf(line, zones)
      return { line, ...exp }
    })
    const fastest = scored[0] // OSRM returns the fastest first
    const safest = scored.reduce((best, c) => (c.score < best.score ? c : best), scored[0])
    // Zones the fastest path crosses but the safest one avoids.
    const avoided = [...fastest.zones].filter((z) => !safest.zones.has(z))
    const result = {
      coordinates: safest.line,
      avoided,
      rerouted: safest !== fastest && fastest.score - safest.score > 1,
      exposure: Math.round(safest.score),
    }
    safeWalkCache.set(sig, result)
    return result
  } catch {
    return null
  }
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
