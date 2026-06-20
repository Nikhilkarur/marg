// Crowd-sourced unsafe-spot reports. Stored locally and merged into the crime
// heatmap so a user's own reports immediately shape their Women-Safety view.
// (Shape matches heatmapZones so the map + scoring treat them like any zone.)

const KEY = 'marg_user_reports'

export function loadReports() {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

const SEVERITY = {
  high: { risk_level: 'high', risk_score: 80, radius_m: 350 },
  medium: { risk_level: 'medium', risk_score: 60, radius_m: 300 },
}

export function addReport({ lat, lng, severity = 'medium', note = '' }) {
  const s = SEVERITY[severity] || SEVERITY.medium
  const report = {
    id: `r_${Date.now()}`,
    area_name: note?.trim() ? note.trim() : 'Reported unsafe spot',
    latitude: lat,
    longitude: lng,
    ...s,
    active_hours: 'all',
    source: 'You reported',
    user_reported: true,
    createdAt: Date.now(),
  }
  const all = [report, ...loadReports()].slice(0, 100)
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch {}
  return all
}

export function removeReport(id) {
  const all = loadReports().filter((r) => r.id !== id)
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch {}
  return all
}

/** Merge user reports into a list of heatmap zones (reports first so they win). */
export function withReports(zones = []) {
  return [...loadReports(), ...zones]
}
