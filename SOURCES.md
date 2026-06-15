# Marg — Data Sources

Every external data source Marg uses, what it's used for, how current the data is,
and its licence / terms. **Guiding principle: free sources only, and honest
labelling of anything that is representative or estimated rather than official.**

---

## Transit (routing & schedules)

### Chennai Metro — CMRL (Blue & Green lines)
- **Used for:** station list & order, interchanges (Alandur, Chennai Central),
  service hours (~04:30–23:00) and headways (~5 min peak / ~8 min day / ~12 min
  fringe) in `backend/data/transit.js`.
- **Basis:** published CMRL network map & timetable information (chennaimetrorail.org).
- **Honesty:** metro runs on **frequency, not a per-station public timetable**, so
  Marg computes the next train from headways and labels these legs
  `schedule_basis: 'headway'`. Station **coordinates are approximate** centroids.
- **Terms:** facts (station names/order, operating hours) are not copyrightable;
  no API or dataset is redistributed.

### Suburban Rail + MRTS — Southern Railway (Beach–Chengalpattu incl. Potheri/SRM, Beach–Velachery)
- **Used for:** station list/order and ride-time model for the "local train".
- **Basis:** published Southern Railway suburban service patterns (first/last
  train, peak/off-peak frequency).
- **Honesty:** no clean **free GTFS** for Chennai suburban was available at build
  time, so departures are generated from published patterns and labelled
  `schedule_basis: 'representative'` in the data, the API response, and the UI.
  **Swap in a real GTFS** (see "Where to get real GTFS" below) to make these exact.

### MTC Bus
- **Used for:** a cheap bus option.
- **Honesty:** no reliable free MTC GTFS was available, so the bus leg is a
  **frequency estimate** (walk → headway wait → ride at ~1.6× car time) and is
  flagged `estimated: true`. Not real route numbers.

### OSRM — `router.project-osrm.org` (public demo)
- **Used for:** real road geometry, distance and driving duration for auto legs
  and the first/last-mile of transit; map polylines.
- **Note:** the public demo server **only ships the car profile**, so walk
  durations are computed from the road distance at ~5 km/h (not from a walking
  profile). No SLA — see "Production" below.
- **Licence:** OSRM is BSD; routing data derives from OpenStreetMap (ODbL).

### Nominatim — `nominatim.openstreetmap.org`
- **Used for:** forward geocoding of the origin/destination search (Chennai-biased).
- **Compliance:** ≤1 request/second (throttled client-side), results cached, an
  identifying `email` param is sent (browsers cannot set a custom `User-Agent`),
  and requests are cancelled on new keystrokes. **Usage Policy:**
  https://operations.osmfoundation.org/policies/nominatim/
- **Licence:** data © OpenStreetMap contributors (ODbL).

### Map tiles — CARTO "light_all" basemap
- **Used for:** the Leaflet base map.
- **Attribution (shown on map):** © OpenStreetMap © CARTO.
- **Licence/terms:** CARTO basemaps usage policy; OSM data under ODbL.

---

## Crime / women-safety zones (`backend/data/zones.js`, 46 zones)

**Reality:** granular, street-level, real-time crime data for Chennai does **not**
exist as a clean public API. Marg's zones are a **curated dataset** compiled from
the public sources below. `risk_score` (0–100) is a **transparent relative
heuristic**, not an official statistic. Each zone carries a `source` + period and
a human-readable `reason`. Coordinates are approximate area centroids.

- **Safecity.in** — crowdsourced sexual-harassment reports with geolocation for
  Indian cities incl. Chennai. Used to identify reported-harassment areas.
  https://safecity.in (check for an export/API before a production pull).
- **NCRB "Crime in India"** — National Crime Records Bureau city/district
  aggregates (Chennai). Used for relative city-level risk weighting. https://ncrb.gov.in
- **Local news (geocoded incidents)** — The Hindu, Times of India, DT Next
  reports of specific incidents/areas, geocoded via Nominatim.
- **data.gov.in** — Tamil Nadu open datasets (where available) and police
  advisories. https://data.gov.in
- **Area characteristics** — lighting, isolation, industrial/marsh/highway
  stretches, and transit-hub crowding (documented in each zone's `reason`).

**How it's loaded:** `backend/data/zones.js` is the single source of truth.
`backend/scripts/seedZones.js` regenerates the frontend fallback
(`src/data/heatmapZones.js`) and emits `scripts/zones.generated.sql`. The backend
`/api/safety/heatmap` serves Supabase rows merged with this list, so all 46 zones
appear even before the DB is seeded. To load them into Supabase:
`SEED_DB=1 node scripts/seedZones.js` (gated — it writes to the shared DB).

---

## Production notes
- **Self-host OSRM & Nominatim** (or use a paid-tier-free key provider) for real
  traffic — the public demo servers have **no SLA** and rate-limit.
- **Where to get real GTFS** to replace the representative rail/bus timetables:
  Mobility Database (mobilitydatabase.org), transitfeeds.com, OpenMobilityData,
  data.gov.in, or Chalo. Drop a GTFS in and replace the generators in
  `backend/data/transit.js`.
- **Everything here is free.** Marg deliberately uses no Mapbox/Google billing or
  other paid APIs.
