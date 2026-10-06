# Marg — safe, multimodal journeys across Chennai

Marg plans door-to-door trips across Chennai's Metro, suburban trains, MRTS, buses, autos and walking, and ranks them by time, cost **and safety**. A Women Safety Mode re-ranks routes away from risky areas at night, and an on-device audio guardian can raise an SOS on its own if it hears a scream.

> Example: ICF → SRM (Potheri) = auto → Green Line metro → change at St Thomas Mount → local train to Potheri, ₹135, with the next departures for each leg.

## Features

**Routing**
- One graph across **Metro (Blue and Green lines), Suburban (Beach–Chengalpattu) and MRTS (Beach–Velachery)**, changing at shared stations such as Alandur, Chennai Central, St Thomas Mount, Guindy and Beach
- Real clock times per leg: walk to the station, wait, ride, change, walk out. Shows the next 2–3 departures and respects service hours (no metro after the last train)
- Real road distances and durations from OSRM for autos and first/last-mile walks
- Mode filters (Bus / Metro / Train / Auto) that say plainly when a mode doesn't serve a trip
- Ticket booking links per leg (CMRL, Indian Railways UTS, Chalo)

**Women Safety Mode**
- **46 Chennai zones** with cited crime sources, shown as a heatmap. Walk, auto and bus legs through active zones lower a route's safety score, more heavily at night, with per-leg warnings
- **AI Audio Guardian**: on-device distress detection with the **YAMNet** neural network (TensorFlow Lite in the browser) plus a scream-fingerprint heuristic. On detection it counts down 10 seconds, then sends the SOS unless cancelled. Audio never leaves the phone and nothing is recorded
- Voice safe word, one-tap **SOS by SMS** (Twilio) to emergency contacts, live trip sharing, an arrival check-in, and nearby safe havens

**Also**
- **Ask AI**: a Chennai travel assistant (Groq, Llama 3.3 70B) told not to invent fares or times, with a fallback to a backup key
- English and **Tamil**; installable as a PWA, with a mobile bottom-sheet layout

## Engineering

- **Backend audit:** `npm test` in `backend/` runs 21 checks: response shapes for every endpoint, edge cases, rate limits, and correct India time even when the server runs in another timezone
- **Graceful degradation:** with Supabase, Groq or Twilio missing, the app falls back to seed data, a local reply or no SMS. It never returns a 500
- **Security:** Supabase JWT verified on the server (the user id is never trusted from the request), CORS allowlist, rate limits on SOS and chat, input validation, and no secret keys in the frontend bundle
- **Honest data:** every source and its licence is in [SOURCES.md](SOURCES.md). Legs built from representative timetables or estimates are labelled as such in the API and the UI

## Tech stack

**Frontend:** React 18 · Vite · Tailwind CSS · Leaflet · TensorFlow Lite (YAMNet)<br>
**Backend:** Node.js · Express · Supabase (PostgreSQL + Auth) · Groq · Twilio<br>
**Data:** OSRM (roads) · Nominatim (place search) · CMRL and Southern Railway timetables

```
Browser (React PWA) ──▶ Express API ──▶ Supabase · Groq · Twilio · OSRM · Nominatim
   └─ YAMNet audio guardian runs on the device
```

## Run it locally

Needs Node 18+.

```bash
# frontend  →  http://localhost:5173
cp .env.example .env
npm install
npm run dev

# backend   →  http://localhost:4000
cd backend
cp .env.example .env      # every key is optional; missing services fall back
npm install
npm start
npm test                  # the 21-check audit
```

Leaving the Supabase variables blank uses built-in demo sign-in. Deployment (Vercel + Railway + Supabase) is in [DEPLOY.md](DEPLOY.md).

## Project layout

| Path | What lives there |
|---|---|
| `src/pages/` | Home, Results, MapDetail, Safety, Trips, Profile, TrackView |
| `src/hooks/useGuardian.jsx`, `src/lib/yamnet.js` | the on-device audio guardian |
| `backend/lib/planner.js` | door-to-door multimodal planner |
| `backend/data/` | transit network (`transit.js`) and safety zones (`zones.js`) |
| `backend/routes/` | `/routes`, `/safety`, `/sos`, `/chat`, `/trips`, `/track` |
| `backend/test/audit.js` | the backend audit |
| `supabase/schema.sql` | database schema (idempotent) |

## Limitations

- No free official GTFS exists for Chennai's suburban trains or MTC buses, so those departures come from published service patterns and are labelled "representative" or "estimated"
- Metro station coordinates are approximate; the public OSRM server has only a car profile, so walk times are computed at about 5 km/h
- Routes are re-ranked around risky zones, not yet re-routed around them

Built by [Karur Nikhil](https://github.com/Nikhilkarur).
