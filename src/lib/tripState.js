// Persist the active trip across refreshes. React Router's location.state is
// lost on a hard refresh, which silently reverted /results and /map to the
// Anna Nagar→T.Nagar default (TASK 4 #22). We mirror the trip into
// sessionStorage so a refresh restores the real origin/destination/route.

const KEY = 'marg_trip_state'

export function saveTripState(next) {
  try {
    const cur = loadTripState() || {}
    sessionStorage.setItem(KEY, JSON.stringify({ ...cur, ...next }))
  } catch {
    /* storage unavailable (private mode) — fall back to in-memory state only */
  }
}

export function loadTripState() {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearTripState() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

// --- Recent trips (Home quick-launch) -------------------------------------
const RECENT_KEY = 'marg_recent_trips'

export function loadRecentTrips() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveRecentTrip(origin, destination) {
  if (!origin?.name || !destination?.name) return
  try {
    const key = `${origin.name}|${destination.name}`
    const list = loadRecentTrips().filter((t) => `${t.origin?.name}|${t.destination?.name}` !== key)
    localStorage.setItem(RECENT_KEY, JSON.stringify([{ origin, destination }, ...list].slice(0, 4)))
  } catch {
    /* ignore */
  }
}
