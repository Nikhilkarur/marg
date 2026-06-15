// Time-aware, CROSS-SYSTEM multi-modal journey planner for Chennai.
//
// Builds genuine door-to-door itineraries (access → wait → ride(s) → egress)
// with real clock times, routing over ONE unified transit graph that spans all
// lines — Metro (Blue/Green), Suburban Rail and MRTS — interchanging at shared
// stations (e.g. St Thomas Mount & Guindy connect Metro↔Suburban; Chennai Beach
// connects Suburban↔MRTS). So a trip like ICF→SRM can be:
//   auto → Green Line metro → (transfer at St Thomas Mount) → local train → walk.
// Respects each line's service hours, uses real OSRM durations, and is honest
// about whether a time/fare is published, representative, or estimated.

const {
  LINES,
  haversineM,
  nearestOnLine,
  nextDeparture,
  metroFareByHops,
  railFareByHops,
  autoFare,
  busFareByDistance,
} = require('../data/transit')
const { legOrEstimate } = require('./osrm')
const { hhmm, isNightIST } = require('./time')
const { SEED_ZONES } = require('../data/zones')

const MAX_SNAP_M = 6000 // allow a transit + auto last-mile combo for longer trips;
// the detour guard below still rejects cases where the station hop doesn't help (#11)
const WALK_MAX_M = 900 // access/egress ROAD distance within this → walk, else auto
const TRANSFER_BUFFER = 4 // min cushion when changing trains/lines
const SHORT_TRIP_M = 350 // origin≈destination → short hop only (#9)

// ---- access / egress (first & last mile) ----------------------------------
async function accessLeg(fromLng, fromLat, station, startMin, toDest = false, destName) {
  const leg = await legOrEstimate(fromLng, fromLat, station.lng, station.lat, 'auto')
  const walk = leg.distance_m <= WALK_MAX_M
  const mode = walk ? 'walk' : 'auto'
  const duration_min = walk ? Math.max(1, Math.round((leg.distance_m / 1000 / 5) * 60)) : leg.duration_min
  const arrive = startMin + duration_min
  return {
    step: {
      mode,
      icon: walk ? 'footprints' : 'car',
      label: toDest ? `${walk ? 'Walk' : 'Auto'} to ${destName || 'destination'}` : `${walk ? 'Walk' : 'Auto'} to ${station.name}`,
      distance_m: leg.distance_m,
      duration_min,
      wait_min: 0,
      fare: mode === 'auto' ? autoFare(leg.distance_m) : 0,
      depart_at: hhmm(startMin),
      arrive_at: hhmm(arrive),
      coordinates: leg.coordinates,
      estimated: leg.estimated || undefined,
      time_source: leg.estimated ? 'Straight-line estimate (OSRM down)' : 'OSRM road data',
      fare_source: mode === 'auto' ? 'Est. ₹30 + ₹15/km' : null,
    },
    arrive,
    distance_m: leg.distance_m,
  }
}

// ---- unified transit graph (ALL lines; interchange at shared station names) -
function buildTransitGraph() {
  const adj = new Map() // name -> [{ to, line, hop }]
  const add = (a, b, line) => {
    if (!adj.has(a)) adj.set(a, [])
    adj.get(a).push({ to: b, line, hop: line.hopMin })
  }
  for (const line of LINES) {
    for (let i = 1; i < line.stations.length; i++) {
      add(line.stations[i - 1].name, line.stations[i].name, line)
      add(line.stations[i].name, line.stations[i - 1].name, line)
    }
  }
  return adj
}
const GRAPH = buildTransitGraph()

// Nearest station to a point, restricted to lines of the allowed modes
// (allowed = null → any line). Dedup by name → min distance.
function nearestStationInModes(lat, lng, allowed) {
  let best = null
  for (const line of LINES) {
    if (allowed && !allowed.has(line.mode)) continue
    const n = nearestOnLine(line, lat, lng)
    if (!best || n.dist_m < best.dist_m) {
      best = { name: n.station.name, lat: n.station.lat, lng: n.station.lng, dist_m: n.dist_m }
    }
  }
  return best
}

// Per-change cost so the planner prefers FEWER, sensible transfers instead of
// zig-zagging metro↔train to shave a minute (which produced absurd 5-transfer
// routes). Modelled as added "minutes" in the cost function.
const TRANSFER_PENALTY = 8

// Least-cost path across the network = ride-minutes + TRANSFER_PENALTY × changes.
// State-augmented Dijkstra over (station, line) so a transfer is only charged
// when you actually switch lines. `allowed` restricts to certain modes (e.g.
// Metro-only or Train-only when the user filters by mode).
function transitSegments(boardName, alightName, allowed) {
  if (boardName === alightName) return null
  const startKey = `${boardName}|start`
  const dist = new Map([[startKey, 0]])
  const prev = new Map()
  const visited = new Set()
  const pq = [{ key: startKey, name: boardName, lineId: null, cost: 0 }]
  let end = null

  while (pq.length) {
    let mi = 0
    for (let i = 1; i < pq.length; i++) if (pq[i].cost < pq[mi].cost) mi = i
    const u = pq.splice(mi, 1)[0]
    if (visited.has(u.key)) continue
    visited.add(u.key)
    if (u.name === alightName && u.lineId !== null) {
      end = u
      break
    }
    for (const e of GRAPH.get(u.name) || []) {
      if (allowed && !allowed.has(e.line.mode)) continue
      const transfer = u.lineId && u.lineId !== e.line.id ? TRANSFER_PENALTY : 0
      const nc = u.cost + e.hop + transfer
      const vkey = `${e.to}|${e.line.id}`
      if (nc < (dist.get(vkey) ?? Infinity)) {
        dist.set(vkey, nc)
        prev.set(vkey, { pName: u.name, pLineId: u.lineId, line: e.line })
        pq.push({ key: vkey, name: e.to, lineId: e.line.id, cost: nc })
      }
    }
  }
  if (!end) return null

  // Reconstruct the edge list, then group consecutive same-line edges into legs.
  const edges = []
  let curKey = end.key
  let curName = end.name
  while (curKey !== startKey) {
    const p = prev.get(curKey)
    edges.unshift({ from: p.pName, to: curName, line: p.line })
    curName = p.pName
    curKey = `${p.pName}|${p.pLineId ?? 'start'}`
  }
  const segs = []
  for (const ed of edges) {
    const last = segs[segs.length - 1]
    if (last && last.line === ed.line) last.stations.push(ed.to)
    else segs.push({ line: ed.line, stations: [ed.from, ed.to] })
  }
  return segs
}

const round5 = (n) => Math.round(n * 1e5) / 1e5
const lineCoords = (line, fromIdx, toIdx) => {
  const step = fromIdx <= toIdx ? 1 : -1
  const out = []
  for (let i = fromIdx; i !== toIdx + step; i += step) out.push([line.stations[i].lat, line.stations[i].lng])
  return out.map(([lat, lng]) => [round5(lng), round5(lat)]) // GeoJSON [lng,lat]
}

const shortLineName = (line) => {
  if (line.mode === 'metro') return line.name.replace(' Line', '')
  if (line.id === 'mrts-velachery') return 'MRTS'
  return 'Local Train'
}

// ---- the unified transit itinerary ----------------------------------------
async function planTransit(fromLng, fromLat, toLng, toLat, departMin, hour, destName, allowed = null) {
  const board = nearestStationInModes(fromLat, fromLng, allowed)
  const alight = nearestStationInModes(toLat, toLng, allowed)
  if (!board || !alight) return null
  if (board.dist_m > MAX_SNAP_M || alight.dist_m > MAX_SNAP_M) return null // out of coverage (#11)
  if (board.name === alight.name) return null // board==alight (#13)

  const segs = transitSegments(board.name, alight.name, allowed)
  if (!segs || !segs.length) return null

  const directStraight = haversineM(fromLat, fromLng, toLat, toLng)
  if (board.dist_m + alight.dist_m > directStraight * 1.6 + 1500) return null // detour not worth it (#10)

  const steps = []
  const access = await accessLeg(fromLng, fromLat, { lat: board.lat, lng: board.lng, name: board.name }, departMin)
  steps.push(access.step)

  let cur = access.arrive
  for (let s = 0; s < segs.length; s++) {
    const { line } = segs[s]
    const fromIdx = line.stations.findIndex((x) => x.name === segs[s].stations[0])
    const toIdx = line.stations.findIndex((x) => x.name === segs[s].stations[segs[s].stations.length - 1])
    const transfer = s === 0 ? 0 : TRANSFER_BUFFER
    const dep = nextDeparture(line, hour, cur + transfer)
    if (!dep) return null // service ended for this leg
    const hops = Math.abs(toIdx - fromIdx)
    const ride = Math.max(2, Math.round(hops * line.hopMin))
    const arrive = dep.board + ride
    const isMetro = line.mode === 'metro'
    // Next few scheduled departures at the boarding stop (within service hours).
    const hw = dep.headway || 8
    const nextDeps = []
    for (let k = 0; k < 3; k++) {
      const b = dep.board + k * hw
      if (b <= line.service.last) nextDeps.push(hhmm(b))
    }
    steps.push({
      mode: line.mode,
      icon: isMetro ? 'train' : 'train-front',
      label: `${line.name} → ${line.stations[toIdx].name}`,
      line: line.name,
      board_stop: line.stations[fromIdx].name,
      alight_stop: line.stations[toIdx].name,
      distance_m: null,
      duration_min: ride,
      wait_min: dep.wait + transfer,
      fare: isMetro ? metroFareByHops(hops) : railFareByHops(hops),
      depart_at: hhmm(dep.board),
      arrive_at: hhmm(arrive),
      next_departures: nextDeps,
      coordinates: lineCoords(line, fromIdx, toIdx),
      schedule_basis: line.schedule_basis,
      time_source: isMetro ? 'CMRL published headway' : 'Representative timetable',
      fare_source: isMetro ? 'CMRL fare slab' : 'Est. local-train fare',
    })
    cur = arrive
  }

  const egress = await accessLeg(alight.lng, alight.lat, { lat: toLat, lng: toLng, name: destName }, cur, true, destName)
  steps.push(egress.step)

  const transitModes = [...new Set(segs.map((s) => s.line.mode))]
  const id = segs.length > 1 ? 'transit-multi' : transitModes[0] === 'metro' ? 'metro' : 'rail'
  const label = segs.map((s) => shortLineName(s.line)).join(' + ')
  return assembleRoute({ id, label, steps, departMin })
}

// ---- direct auto ----------------------------------------------------------
async function planAuto(fromLng, fromLat, toLng, toLat, departMin, destName) {
  const leg = await legOrEstimate(fromLng, fromLat, toLng, toLat, 'auto')
  const arrive = departMin + leg.duration_min
  const step = {
    mode: 'auto',
    icon: 'car',
    label: `Auto to ${destName || 'destination'}`,
    distance_m: leg.distance_m,
    duration_min: leg.duration_min,
    wait_min: 0,
    fare: autoFare(leg.distance_m),
    depart_at: hhmm(departMin),
    arrive_at: hhmm(arrive),
    coordinates: leg.coordinates,
    estimated: leg.estimated || undefined,
    time_source: leg.estimated ? 'Straight-line estimate (OSRM down)' : 'OSRM road data',
    fare_source: 'Est. ₹30 + ₹15/km',
  }
  return assembleRoute({ id: 'direct-auto', label: 'Direct Auto', steps: [step], departMin })
}

// ---- bus (frequency estimate, labelled) -----------------------------------
const BUS_MAX_M = 30000 // a single MTC bus for 40km isn't what people take; cap it.
async function planBus(fromLng, fromLat, toLng, toLat, departMin, hour, destName) {
  const drive = await legOrEstimate(fromLng, fromLat, toLng, toLat, 'auto')
  if (drive.distance_m > BUS_MAX_M) return null // beyond sensible single-bus range
  const walkIn = 3
  const headway = hour >= 7 && hour < 22 ? 8 : 18
  const wait = headway
  const ride = Math.max(8, Math.round(drive.duration_min * 1.6))
  const walkOut = 3
  let t = departMin
  const steps = []
  steps.push({ mode: 'walk', icon: 'footprints', label: 'Walk to nearest bus stop', distance_m: 250, duration_min: walkIn, wait_min: 0, fare: 0, depart_at: hhmm(t), arrive_at: hhmm(t + walkIn), estimated: true, time_source: 'Estimate' })
  t += walkIn
  const busDeps = [hhmm(t + wait), hhmm(t + wait + headway), hhmm(t + wait + 2 * headway)]
  steps.push({ mode: 'bus', icon: 'bus', label: 'MTC Bus (frequency estimate)', line: 'MTC Bus', board_stop: 'Nearest stop', alight_stop: 'Stop near destination', distance_m: drive.distance_m, duration_min: ride, wait_min: wait, fare: busFareByDistance(drive.distance_m), depart_at: hhmm(t + wait), arrive_at: hhmm(t + wait + ride), next_departures: busDeps, coordinates: drive.coordinates, estimated: true, time_source: 'Frequency estimate (no MTC GTFS)', fare_source: 'Est. MTC fare' })
  t += wait + ride
  steps.push({ mode: 'walk', icon: 'footprints', label: `Walk to ${destName || 'destination'}`, distance_m: 250, duration_min: walkOut, wait_min: 0, fare: 0, depart_at: hhmm(t), arrive_at: hhmm(t + walkOut), estimated: true, time_source: 'Estimate' })
  return assembleRoute({ id: 'bus', label: 'Bus + Walk', steps, departMin })
}

// ---- short walk (origin ≈ destination) ------------------------------------
async function planShortWalk(fromLng, fromLat, toLng, toLat, departMin, destName) {
  const leg = await legOrEstimate(fromLng, fromLat, toLng, toLat, 'walk')
  const arrive = departMin + leg.duration_min
  const step = {
    mode: 'walk',
    icon: 'footprints',
    label: `Walk to ${destName || 'destination'}`,
    distance_m: leg.distance_m,
    duration_min: leg.duration_min,
    wait_min: 0,
    fare: 0,
    depart_at: hhmm(departMin),
    arrive_at: hhmm(arrive),
    coordinates: leg.coordinates,
    estimated: leg.estimated || undefined,
    time_source: leg.estimated ? 'Straight-line estimate' : 'OSRM road data',
  }
  return assembleRoute({ id: 'walk', label: 'Walk', steps: [step], departMin })
}

// ---- assemble + score -----------------------------------------------------
function assembleRoute({ id, label, steps, departMin }) {
  const coordinates = steps.flatMap((s) => s.coordinates || [])
  const total_fare = steps.reduce((t, s) => t + (s.fare || 0), 0)
  const total_wait = steps.reduce((t, s) => t + (s.wait_min || 0), 0)
  const ride = steps.reduce((t, s) => t + (s.duration_min || 0), 0)
  const total_time = ride + total_wait
  const arriveMin = departMin + total_time
  const modes = [...new Set(steps.map((s) => s.mode))]
  const estimated = steps.some((s) => s.estimated)
  const representative = steps.some((s) => s.schedule_basis === 'representative')
  return {
    id,
    label,
    modes,
    transfers: Math.max(0, steps.length - 1),
    steps,
    coordinates,
    total_time,
    total_fare,
    depart_at: hhmm(departMin),
    arrive_at: hhmm(arriveMin),
    estimated,
    representative,
  }
}

// ---- crime-zone exposure (women-safety core) ------------------------------
// Crime zones that are "active" at this hour (night zones only count at night).
function activeZones(hour) {
  const night = isNightIST(hour)
  return SEED_ZONES.filter((z) => z.active_hours === 'all' || (z.active_hours === 'night' ? night : !night))
}

// Active zones whose area the path actually passes through (any coord within the
// zone radius + a small buffer).
function zonesNearPath(coords, zones) {
  const hits = []
  for (const z of zones) {
    const r = (z.radius_m || 500) + 150
    if ((coords || []).some((c) => haversineM(c[1], c[0], z.latitude, z.longitude) <= r)) hits.push(z)
  }
  return hits
}

// Annotate exposed walk/auto/bus legs with the crime zones they pass, and count
// route-level exposure (used by scoreRoute so Safe Mode pushes safer-PATH routes
// up — the honest version of "avoid red zones": re-rank + warn, since public
// OSRM can't geofence-reroute).
function annotateRisk(route, hour) {
  const zones = activeZones(hour)
  const seen = new Map()
  for (const s of route.steps) {
    if (s.mode === 'walk' || s.mode === 'auto' || s.mode === 'bus') {
      const hits = zonesNearPath(s.coordinates, zones)
      if (hits.length) {
        s.risk_zones = hits.map((z) => ({ name: z.area_name, risk_level: z.risk_level, risk_score: z.risk_score }))
        hits.forEach((z) => seen.set(z.area_name, z.risk_level))
      }
    }
  }
  route.risk_zone_count = seen.size
  route.high_risk = [...seen.values()].filter((l) => l === 'high').length
  return route
}

// Women-safety-tuned scoring (night derived from IST hour upstream).
function scoreRoute(route, hour) {
  const isLateNight = hour >= 21 || hour < 6
  const isEvening = hour >= 19 && hour < 21
  const m = route.modes
  let score = 80
  if (m.includes('metro')) score += 12
  if (m.includes('train')) score += 6
  if (isLateNight) {
    if (m.includes('metro')) score -= 8
    else if (m.includes('train')) score -= 12
    else if (m.includes('auto')) score -= 18
    else if (m.includes('bus')) score -= 14
    else score -= 20
  } else if (isEvening) {
    score -= m.includes('metro') ? 4 : 8
  }
  const walkMeters = route.steps.filter((s) => s.mode === 'walk').reduce((t, s) => t + (s.distance_m || 0), 0)
  if (isLateNight && walkMeters > 600) score -= 12
  else if (isLateNight && walkMeters > 250) score -= 6
  if (m.includes('bus')) score -= 6
  if (m.includes('auto') && !m.includes('walk') && !isLateNight) score += 4

  // Crime-zone exposure along exposed legs — the core re-ranking signal.
  const high = route.high_risk || 0
  const med = (route.risk_zone_count || 0) - high
  score -= (isLateNight ? 8 : 4) * high
  score -= (isLateNight ? 3 : 1) * med

  return Math.min(100, Math.max(20, Math.round(score)))
}

/**
 * Plan door-to-door itineraries.
 * @returns {{ routes: object[], hour: number }}
 */
async function planJourney({ fromLat, fromLng, toLat, toLng, departMin, hour, safeMode, mode = null }) {
  const directStraight = haversineM(fromLat, fromLng, toLat, toLng)

  // #9: origin ≈ destination → just a short walk, no transit theatre.
  if (directStraight < SHORT_TRIP_M) {
    const walk = await planShortWalk(fromLng, fromLat, toLng, toLat, departMin, 'destination')
    annotateRisk(walk, hour)
    return { routes: [{ ...walk, safety_score: scoreRoute(walk, hour) }], hour }
  }

  const T = (allowed) => planTransit(fromLng, fromLat, toLng, toLat, departMin, hour, 'destination', allowed)
  const A = () => planAuto(fromLng, fromLat, toLng, toLat, departMin, 'destination')
  const B = () => planBus(fromLng, fromLat, toLng, toLat, departMin, hour, 'destination')

  // When the user filters by a mode, route over ONLY that mode (so "Train" never
  // returns a metro leg). Otherwise offer the genuinely-distinct options: the
  // best cross-system mix PLUS a metro-only and a train-only alternative (when
  // they differ) + direct auto + bus — a real multimodal choice, de-duped.
  let promises
  if (mode === 'auto') promises = [A()]
  else if (mode === 'bus') promises = [B()]
  else if (mode === 'metro') promises = [T(new Set(['metro']))]
  else if (mode === 'train') promises = [T(new Set(['train']))]
  else promises = [T(null), T(new Set(['metro'])), T(new Set(['train'])), A(), B()]

  // De-dupe by the transit-line signature (the actual trains/metros taken), so
  // two routes on the same line with only a different last-mile collapse to the
  // best one, while a metro option vs a train option both survive.
  const signature = (r) => {
    const lines = r.steps.filter((s) => (s.mode === 'metro' || s.mode === 'train') && s.line).map((s) => s.line)
    return lines.length ? `T:${lines.join('>')}` : r.id
  }
  const candidates = await Promise.all(promises.map((p) => p.catch(() => null)))
  const seen = new Set()
  const routes = candidates
    .filter(Boolean)
    .filter((r) => {
      const key = signature(r)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((r) => {
      annotateRisk(r, hour) // sets r.risk_zone_count / r.high_risk + per-leg risk_zones
      return { ...r, safety_score: scoreRoute(r, hour) }
    })

  const sorted = safeMode
    ? routes.sort((a, b) => b.safety_score - a.safety_score || a.total_time - b.total_time)
    : routes.sort((a, b) => a.total_time - b.total_time || b.safety_score - a.safety_score)

  return { routes: sorted, hour }
}

module.exports = { planJourney, scoreRoute }
