# Marg — Deployment Handoff (START HERE)

> **If you are an AI agent:** read this whole file first. Your job is to get **Marg**
> live in production **together with the user, one step at a time**. The user is not a
> DevOps expert and explicitly wants you to **guide them through every step and ask for
> whatever you need** (GitHub repo URL, dashboard clicks, confirmations). **Do not assume,
> do not skip, do not batch.** Do one step, tell them exactly what to click/paste, wait
> for them, verify it worked, then move to the next. Whatever input you need — a key, a
> URL, a screenshot of a dashboard — **just ask; they will give it.**

---

## 0. Rules for the deploying agent
1. **One repo only:** `C:\Users\nkk77\Desktop\bshack` (Windows 11, PowerShell, **npm** — not pnpm).
2. **Guide interactively.** At each step that needs the user (create a repo, click a button
   in Railway/Vercel, paste a value, confirm) → STOP and ask. Number your steps. After each,
   verify before continuing (curl the health endpoint, open the URL, check for the banner).
3. **Never push or create external resources without the user's explicit go-ahead.** The
   code is already committed locally (branch `master`, 1 commit) but **NOT pushed** — there
   is no git remote yet. Helping the user create a GitHub repo + push is the first real step.
4. **Never put real secrets in any committed file.** The keys live ONLY in `backend/.env`
   and root `.env` (both git-ignored). When a dashboard needs a value, read it from those
   local files (or ask the user) and have them paste it into the dashboard. Do not echo
   secrets into tracked files, READMEs, or commits.
5. **Run/verify gotchas (important on this machine):**
   - PowerShell `Start-Process node` intermittently throws a sandbox **EPERM**. Start the
     backend via the **Bash tool with `run_in_background: true`**
     (`cd /c/Users/nkk77/Desktop/bshack/backend && node index.js`). Kill a stuck port with
     PowerShell `Stop-Process` (that's fine). HTTP tests via `Invoke-RestMethod` are fine.
   - **Preview screenshots time out on Leaflet map pages** — verify UI via `preview_eval`
     DOM queries / `getBoundingClientRect`, not screenshots (auth/profile pages screenshot OK).
   - `node test/audit.js` (from `backend/`) is the end-to-end check — should be 16/16
     (a 17th "degraded" check is skipped unless a second backend runs on :4100).

---

## 1. What Marg is
**Marg** is a women-safety-focused, **multi-modal urban transit planner for Chennai, India**
(OneJourney Hackathon 2026). A user enters origin → destination and gets ranked, **time-tabled**
route options across **Metro, Suburban rail, MRTS, MTC bus, auto and walking** — with real
"board the 14:32 Green Line → arrive 14:48" clock times. A **Women Safety Mode** re-ranks
routes by real crime data, shows a crime heatmap, and the app has a one-tap **SOS** (alarm +
browser notification + SMS + in-app alert) and a **Marg AI** assistant.

It is an **MVP delivered as a website** (not a Play Store app) to avoid app-store deployment
friction for the hackathon — there's a note saying so on the auth pages.

## 2. Stack & architecture
```
Browser ──HTTPS──▶ Vercel (frontend, Vite static SPA)
   │  fetch VITE_BACKEND_URL
   └──HTTPS──▶ Railway (backend, Node/Express) ──▶ Supabase · Groq · Twilio · OSRM · Nominatim
```
| Layer | Tech | Notes |
|------|------|------|
| Frontend | React 18 + Vite 5 + Tailwind v3 | port 5173 (`npm run dev`); build → `dist` |
| Backend | Node + Express | port 4000 (`node index.js` from `backend/`) |
| DB / Auth | Supabase (project `euzcdlifajcpnctoomsq`) | RLS on; schema in `supabase/schema.sql` |
| AI chat | Groq `llama-3.3-70b-versatile` | **two keys with auto fail-over** (primary + backup) |
| Maps / geo | Leaflet + OpenStreetMap/CARTO, Nominatim, OSRM | **all free, no API key** |
| SMS | Twilio (trial) | delivers only to console-verified numbers (else error 21608, caught) |
**Hard rule:** keep everything free — no Mapbox / Google Maps billing / paid APIs.

## 3. Current state (done & verified — do not rebuild)
- All five upgrade tasks from `HANDOFF.md` are **implemented and verified** — see `DONE.md`.
- **Routing is real & time-tabled** (CMRL Blue+Green metro graph + Suburban + MRTS + bus +
  OSRM first/last mile), with per-leg `depart_at`/`arrive_at`/`line`/`board_stop`/`alight_stop`.
- **46 sourced crime zones**; heatmap renders **only in Safe Mode**.
- **Security:** user endpoints (`/api/trips`, `/api/sos`) are **JWT-verified (IDOR-safe)**,
  rate-limited, CORS-allowlisted; all time logic is **IST** regardless of host timezone.
- **SOS** is multi-channel; **Marg AI** is a floating button (top-right) with Groq fail-over.
- `node test/audit.js` → **16/16**. `npm run build` → **clean**, no secrets in `dist`.
- Git: initialized, **1 local commit on `master`, not pushed**, working tree clean.

## 4. Repo layout
```
bshack/
  src/                React app (pages/, components/marg/, components/ui/, hooks/, lib/, data/)
  backend/            Express API
    index.js          server (CORS allowlist, trust proxy, rate limits)
    routes/           routes.js safety.js chat.js sos.js trips.js
    lib/              time.js planner.js osrm.js auth.js limits.js validate.js cache.js
    data/             transit.js (metro/rail/bus graph) · zones.js (46 crime zones)
    scripts/seedZones.js   test/audit.js   Procfile (web: node index.js)
    .env  .env.example      ← backend secrets (gitignored)
  supabase/schema.sql  RLS schema + 15-zone seed (idempotent)
  .env  .env.example     ← frontend VITE_* vars (gitignored)
  vercel.json  .vercelignore   DEPLOY.md  DONE.md  HANDOFF.md  SOURCES.md
```
**Secrets live in `backend/.env` (service_role, Groq x2, Twilio) and root `.env`
(VITE_SUPABASE_*). Both are gitignored — only the `*.env.example` templates are committed.**

## 5. Environment variables to set in the dashboards
Read the real values from the local `.env` files (or ask the user). **Never commit them.**

**Railway (backend)** — Railway injects `PORT` automatically, don't set it:
| Var | Source |
|-----|--------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `backend/.env` |
| `GROQ_API_KEY`, `GROQ_API_KEY_2` | `backend/.env` (backup = auto fail-over) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | `backend/.env` |
| `FRONTEND_URL` | the Vercel URL — set in Step D |

**Vercel (frontend):**
| Var | Source |
|-----|--------|
| `VITE_BACKEND_URL` | the Railway URL from Step B (HTTPS, no trailing slash) |
| `VITE_SUPABASE_URL` | root `.env` |
| `VITE_SUPABASE_ANON_KEY` | root `.env` (the **anon** key — never service_role) |

## 6. Deployment — guide the user through these, one at a time
`DEPLOY.md` has the same flow with extra detail; follow it. Ask the user at every ⟶ ASK.

- **Step A — GitHub repo & push.** ⟶ ASK the user to create an **empty** repo on github.com
  (no README) and paste its URL. Then run:
  `git branch -M main` · `git remote add origin <url>` · `git push -u origin main`.
  Verify: the repo shows the files on GitHub. (Confirm `.env` files are NOT there.)
- **Step B — Backend on Railway.** ⟶ ASK the user to create a Railway project from the repo,
  set **Root Directory = `backend`**, and add the Railway env vars (Step 5). Deploy. ⟶ ASK
  for the public URL. Verify: `GET <url>/` returns `{"status":"Marg API online", ...}`.
- **Step C — Frontend on Vercel.** ⟶ ASK the user to import the repo (framework auto =
  Vite), add the Vercel env vars (Step 5, `VITE_BACKEND_URL` = the Railway URL). Deploy.
  ⟶ ASK for the Vercel URL.
- **Step D — Wire CORS.** ⟶ ASK the user to set `FRONTEND_URL` = the exact Vercel origin in
  Railway and redeploy. (The backend rejects any other origin — no `*` in prod.)
- **Step E — Supabase.** ⟶ ASK the user to paste `supabase/schema.sql` into the Supabase SQL
  Editor and Run (idempotent). Optional: `cd backend ; $env:SEED_DB=1 ; npm run seed` to
  persist all 46 zones. (App works without this via the seed-merge.)
- **Step F — Smoke test** the live Vercel URL (see §7).

## 7. Post-deploy smoke test
- Open the Vercel URL → "Explore in demo mode".
- Origin → destination → **Find Routes** → routes show with clock times.
- Open a route → **Route Details** shows board/alight times + the map polyline.
- Toggle **Women Safety Mode** → crime circles appear on the map.
- **Marg AI** (top-right) replies; **SOS** shows the confirmation card.
- If the amber **"Backend unreachable"** banner shows → `VITE_BACKEND_URL` is wrong or
  `FRONTEND_URL`/CORS doesn't match. Re-check Steps B–D.

## 8. Gotchas / things to know
- **Twilio trial** sends SMS only to numbers **verified in the Twilio console**; others fail
  with error 21608 (caught, never 500s). Alarm + browser notification + in-app card always
  fire regardless. To let a judge get the SMS: verify their number, or upgrade (~$15).
- **OSRM + Nominatim** are free public servers with no SLA / rate limits — fine for a demo,
  self-host for real traffic (see `SOURCES.md`).
- **Demo bypass:** "Explore in demo mode" sets a localStorage flag so the app is always usable
  without Supabase auth — keep it for judging.
- **Everything degrades gracefully:** if any key is missing/wrong, the app shows the banner
  and falls back (estimated routes, local AI reply, seed heatmap) — it never crashes.
- **Keys:** all on free tiers; the user has chosen **not** to rotate them. Just keep them out
  of committed files (they already are).

## 9. Read these for deeper detail
- `DEPLOY.md` — exact Railway + Vercel + Supabase dashboard steps.
- `DONE.md` — everything that was built and how it was verified (incl. the feature waves).
- `HANDOFF.md` — the original full build spec / data contracts / feature detail.
- `SOURCES.md` — every transit + crime data source and its license/terms.
- `backend/test/audit.js` — run `node test/audit.js` from `backend/` to confirm health (16/16).
