# Marg — Engineering Handoff

> ✅ **STATUS (2026-06-15): all 5 tasks below are implemented & verified.** See
> [`DONE.md`](DONE.md) for the completion report and the 3 manual follow-ups
> (rotate keys, apply `supabase/schema.sql`, optionally `SEED_DB=1` seed). Backend
> audit: `cd backend ; node test/audit.js` (21/21). This brief is kept as the
> original spec.

> Self-contained brief for a fresh AI agent. You have **no prior conversation context** —
> everything you need is in this file plus the codebase. Read it fully before changing code.

---

## 0. What Marg is

**Marg** is a women-safety-focused, multi-modal **urban transit planner for Chennai, India**
(OneJourney Hackathon 2026). A user enters origin → destination, gets ranked route options
(metro / suburban rail / bus / auto / walk combos), and a **Women Safety Mode** that re-ranks
routes by real crime data, shows a crime heatmap, and exposes an **SOS** panic button and an
**AI safety assistant**.

Project root: `C:\Users\nkk77\Desktop\bshack`
OS: **Windows 11**, shell **PowerShell**, package manager **npm** (NOT pnpm).

---

## 1. Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | React 18 + Vite 5 + Tailwind v3 | port **5173**, `npm run dev` |
| UI | Hand-authored shadcn-style primitives in `src/components/ui/` | no shadcn CLI |
| Backend | Node + Express | port **4000**, `node index.js` from `backend/` |
| DB / Auth | Supabase (project `euzcdlifajcpnctoomsq`) | schema applied; RLS on |
| AI chat | **Groq** `llama-3.3-70b-versatile` (OpenAI-compatible, via axios) | replaced Gemini |
| Maps | **Leaflet + OpenStreetMap/CARTO** tiles | no API key |
| Geocoding | **Nominatim** (free) | Chennai-biased |
| Routing (road) | **OSRM** public demo server | free, no key |
| SMS | **Twilio** (trial) | see §7 |

**HARD CONSTRAINT: keep everything free.** Do **not** introduce Mapbox, Google Maps billing,
or any paid API. Mapbox was removed earlier because the token was dead.

### How to run (PowerShell)
```powershell
# Frontend
cd C:\Users\nkk77\Desktop\bshack ; npm run dev          # http://localhost:5173

# Backend (separate shell)
cd C:\Users\nkk77\Desktop\bshack\backend ; node index.js  # http://localhost:4000
```
Test backend with `Invoke-RestMethod` against `http://localhost:4000` — **the Bash tool mangles
Windows paths, use PowerShell.** Preview screenshots **time out** on the Leaflet map pages —
verify via DOM queries / `getBoundingClientRect`, not screenshots.

### Env files (gitignored — never commit, never put service_role in frontend)
- Root `.env`: `VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `backend/.env`: `PORT`, `FRONTEND_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `GROQ_API_KEY`, `GROQ_MODEL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

---

## 2. Read these first

Backend: `backend/index.js`, `backend/routes/*.js` (routes, safety, chat, sos, trips),
`backend/data/zones.js`, `backend/lib/supabase.js`
Frontend: `src/lib/api.js` (frontend↔backend contract), `src/pages/Results.jsx`,
`src/pages/MapDetail.jsx`, `src/components/marg/MapComponent.jsx`,
`src/components/marg/SOSButton.jsx`, `src/hooks/useAuth.js`, `src/hooks/useSafeMode.jsx`
DB: `supabase/schema.sql`

---

## 3. Current state (verified working — don't regress)

- ✅ **Auth**: Supabase login/signup + a localStorage **demo bypass** ("Explore in demo mode")
  so the app is always usable. `useAuth` + `ProtectedRoute`.
- ✅ **Map**: Leaflet/OSM renders, route polyline + start/end pins, no keys.
- ✅ **Routing**: `POST /api/routes` returns 3 options with **real OSRM road geometry**
  (151–208 GPS pts). *But the combos are templated and times are partly faked — see TASK 1.*
- ✅ **Heatmap**: `GET /api/safety/heatmap` returns **15 Chennai zones at all hours**
  (`source: supabase`); frontend draws 15 colored circles **only in Safe Mode**.
- ✅ **AI chat**: `POST /api/chat` returns real Groq Chennai-specific replies (`source: groq`).
- ✅ **SOS**: multi-channel — Web Audio alarm + `navigator.vibrate` + Browser Notification +
  Twilio SMS + in-app card (geolocation, Maps link, timestamp) + `localStorage marg_sos_log`.
- ✅ **Supabase schema applied**: `heatmap_zones` seeded (15), `trips` table exists.
- ✅ **Twilio LIVE**: SMS **delivers to verified numbers** (tested OK to a real phone);
  unverified numbers fail with error 21608 (trial limit). Balance ~$14.

---

## 4. DATA CONTRACTS — do not break (the frontend depends on these exact shapes)

**`POST /api/routes`** `{ from_lat, from_lng, to_lat, to_lng, safe_mode, hour }` →
```jsonc
{ "routes": [ {
    "id": "metro-auto", "label": "Metro + Auto",
    "modes": ["walk","metro","auto"], "transfers": 2,
    "steps": [ { "mode":"metro", "icon":"train", "label":"...", "distance_m":null,
                 "duration_min":18, "fare":20,
                 // TASK 1 ADDS: "depart_at":"14:32","arrive_at":"14:48","wait_min":4,
                 //              "line":"Blue Line","board_stop":"...","alight_stop":"...",
                 "coordinates": [[lng,lat], ...] } ],
    "coordinates": [[lng,lat], ...],   // GeoJSON [lng,lat] order — MapComponent flips to [lat,lng]
    "total_time": 34, "total_fare": 47, "safety_score": 72
    // TASK 1 ADDS: "depart_at":"14:27","arrive_at":"15:01"
  } ], "hour": 22 }
```
Consumed by `src/pages/Results.jsx` (`toCard()`) and `src/pages/MapDetail.jsx`.

**`GET /api/safety/heatmap?city=chennai&hour=21`** →
```jsonc
{ "zones": [ { "area_name":"Vadapalani Signal","city":"chennai",
    "latitude":13.053,"longitude":80.212,"radius_m":500,
    "risk_level":"high","risk_score":78,"reason":"...",
    "active_hours":"night","currently_active":true } ],
  "count": 15, "hour": 21, "source": "supabase" }
```
MapComponent needs: `latitude, longitude, radius_m, risk_score, area_name`. **Zones render ONLY
in Safe Mode** (`MapComponent.jsx`: `if (!safeMode || !heatmapZones?.length) return`) — preserve.

**`POST /api/chat`** `{ message, route_context, safe_mode, hour, crime_count }` → `{ reply, source }`
**`POST /api/sos`** `{ user_id, lat, lng, user_name, contact_name, contact_number }` →
`{ success, sent_to, sms_sent, sms_error, channels }`

---

## TASK 1 — Real, TIME-TABLED multi-modal journeys (highest priority)

**Current (fake):** `backend/routes/routes.js` builds 3 hardcoded templates, uses only the
single nearest metro station, fakes metro=18min & bus=28min, estimates auto at 4 min/km
(ignoring the real OSRM duration it already fetches), and produces **no departure/arrival clock
times**. Replace with a time-aware planner.

**GOAL:** given origin, destination, and departure time T ("now" default), return itineraries
that say **which vehicle to take and at what time**, e.g.:
> "Walk 5 min → board **Blue Line metro 14:32** at Anna Nagar Tower → arrive Alandur 14:48 →
> transfer → board **MRTS local 14:55** → arrive 15:10 → auto 8 min to destination."

Build with **real graphs/schedules (free sources only)**:
- **Chennai Metro (CMRL)**: model BOTH operational lines — Blue Line (Wimco Nagar Depot↔Airport)
  and Green Line (Chennai Central↔St. Thomas Mount) — interchange at Alandur & Central. Real
  headways (~5–8 min peak, ~10–15 off-peak), real first/last train (~04:30 / ~23:00). Travel
  time = station_count × ~2 min + dwell. From T, compute the **next** train's departure + arrival.
- **Chennai Suburban Rail + MRTS (Southern Railway)** — the "local train". MRTS: Chennai
  Beach↔Velachery. Suburban: Beach–Tambaram–Chengalpattu, Central–Arakkonam, etc. These run on
  **timetables**, not frequency. Find a free GTFS/timetable (Mobility Database, transitfeeds,
  erail/RailYatri, data.gov.in). Use actual scheduled times. If none is found, build a
  representative timetable from published schedules and **label it as such** in code + SOURCES.md.
- **MTC Bus**: ingest Chennai MTC GTFS if available (Chalo / data.gov.in / Mobility Database) for
  real route numbers + stop_times; else a frequency estimate, **labeled**.
- **Auto / walk (first & last mile)**: keep OSRM, but **use the real OSRM duration** (drop the
  4 min/km hack). Auto = OSRM driving duration; walk = OSRM walking duration.

**Planner requirements:** choose board/alight stops that minimize total door-to-door **time**
(walk-in + wait + ride + transfers + walk-out), not air distance; add transfer buffers (3–5 min)
and show wait time before each transit leg; generate a few genuine alternatives algorithmically;
respect service hours (don't offer a train/metro that has stopped running for time T).

**Contract changes (update frontend in the same change):** add to each step `depart_at`,
`arrive_at` ("HH:MM" IST), `wait_min`, `line`, `board_stop`, `alight_stop`; add to route
`depart_at`, `arrive_at`. Then **update `src/pages/MapDetail.jsx`** so each step shows board/arrive
times + line, e.g. "🚇 Blue Line · board 14:32 Anna Nagar Tower → 14:48 Alandur (wait 4 min)".
Keep coords GeoJSON [lng,lat]; don't break `Results.jsx` `toCard()`.

**Guardrail:** the crime heatmap must render **only in Safe Mode** (already correct — preserve).

---

## TASK 2 — Replace seeded zones with REAL Chennai crime/safety data

**Current:** `backend/data/zones.js` + `src/data/heatmapZones.js` = 15 hand-written zones.
**Upgrade:** pull from credible sources — **Safecity.in** (crowdsourced harassment reports w/
geolocation — check for API/exported dataset), **data.gov.in** (Tamil Nadu crime datasets),
**NCRB** (aggregate), geocoded news incidents.

**Reality to honor:** granular street-level real-time crime data for Chennai does **not** exist as
a clean public API. The credible approach is Safecity crowd reports + a curated incident dataset
geocoded via Nominatim. Produce **40–100 zones**, each with a `reason`, a `source` citation, and a
date. Load into Supabase `heatmap_zones` (service_role key in `backend/.env`) **and** update the
local fallback files. Add a `source` column (see TASK 5 schema fix). Conform to the
`risk_level IN ('high','medium','low')` and `risk_score 0–100` constraints. Preserve `active_hours`
+ the `currently_active` annotation behavior.

---

## TASK 3 — End-to-end backend audit

- Write a PowerShell or Node test script hitting every endpoint (`/api/routes`,
  `/api/safety/heatmap`, `/api/chat`, `/api/sos`, `/api/trips` GET+POST) asserting the §4 shapes.
- Verify graceful degradation: unset each key (GROQ / SUPABASE / TWILIO) → server still responds
  via local fallbacks.
- Confirm Twilio error 21608 (unverified number) is caught and never 500s.
- Confirm trips endpoint rejects non-uuid user_ids without crashing.
- Output a pass/fail table.

---

## TASK 4 — Edge cases & production robustness

Fix the following; add a one-line code comment per case noting what it guards.

### A. Deployment-critical
1. **TIMEZONE:** backend uses `new Date().getHours()` (server-local) in `routes.js (~L85)`,
   `safety.js`, `chat.js`. Replace ALL time-of-day logic with an explicit **IST** (Asia/Kolkata,
   UTC+5:30) helper (`backend/lib/time.js`). Governs night detection, safety scoring,
   `active_hours`, AND the TASK 1 schedule timings. Must be IST regardless of host.
2. **CONFIG:** `VITE_BACKEND_URL` falls back to `http://localhost:4000` (`src/lib/api.js:3`) — in
   prod this silently degrades to fake routes/local heatmap. Show a visible banner when the
   backend is unreachable. Document required prod env vars.
3. **CORS / HTTPS:** `index.js` uses `cors({ origin: FRONTEND_URL || '*' })` — lock to the real
   frontend origin. Backend must be HTTPS (HTTPS frontend → HTTP backend = blocked mixed content).
4. **THIRD-PARTY LIMITS:** public OSRM + Nominatim have no SLA; Nominatim requires an identifying
   **User-Agent** and **≤1 req/s**. Add a custom UA header, request cancellation on the geocode
   debounce, in-memory caching of geocode/route results, and 429 backoff. Note self-hosting as the
   production path.

### B. Crash / 500 prevention
5. `useAuth` (`src/hooks/useAuth.js:34`): `getSession()` has no `.catch()` → app hangs on
   "Loading…" forever if Supabase is down. Add `.catch()` → fall back to demo/null, set
   `loading=false`, add a timeout guard.
6. `trips.js` **POST** has no uuid guard (only GET was fixed) → `user_id:"demo"` → 500. Apply the
   same UUID check; return `{ saved:false, reason:'demo-user' }` for non-uuid ids.
7. `LocationSearch.jsx (~L35)`: `await geocode(q)` isn't wrapped → network throw = unhandled
   rejection. try/catch + "no results"/"search unavailable" state + loading indicator + arrow-key nav.
8. `routes.js` validates lat/lng are numbers but not ranges. Reject coords outside a sane
   Chennai/TN bounding box (or at least valid lat/lng) with a 400.

### C. Routing logic edge cases (coordinate with TASK 1)
9. origin == destination (or < ~300m): don't offer metro/bus; short walk/auto only.
10. Trip shorter than the walk-to-station distance: skip the metro option.
11. Origin/destination outside metro coverage: `nearestStation()` blindly returns a Chennai
    station — guard with a max snap distance; omit the mode if too far.
12. OSRM returns null (timeout): currently falls back to magic constants (1000/3000/4000m)
    silently — mark such legs `estimated:true` and retry once before falling back.
13. Boarding station == alighting station → drop the transit leg.
14. Use the **real OSRM duration** for auto/walk (drop 4 min/km).

### D. SOS robustness
15. **RATE LIMIT** `POST /api/sos` (e.g. 1 send / 30s per user) AND debounce the button so a
    double-tap can't fire multiple real SMS (protects the Twilio balance). Return "recently sent".
16. Geolocation denied/timeout → null location: still send (alarm+notification+SMS), label
    "location unavailable" clearly (partly handled — verify).
17. Notification permission denied → fall back gracefully (alarm + in-app card still fire); don't
    claim "browser notification delivered" when it wasn't (gated — verify).

### E. Map robustness (`src/components/marg/MapComponent.jsx`)
18. React 18 StrictMode double-mounts effects → possible "Map container is already initialized"
    Leaflet error. Verify the init guard + cleanup fully handle it.
19. Enforce GeoJSON [lng,lat] order on all coordinates; add a dev assertion so a [lat,lng]
    regression (route drawn in the ocean) is caught.
20. Empty/single-point coordinates → guard `fitBounds` on degenerate bounds.
21. Tile load failure (offline) → subtle "map unavailable" overlay instead of blank grey.

### F. State & data
22. Refresh on `/results` or `/map` loses `location.state` → silently reverts to default Anna
    Nagar→T. Nagar. Persist origin/destination (URL query params or sessionStorage).
23. `RouteCard`/`MapDetail`: guard missing `route.legs` / `safety_score` (undefined safety →
    SafetyBadge renders red). Default safely.
24. Nominatim NaN lat/lng on unexpected format → validate `parseFloat` before use; drop invalid.
25. Replace hardcoded `Trips.jsx` / `Profile.jsx` trip lists with real per-user Supabase data once
    routing is real (tie to the trip-save flow).

---

## TASK 5 — Security, RLS & database hardening

RLS policies are correct for the FRONTEND (anon key + user JWT). The problem: the BACKEND uses the
**service_role** key, which **bypasses RLS**, and trusts `user_id` from the request.

### A. Access control / RLS (critical — IDOR)
1. `/api/trips` GET+POST and `/api/sos` accept `user_id` from the request with service_role → anyone
   can read any user's trips / emergency contact by guessing a UUID. **FIX:** require the caller's
   Supabase access token (`Authorization: Bearer <jwt>`), verify server-side
   (`supabase.auth.getUser(jwt)`), and use the verified uid — **never the body's user_id**. 401 on
   missing/invalid. Update `src/lib/api.js` to send the session token on these calls.
2. Prefer a per-request Supabase client scoped to the user's JWT (anon key + their Authorization
   header) so RLS enforces; reserve service_role ONLY for admin ops (seeding heatmap_zones, system
   incident logging). Document which endpoints need service_role.
3. Verify every table's RLS (profiles/emergency_contacts/trips/incidents owner-only;
   heatmap_zones public SELECT only). Add a test asserting anon + different-user clients are denied.

### B. Database schema fixes (`supabase/schema.sql`)
4. `heatmap_zones`: add `UNIQUE(city, area_name)` and change the seed to
   `ON CONFLICT (city, area_name) DO UPDATE` — **re-running the schema currently duplicates all 15
   zones** (the `ON CONFLICT DO NOTHING` keys on the random-UUID PK, never conflicts).
5. `emergency_contacts.user_id` is `UNIQUE` but signup does `INSERT` → 2nd save throws. Make it
   **UPSERT** (`on conflict (user_id) do update`) in both SQL and `src/pages/Signup.jsx`/profile edit.
6. FK race: `emergency_contacts.user_id → profiles(id)`, profiles populated by an AFTER INSERT
   trigger. Ensure the contact write happens only after the profile exists (await + retry, or move
   it into `handle_new_user` / an RPC).
7. Add `CHECK (active_hours IN ('all','night','day'))`; add a `source TEXT` column (for TASK 2).
8. Drop the unused **PostGIS** extension (zones are plain lat/lng) unless a later feature needs it.

### C. API hardening (backend)
9. CORS: lock `origin` to the explicit deployed frontend URL(s); remove the `*` fallback.
10. Rate-limit all endpoints (`express-rate-limit`): strict on `/api/sos` and `/api/chat` (protects
    Groq quota), looser on `/api/routes`. Key by IP + uid when present.
11. Stop returning raw `err.message` to clients (every `routes/*.js` catch) → log server-side,
    return generic `{ error:'Internal error' }`.
12. `/api/chat` prompt-injection: treat `message`/`route_context` as untrusted — clamp length, keep
    user text in the user role only (already so), add a per-IP quota so the key can't be farmed.
13. Validate/sanitize all inputs server-side (coord ranges, string lengths, contact_number format).

### D. Secret hygiene
14. service_role key must NEVER appear in any `VITE_*` var or the frontend bundle. Confirm
    `.gitignore` covers `.env` + `backend/.env` and no key is in git history. Only the anon key is
    client-side.
15. Rotate any key pasted into chat/screenshots before public submission (Supabase service_role,
    Groq, Twilio token).

### E. Auth correctness (frontend)
16. Demo flag masks real auth: once `localStorage 'marg_user'` is set, `useAuth (L25)` always returns
    the demo user even after a real Supabase login. On real sign-in, clear `marg_user`; pick one
    source of truth.

---

## Consolidated Definition of Done

1. `/api/routes` returns combos from a real Chennai **metro graph + suburban/MRTS timetables**
   (+ real bus GTFS if available), with correct station-count-based times and honest labeling.
2. Each itinerary has real per-leg `depart_at`/`arrive_at` IST clock times; `MapDetail.jsx`
   displays them; no leg is offered outside its real service hours for the given departure time.
3. `heatmap_zones` holds **40+ real/sourced** zones in Supabase, each with a citation; local
   fallbacks updated.
4. A passing **end-to-end** test report for all endpoints + degradation cases (backend/Supabase/
   Groq/Twilio down, geolocation denied, OSRM/Nominatim 429) — app never hangs or 500s.
5. All time-of-day logic is **IST-correct regardless of server timezone** (proven by a test that
   sets host TZ to America/Los_Angeles and asserts Chennai night detection).
6. `/api/sos` is rate-limited and double-tap-safe.
7. **Security:** calling `/api/trips` or `/api/sos` with someone else's `user_id` and no/mismatched
   JWT is rejected; anon + cross-user clients are denied by RLS on private tables; re-running
   `schema.sql` leaves exactly N zones (no duplicates); `npm run build` + grep dist shows no
   service_role key in the frontend bundle.
8. A short **SOURCES.md** listing every data source used (transit + crime) and its license/terms.

---

## 5. File map

```
bshack/
  src/
    App.jsx                       routes: /login /signup /home /results /map /trips /profile
    main.jsx                      BrowserRouter + SafeModeProvider
    lib/  api.js  supabase.js  utils.js
    hooks/  useAuth.js  useSafeMode.jsx
    data/ heatmapZones.js         local heatmap fallback (15 zones)
    components/
      ui/    button input switch avatar
      marg/  AppLayout TopNav BottomNav MapComponent LocationSearch RouteCard
             SafetyBadge SOSButton ChatButton ProtectedRoute
    pages/   Login Signup Home Results MapDetail Trips Profile
  backend/
    index.js
    lib/supabase.js
    routes/  routes.js safety.js chat.js sos.js trips.js
    data/zones.js                 seed heatmap (15 zones)
  supabase/schema.sql
  .env  backend/.env              (gitignored)
```

---

## 6. Constraints (recap)

- **Free APIs only.** No Mapbox/Google billing. No new paid services.
- **Don't break the §4 data contracts** unless you also update the consuming frontend in the same
  change.
- **Windows + PowerShell + npm.** Preview screenshots time out on map pages — verify via DOM/eval.
- Be **honest in code comments** about what is real vs. estimated.

---

## 7. Key facts about the live services

- **Twilio (trial):** SMS **delivers only to numbers verified in the Twilio console**; unverified →
  **error 21608** (caught in `sos.js`, never 500s). To let judges receive SMS: verify their number
  (free) or upgrade (~$15, also removes the "Sent from your Twilio trial account" prefix). The
  alarm + browser notification + in-app card work for **anyone** regardless of Twilio — SMS is a
  bonus layer.
- **Groq:** working, returns Chennai-specific replies; falls back to a local canned reply on
  error/no-key.
- **Supabase:** schema applied; `heatmap_zones` seeded (15), `trips`/`emergency_contacts`/
  `incidents`/`profiles` exist with RLS. Email confirmation may be ON (signup returns no session →
  the app saves the SOS contact to localStorage and still works via demo bypass).
- **OSRM + Nominatim:** public free endpoints, no key, no SLA — see TASK 4 #4.
```
