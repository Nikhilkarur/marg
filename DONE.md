# Marg — Handoff Completion Report

All five tasks from `HANDOFF.md` are implemented and verified. Summary below;
`HANDOFF.md` remains the original brief.

## How to run (unchanged)
```powershell
cd C:\Users\nkk77\Desktop\bshack ; npm run dev            # http://localhost:5173
cd C:\Users\nkk77\Desktop\bshack\backend ; node index.js  # http://localhost:4000
```
Backend audit: `cd backend ; node test/audit.js` (optionally start a degraded
instance on :4100 first — see the file header — to exercise the fallbacks).

---

## TASK 1 — Real, time-tabled multi-modal journeys ✅
- **New transit model** `backend/data/transit.js`: real CMRL **Blue + Green** metro
  graphs (interchanges at Alandur & Chennai Central), plus **Suburban (Beach–Tambaram)**
  and **MRTS (Beach–Velachery)** lines, with service windows, headways and fares.
- **New planner** `backend/lib/planner.js`: door-to-door itineraries with access →
  wait → ride(s) → egress, **next-departure** computation, **metro interchange via
  BFS**, real **per-leg `depart_at`/`arrive_at`/`wait_min`/`line`/`board_stop`/
  `alight_stop`** and route-level `depart_at`/`arrive_at`. Respects service hours
  (no metro after the last train), drops degenerate legs, and handles the edge
  cases (origin≈destination, out-of-coverage, board==alight, OSRM failure).
- **Real OSRM durations** (`backend/lib/osrm.js`): the public OSRM server only has a
  car profile, so we fetch real road distance/geometry and compute walk time at
  ~5 km/h; auto uses the real driving duration (the old 4 min/km hack is gone).
  Failures fall back to a straight-line estimate flagged `estimated:true`.
- **Frontend wired** (`src/pages/MapDetail.jsx`): each leg shows
  "Green Line · 14:36 Anna Nagar Tower → 14:52 Alandur · wait 4 min"; header shows
  Depart/Arrive; honest footnote for representative/estimated legs.
- Verified live: Anna Nagar→T.Nagar returns a 2-line metro interchange with real
  clock times; 23:30 correctly drops metro; short trips return a walk; Tambaram→
  T.Nagar returns the suburban line.

## TASK 2 — Real/sourced crime data ✅
- `backend/data/zones.js`: **46 curated Chennai zones** (was 15), each with a
  `reason`, a `source` citation + period, honest `risk_score`. Variety of
  high/medium/low and all/night/day.
- `src/data/heatmapZones.js` regenerated (adds `source`). `SOURCES.md` documents
  every transit + crime source and its terms.
- Backend merges DB + seed, so `/api/safety/heatmap` already serves all 46.
- **Single source of truth + seeder**: `backend/scripts/seedZones.js` regenerates
  the frontend fallback and emits SQL. DB write is **gated**: `SEED_DB=1 node
  scripts/seedZones.js` (see "Needs you" below).

## TASK 3 — End-to-end backend audit ✅
- `backend/test/audit.js`: **21 checks, all passing** — contract shapes for every
  endpoint, edge cases (out-of-bounds 400, short walk, SOS 429), graceful
  degradation (Supabase/Groq/Twilio unset → seed/local/no-SMS, never 500/ hang),
  Twilio 21608 caught, trips IDOR → 401, and **IST correctness under
  `TZ=America/Los_Angeles`**. Prints a pass/fail table, exits non-zero on failure.

## TASK 4 — Edge cases & robustness ✅
- **IST everywhere** (`backend/lib/time.js`): all time-of-day logic (routes,
  safety, chat, SOS timestamps) uses Asia/Kolkata regardless of host TZ.
- Config banner: `BackendBanner` shows when the backend is unreachable.
- Third-party limits: OSRM User-Agent + caching + retry (`lib/osrm.js`, `lib/cache.js`);
  Nominatim throttle ≤1 req/s + cache + `email` id + request cancellation + NaN guard.
- Crash prevention: `useAuth` `.catch()` + timeout; `LocationSearch` try/catch with
  "search unavailable"/"no results"/loading + arrow-key nav; coord range validation
  → 400; trips UUID/auth guard.
- Routing edge cases 9–14 handled in the planner (see TASK 1).
- SOS: backend **30s/user throttle** + frontend **cooldown/debounce**; geolocation-
  denied → "location unavailable"; notification claim already gated.
- Map: `[lng,lat]` dev assertion, degenerate-bounds guard, tile-error overlay,
  StrictMode-safe init.
- State: origin/destination/route persisted in sessionStorage (no revert on refresh).
- Trips: `Trips.jsx` loads real per-user trips (sample shown for demo); "Start
  Journey" saves a trip for signed-in users.

## TASK 5 — Security, RLS & DB hardening ✅
- **IDOR fixed**: `backend/lib/auth.js` verifies the Supabase JWT; `/api/trips`
  (require auth) and `/api/sos` use the **verified uid**, never `req.body.user_id`.
  `src/lib/api.js` sends the session token. Verified: trips without token → 401.
- **CORS** locked to `FRONTEND_URL` allowlist (no `*`); body size capped.
- **Rate limiting** (`express-rate-limit`): strict on `/sos` + `/chat`, looser on
  `/routes`/`/trips`.
- **Error hygiene**: handlers log detail server-side and return generic messages.
- **Input validation/sanitization**: coord bounds, string clamps, phone sanitize,
  chat prompt length clamp.
- **Schema** (`supabase/schema.sql`): idempotent; dedupes zones; adds
  `UNIQUE(city,area_name)` + `ON CONFLICT DO UPDATE` (no dup re-seed); adds `source`
  + `CHECK(active_hours IN ('all','night','day'))`; drops PostGIS; emergency-contact
  creation moved into `handle_new_user` (no FK race) + upsert; Signup passes contact
  in metadata.
- **Secret hygiene**: `npm run build` → `dist` has **no service_role / Groq / Twilio
  key** (only the anon key, which is client-safe). Confirmed by grep.

---

## Files added
```
backend/lib/      time.js  cache.js  osrm.js  planner.js  auth.js  limits.js  validate.js
backend/data/     transit.js              (zones.js expanded to 46)
backend/scripts/  seedZones.js  zones.generated.sql
backend/test/     audit.js
src/lib/          tripState.js
src/components/marg/ BackendBanner.jsx
SOURCES.md  DONE.md
```
Removed dead deps: `mapbox-gl` (frontend), `@google/generative-ai` (backend).

## Verification status
- `npm run build` ✅ (1690 modules, no errors); `dist` has no service_role key ✅
- `node test/audit.js` ✅ 21/21
- Live UI (Home → Results → MapDetail, SOS, refresh-persistence) ✅
- Live external calls (Groq/Supabase/OSRM/Twilio 21608) verified while the sandbox
  had network; later the sandbox lost outbound DNS, which additionally proved every
  fallback path works (estimated routes, local chat, seed heatmap, no 500s).

---

## Post-handoff iteration (UX feedback)
- **Cross-system multimodal routing**: the planner now routes over ONE graph
  across Metro + Suburban + MRTS, interchanging at shared stations (St Thomas
  Mount, Guindy, Saidapet connect Metro↔Suburban; Beach connects Suburban↔MRTS).
  e.g. ICF→SRM = auto → Green Line metro → St Thomas Mount → local train →
  Potheri (SRM), ₹135, safety 98.
- **Suburban line extended** to Beach–Chengalpattu (Potheri/SRM, Maraimalai
  Nagar, Chengalpattu).
- **Mode chips filter** (Bus/Metro/Train/Auto) and honestly say "No <mode> route
  for this trip" when a mode doesn't serve it (with "Show all options").
- **Schedule on cards** (depart–arrive) + **per-leg time/fare source** (CMRL
  headway / representative timetable / OSRM / estimate) in the detail view.
- **Ticket booking links** per transit leg (Metro→CMRL, train→IR UTS, bus→Chalo).
- **AI assistant** is now a labelled "Ask AI" button on every page.

## Feature wave (UX requests)
**Routing realism**
- Transfer penalty in the planner (no more 5-transfer / 52-min zig-zag routes).
- Mode chips route server-side over ONLY that mode (Train never shows a metro leg).
- Bus capped to ~30 km (no 40 km single-MTC-bus suggestion → honest "No Bus route").
- Removed the "Start Journey" CTA (assistant, not a cab); trips log quietly on open.
- AI system prompt finetuned (Chennai/safety persona, no invented fares/times,
  safest-first after dark, injection-resistant).

**Women safety**
- Zone-aware re-ranking: walk/auto/bus legs that pass *active* crime zones lower
  the route's safety score (heavier at night), so Safe Mode surfaces the
  least-exposed route. Per-leg "Passes <zone> (high risk)" warnings.
- Live trip share (share/copy trip + ETA + location link) and an arrival
  check-in that notifies at the ETA to confirm or alert a contact (TripSafety).

**Multimodal**
- Next 2–3 departures shown per transit leg.
- Recent trips quick-launch on Home.

**Deferred (next wave):** reroute-around-zones via a routing engine that supports
polygon avoidance (public OSRM can't); a safe-points overlay (police/pharmacy via
Overpass — needs live network); step-by-step animated navigation; fare passes.

## ⚠️ Needs you (could not be done autonomously)
1. **Rotate the live keys before any public submission** (TASK 5 D#15): the
   Supabase service_role, Groq, and Twilio secrets are in `backend/.env` (they were
   shared in the brief). They are gitignored and absent from the bundle, but rotate
   them in each provider's dashboard.
2. **Apply the updated `supabase/schema.sql`** in the Supabase SQL Editor (DDL can't
   be run from the app). It's idempotent and safe to re-run.
3. **Seed the 46 zones into Supabase** (optional — the API already serves them via
   merge): `cd backend ; $env:SEED_DB=1 ; node scripts/seedZones.js`. This was left
   gated because it writes to the shared DB.
