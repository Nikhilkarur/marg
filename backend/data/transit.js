// Chennai transit network — the data the journey planner routes over.
//
// HONESTY NOTE (see SOURCES.md):
//  • Metro line orders & station coordinates are the real CMRL Phase-1 network
//    (Blue + Green lines), coordinates are approximate station locations.
//  • Metro timings are HEADWAY-based (CMRL runs on frequency, ~5–12 min, not a
//    published per-station timetable) → schedule_basis: 'headway'.
//  • Suburban Rail + MRTS run on real timetables, but no clean free GTFS for
//    Chennai was available at build time, so departures are generated from
//    PUBLISHED service patterns (first/last train, peak/off-peak frequency) and
//    are flagged schedule_basis: 'representative'. Swap in a real GTFS later.
//  • MTC Bus has no reliable free GTFS → modelled as a frequency estimate and
//    flagged estimated: true.

// ---- Metro (CMRL Phase 1) -------------------------------------------------
// Ordered station lists. Both lines share BOTH interchange stations, "Alandur"
// and "Chennai Central", which the planner uses for Blue↔Green transfers.

const BLUE_STATIONS = [
  { name: 'Wimco Nagar Depot', lat: 13.1700, lng: 80.3010 },
  { name: 'Wimco Nagar', lat: 13.1648, lng: 80.3008 },
  { name: 'Tiruvottiyur', lat: 13.1580, lng: 80.3000 },
  { name: 'Tiruvottiyur Theradi', lat: 13.1490, lng: 80.2990 },
  { name: 'Kaladipet', lat: 13.1420, lng: 80.2970 },
  { name: 'Tollgate', lat: 13.1330, lng: 80.2950 },
  { name: 'New Washermenpet', lat: 13.1210, lng: 80.2920 },
  { name: 'Tondiarpet', lat: 13.1290, lng: 80.2900 },
  { name: 'Washermanpet', lat: 13.1124, lng: 80.2889 },
  { name: 'Mannadi', lat: 13.0966, lng: 80.2870 },
  { name: 'High Court', lat: 13.0890, lng: 80.2820 },
  { name: 'Chennai Central', lat: 13.0827, lng: 80.2772 }, // interchange (Blue/Green)
  { name: 'Government Estate', lat: 13.0741, lng: 80.2584 },
  { name: 'LIC', lat: 13.0660, lng: 80.2578 },
  { name: 'Thousand Lights', lat: 13.0622, lng: 80.2572 },
  { name: 'AG-DMS', lat: 13.0541, lng: 80.2573 },
  { name: 'Teynampet', lat: 13.0427, lng: 80.2488 },
  { name: 'Nandanam', lat: 13.0340, lng: 80.2326 },
  { name: 'Saidapet', lat: 13.0218, lng: 80.2244 },
  { name: 'Little Mount', lat: 13.0142, lng: 80.2223 },
  { name: 'Guindy', lat: 13.0071, lng: 80.2196 },
  { name: 'Alandur', lat: 13.0022, lng: 80.2003 }, // interchange (Blue/Green)
  { name: 'Nanganallur Road', lat: 12.9990, lng: 80.1950 },
  { name: 'Meenambakkam', lat: 12.9942, lng: 80.1789 },
  { name: 'Chennai International Airport', lat: 12.9941, lng: 80.1709 },
]

const GREEN_STATIONS = [
  { name: 'Chennai Central', lat: 13.0827, lng: 80.2772 }, // interchange (Blue/Green)
  { name: 'Egmore', lat: 13.0732, lng: 80.2609 },
  { name: 'Nehru Park', lat: 13.0722, lng: 80.2486 },
  { name: 'Kilpauk Medical College', lat: 13.0772, lng: 80.2419 },
  { name: "Pachaiyappa's College", lat: 13.0815, lng: 80.2300 },
  { name: 'Shenoy Nagar', lat: 13.0820, lng: 80.2247 },
  { name: 'Anna Nagar East', lat: 13.0857, lng: 80.2200 },
  { name: 'Anna Nagar Tower', lat: 13.0848, lng: 80.2101 },
  { name: 'Thirumangalam', lat: 13.0852, lng: 80.2024 },
  { name: 'Koyambedu', lat: 13.0694, lng: 80.1948 },
  { name: 'CMBT', lat: 13.0680, lng: 80.1960 },
  { name: 'Arumbakkam', lat: 13.0735, lng: 80.2090 },
  { name: 'Vadapalani', lat: 13.0507, lng: 80.2121 },
  { name: 'Ashok Nagar', lat: 13.0418, lng: 80.2106 },
  { name: 'Ekkattuthangal', lat: 13.0239, lng: 80.2050 },
  { name: 'Alandur', lat: 13.0022, lng: 80.2003 }, // interchange (Blue/Green)
  { name: 'St Thomas Mount', lat: 12.9952, lng: 80.1986 },
]

// ---- Suburban Rail + MRTS (Southern Railway) ------------------------------
// Beach–Chengalpattu suburban "main line" (the most-used local-train corridor,
// extended past Tambaram to cover Potheri/SRM, Maraimalai Nagar & Chengalpattu).
const SUBURBAN_BEACH_CHENGALPATTU = [
  { name: 'Chennai Beach', lat: 13.0958, lng: 80.2920 },
  { name: 'Chennai Fort', lat: 13.0890, lng: 80.2880 },
  { name: 'Chennai Park', lat: 13.0820, lng: 80.2755 },
  { name: 'Chennai Egmore', lat: 13.0780, lng: 80.2610 },
  { name: 'Chetpet', lat: 13.0720, lng: 80.2430 },
  { name: 'Nungambakkam', lat: 13.0590, lng: 80.2410 },
  { name: 'Kodambakkam', lat: 13.0520, lng: 80.2270 },
  { name: 'Mambalam', lat: 13.0390, lng: 80.2240 },
  { name: 'Saidapet', lat: 13.0220, lng: 80.2230 },
  { name: 'Guindy', lat: 13.0100, lng: 80.2120 },
  { name: 'St Thomas Mount', lat: 12.9952, lng: 80.1986 },
  { name: 'Pallavaram', lat: 12.9670, lng: 80.1500 },
  { name: 'Chromepet', lat: 12.9510, lng: 80.1410 },
  { name: 'Tambaram', lat: 12.9249, lng: 80.1270 },
  { name: 'Perungalathur', lat: 12.9060, lng: 80.0940 },
  { name: 'Vandalur', lat: 12.8920, lng: 80.0810 },
  { name: 'Urapakkam', lat: 12.8640, lng: 80.0710 },
  { name: 'Guduvancheri', lat: 12.8450, lng: 80.0600 },
  { name: 'Potheri (SRM)', lat: 12.8230, lng: 80.0440 },
  { name: 'Kattankulathur', lat: 12.8150, lng: 80.0390 },
  { name: 'Maraimalai Nagar', lat: 12.7920, lng: 80.0270 },
  { name: 'Singaperumal Koil', lat: 12.7620, lng: 80.0060 },
  { name: 'Chengalpattu', lat: 12.6920, lng: 79.9770 },
]

const MRTS_BEACH_VELACHERY = [
  { name: 'Chennai Beach', lat: 13.0958, lng: 80.2920 },
  { name: 'Chintadripet', lat: 13.0747, lng: 80.2730 },
  { name: 'Chepauk', lat: 13.0640, lng: 80.2810 },
  { name: 'Thiruvallikeni', lat: 13.0570, lng: 80.2790 },
  { name: 'Light House', lat: 13.0470, lng: 80.2790 },
  { name: 'Thirumayilai', lat: 13.0330, lng: 80.2670 },
  { name: 'Mandaveli', lat: 13.0270, lng: 80.2620 },
  { name: 'Greenways Road', lat: 13.0160, lng: 80.2570 },
  { name: 'Kotturpuram', lat: 13.0130, lng: 80.2440 },
  { name: 'Kasturba Nagar', lat: 13.0050, lng: 80.2510 },
  { name: 'Indira Nagar', lat: 12.9970, lng: 80.2540 },
  { name: 'Thiruvanmiyur', lat: 12.9830, lng: 80.2590 },
  { name: 'Taramani', lat: 12.9870, lng: 80.2410 },
  { name: 'Perungudi', lat: 12.9650, lng: 80.2450 },
  { name: 'Velachery', lat: 12.9786, lng: 80.2210 },
]

// Service windows in minutes-since-midnight IST.
const HM = (h, m = 0) => h * 60 + m

const LINES = [
  {
    id: 'blue',
    name: 'Blue Line',
    mode: 'metro',
    schedule_basis: 'headway',
    hopMin: 2, // per inter-station hop incl. dwell
    service: { first: HM(4, 30), last: HM(23, 0) },
    stations: BLUE_STATIONS,
  },
  {
    id: 'green',
    name: 'Green Line',
    mode: 'metro',
    schedule_basis: 'headway',
    hopMin: 2,
    service: { first: HM(4, 30), last: HM(23, 0) },
    stations: GREEN_STATIONS,
  },
  {
    id: 'suburban-chengalpattu',
    name: 'Suburban (Beach–Chengalpattu)',
    mode: 'train',
    schedule_basis: 'representative',
    hopMin: 3.5,
    service: { first: HM(4, 0), last: HM(23, 30) },
    stations: SUBURBAN_BEACH_CHENGALPATTU,
  },
  {
    id: 'mrts-velachery',
    name: 'MRTS (Beach–Velachery)',
    mode: 'train',
    schedule_basis: 'representative',
    hopMin: 3,
    service: { first: HM(4, 10), last: HM(23, 20) },
    stations: MRTS_BEACH_VELACHERY,
  },
]

// ---- Geometry -------------------------------------------------------------
function haversineM(aLat, aLng, bLat, bLng) {
  const R = 6371000
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Nearest station on a line to a point, with its index and distance (m). */
function nearestOnLine(line, lat, lng) {
  let best = null
  line.stations.forEach((st, index) => {
    const d = haversineM(lat, lng, st.lat, st.lng)
    if (!best || d < best.dist_m) best = { station: st, index, dist_m: Math.round(d) }
  })
  return best
}

// ---- Frequency / headway model -------------------------------------------
// CMRL headways (approx published): ~5 min peak, ~8 min daytime, ~12 min fringe.
function metroHeadway(hour) {
  if ((hour >= 8 && hour < 11) || (hour >= 17 && hour < 21)) return 5
  if (hour >= 6 && hour < 22) return 8
  return 12
}

// Suburban/MRTS representative frequency (lower than metro): ~10 peak, ~15 off.
function railHeadway(hour) {
  if ((hour >= 7 && hour < 11) || (hour >= 16 && hour < 21)) return 10
  return 15
}

function headwayFor(line, hour) {
  return line.mode === 'metro' ? metroHeadway(hour) : railHeadway(hour)
}

/**
 * Next departure (minutes-since-midnight) from a station at/after `afterMin`.
 * Anchored to the first train so results are deterministic. Returns null when
 * service has ended for the day (so the planner never offers a dead leg).
 */
function nextDeparture(line, hour, afterMin) {
  const { first, last } = line.service
  if (afterMin <= first) return { board: first, wait: Math.max(0, first - afterMin), headway: headwayFor(line, hour) }
  if (afterMin > last) return null
  const h = headwayFor(line, hour)
  const k = Math.ceil((afterMin - first) / h)
  const board = first + k * h
  if (board > last) return null
  return { board, wait: board - afterMin, headway: h }
}

// ---- Fares (₹) ------------------------------------------------------------
function metroFareByHops(hops) {
  if (hops <= 2) return 10
  if (hops <= 6) return 20
  if (hops <= 12) return 30
  if (hops <= 18) return 40
  return 50
}
function railFareByHops(hops) {
  if (hops <= 4) return 5
  if (hops <= 10) return 10
  return 15
}
function autoFare(distanceM) {
  return Math.round(30 + 15 * (distanceM / 1000)) // ₹30 base + ₹15/km (Chennai-ish)
}
function busFareByDistance(distanceM) {
  const km = distanceM / 1000
  if (km <= 5) return 10
  if (km <= 12) return 15
  return 25
}

module.exports = {
  LINES,
  HM,
  haversineM,
  nearestOnLine,
  nextDeparture,
  headwayFor,
  metroFareByHops,
  railFareByHops,
  autoFare,
  busFareByDistance,
}
