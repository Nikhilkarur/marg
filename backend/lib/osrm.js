// OSRM client for first/last-mile auto & walk legs.
//
// Uses the free public OSRM demo server (no key). IMPORTANT: that server only
// ships the *car* profile — its /walking/ endpoint returns car speeds — so we
// always fetch the driving route for real road geometry + distance, then derive
// the walk duration ourselves at a human pace. Hardening over the old inline
// version: an identifying User-Agent, in-memory caching, ONE retry before
// giving up, and an `estimated` flag so a magic-constant fallback is never
// presented as a real road measurement.

const axios = require('axios')
const { createCache } = require('./cache')

const cache = createCache({ ttlMs: 10 * 60 * 1000, max: 800 })
const UA = 'Marg/1.0 (Chennai transit planner; contact: marg.app)'
const WALK_KMH = 5
const round5 = (n) => Math.round(n * 1e5) / 1e5

// Raw driving route (geometry + road distance + car duration), cached.
async function osrmDriving(fromLng, fromLat, toLng, toLat) {
  const key = `${round5(fromLng)},${round5(fromLat)};${round5(toLng)},${round5(toLat)}`
  const cached = cache.get(key)
  if (cached) return cached

  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await axios.get(url, {
        params: { geometries: 'geojson', overview: 'full' },
        timeout: 12000,
        headers: { 'User-Agent': UA },
      })
      const route = res.data?.routes?.[0]
      if (!route) return null
      const value = {
        distance_m: Math.round(route.distance),
        drive_min: Math.max(1, Math.round(route.duration / 60)),
        coordinates: route.geometry.coordinates, // GeoJSON [lng,lat]
      }
      return cache.set(key, value)
    } catch (err) {
      const status = err.response?.status
      if (attempt === 0 && status !== 400) {
        await new Promise((r) => setTimeout(r, 400)) // one transient retry
        continue
      }
      console.error('[OSRM]', err.response?.data?.message || err.message)
      return null
    }
  }
  return null
}

const haversineM = (aLat, aLng, bLat, bLng) => {
  const R = 6371000
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/**
 * Auto or walk leg with a guaranteed result.
 * @param mode 'walk' | 'auto'
 * Tries OSRM (driving network) for real distance + geometry. Auto uses the OSRM
 * duration; walk recomputes duration at ~5 km/h. On OSRM failure, falls back to
 * a straight-line estimate flagged `estimated:true` instead of a magic constant
 * (TASK 4 #12, #14).
 */
async function legOrEstimate(fromLng, fromLat, toLng, toLat, mode = 'auto') {
  const real = await osrmDriving(fromLng, fromLat, toLng, toLat)
  if (real) {
    const duration_min =
      mode === 'walk'
        ? Math.max(1, Math.round((real.distance_m / 1000 / WALK_KMH) * 60))
        : real.drive_min
    return { distance_m: real.distance_m, duration_min, coordinates: real.coordinates, estimated: false }
  }

  const straight = haversineM(fromLat, fromLng, toLat, toLng)
  const distance_m = Math.round(straight * 1.3) // road ≈ 1.3× crow-flight
  const kmh = mode === 'walk' ? WALK_KMH : 20
  const duration_min = Math.max(1, Math.round((distance_m / 1000 / kmh) * 60))
  return {
    distance_m,
    duration_min,
    coordinates: [
      [fromLng, fromLat],
      [toLng, toLat],
    ],
    estimated: true,
  }
}

module.exports = { osrmDriving, legOrEstimate, haversineM }
