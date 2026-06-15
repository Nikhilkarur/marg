# Marg — Deployment Guide (Railway + Vercel + Supabase)

Architecture: **Frontend → Vercel** (Vite static SPA) · **Backend → Railway**
(Node/Express) · **DB/Auth → Supabase**. All free-tier friendly.

```
Browser ──HTTPS──▶ Vercel (frontend)
   │  fetch VITE_BACKEND_URL
   └──HTTPS──▶ Railway (backend) ──▶ Supabase / Groq / Twilio / OSRM / Nominatim
```

---

## 0. Prerequisites
- The repo must be in **Git** and pushed to GitHub (Railway/Vercel deploy from it):
  ```powershell
  cd C:\Users\nkk77\Desktop\bshack
  git init ; git add . ; git commit -m "Marg ready for deploy"
  # create a GitHub repo, then:
  git branch -M main ; git remote add origin <your-repo-url> ; git push -u origin main
  ```
- `.env` and `backend/.env` are gitignored — confirm they are NOT committed
  (`git status` should not list them). Set real values in the dashboards instead.
- **Rotate** the Supabase service_role / Groq / Twilio secrets before going public.

## 1. Supabase
1. Open your project → **SQL Editor** → paste all of `supabase/schema.sql` → **Run**.
   It's idempotent (safe to re-run; leaves exactly the seeded zones, no dupes).
2. (Optional — the API already merges the seed, but to persist all 46 zones in the
   DB) from your machine: `cd backend ; $env:SEED_DB=1 ; npm run seed`.
3. Note your **Project URL**, **anon** key, and **service_role** key (Settings → API).
4. Auth → optionally disable "Confirm email" for instant signups in a demo.

## 2. Railway (backend)
1. **New Project → Deploy from GitHub repo** → pick this repo.
2. In the service → **Settings → Root Directory = `backend`** (important — the
   backend is a subfolder). Railway then reads `backend/railway.json` + Procfile.
3. **Variables** (Settings → Variables) — add:

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | your Supabase Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (backend only) |
   | `GROQ_API_KEY` | primary Groq key |
   | `GROQ_API_KEY_2` | backup Groq key (auto fail-over if the primary is rate-limited / out of quota) |
   | `GROQ_MODEL` | `llama-3.3-70b-versatile` |
   | `TWILIO_ACCOUNT_SID` | (optional) Twilio SID |
   | `TWILIO_AUTH_TOKEN` | (optional) Twilio token |
   | `TWILIO_FROM_NUMBER` | (optional) Twilio number, e.g. `+1906...` |
   | `FRONTEND_URL` | set **after** step 3 to your Vercel URL (see step 4) |

   Do **not** set `PORT` — Railway injects it (the app reads `process.env.PORT`).
4. Deploy → copy the public URL, e.g. `https://marg-backend-production.up.railway.app`.
   Health check: visiting `/` returns `{"status":"Marg API online", ...}`.

## 3. Vercel (frontend)
1. **Add New → Project** → import this repo. Framework preset auto-detects **Vite**
   (config is in `vercel.json`; build `npm run build`, output `dist`).
2. **Environment Variables**:

   | Variable | Value |
   |---|---|
   | `VITE_BACKEND_URL` | the Railway URL from step 2.4 (HTTPS, **no trailing slash**) |
   | `VITE_SUPABASE_URL` | your Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | the **anon** key (never service_role) |

3. Deploy → copy the production URL, e.g. `https://marg.vercel.app`.

## 4. Wire CORS (connect the two)
1. Back in **Railway → Variables**, set `FRONTEND_URL` to your exact Vercel origin
   (e.g. `https://marg.vercel.app`, no trailing slash). For multiple domains
   (custom domain, etc.) comma-separate them. Railway redeploys.
2. The backend's CORS allowlist now permits the frontend (no `*` in prod).

## 5. Post-deploy smoke test
- Open the Vercel URL → "Explore in demo mode".
- Enter origin/destination → **Find Routes** → routes appear with clock times.
- Open a route → **Route Details** shows board/alight times + the map polyline.
- Toggle **Women Safety Mode** → crime circles appear on the map.
- Tap **SOS** → confirmation card (SMS only to Twilio-verified numbers on trial).
- If you see the amber **"Backend unreachable"** banner, `VITE_BACKEND_URL` is
  wrong or CORS/`FRONTEND_URL` doesn't match — re-check steps 2–4.

## Notes
- **HTTPS both sides** (Vercel + Railway are HTTPS) → no mixed-content blocking.
- `trust proxy` is enabled so rate-limiting sees real client IPs behind Railway.
- Public OSRM/Nominatim have no SLA — self-host for production traffic (see SOURCES.md).
- Everything degrades gracefully if a key is missing (verified by `npm test` in `backend/`).
