// Live trip-tracking client. Pairs with backend/routes/track.js: the traveller's
// device pushes GPS fixes to the relay; a contact opens the share link to watch.

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'

export function newTrackId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function trackUrl(id) {
  return `${window.location.origin}/track/${id}`
}

async function pushFix(id, lat, lng, dest, ended = false) {
  try {
    await fetch(`${BASE}/api/track/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, dest, ended }),
    })
  } catch {
    /* best-effort: a dropped fix just means the viewer sees a slightly older one */
  }
}

/**
 * Begin pushing this device's location to the relay every ~5s.
 * Returns a stop() that sends a final "ended" ping and clears the watch.
 */
export function startTracking(id, dest = null) {
  if (!navigator.geolocation) return () => {}
  let last = null
  const onPos = (pos) => {
    last = { lat: pos.coords.latitude, lng: pos.coords.longitude }
    pushFix(id, last.lat, last.lng, dest)
  }
  // One immediate fix, then a continuous watch (throttled by the relay cadence).
  navigator.geolocation.getCurrentPosition(onPos, () => {}, { enableHighAccuracy: true, timeout: 8000 })
  const watchId = navigator.geolocation.watchPosition(onPos, () => {}, { enableHighAccuracy: true, maximumAge: 4000 })
  const interval = setInterval(() => { if (last) pushFix(id, last.lat, last.lng, dest) }, 5000)
  return () => {
    clearInterval(interval)
    navigator.geolocation.clearWatch(watchId)
    if (last) pushFix(id, last.lat, last.lng, dest, true)
  }
}

export async function fetchTrack(id) {
  try {
    const res = await fetch(`${BASE}/api/track/${id}`)
    if (!res.ok) return { active: false, notFound: res.status === 404 }
    return res.json()
  } catch {
    return { active: false, error: true }
  }
}
