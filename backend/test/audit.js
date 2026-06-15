// End-to-end backend audit (TASK 3). Asserts the §4 data-contract shapes for
// every endpoint, graceful degradation when keys are unset, edge cases, and
// host-timezone-independent IST. Prints a pass/fail table and exits non-zero on
// any failure.
//
// Usage:
//   node test/audit.js
//   BASE=http://localhost:4000 DEGRADED=http://localhost:4100 node test/audit.js
//
// BASE      = a fully-configured backend (Supabase/Groq/Twilio keys present).
// DEGRADED  = (optional) a backend started with those keys UNSET, e.g.:
//   GROQ_API_KEY= SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= \
//   TWILIO_ACCOUNT_SID= TWILIO_AUTH_TOKEN= PORT=4100 node index.js
// Degradation checks are skipped (not failed) if DEGRADED isn't reachable.

const { execSync } = require('child_process')
const path = require('path')

const BASE = process.env.BASE || 'http://localhost:4000'
const DEGRADED = process.env.DEGRADED || 'http://localhost:4100'

const results = []
function record(section, name, pass, detail = '') {
  results.push({ section, name, pass, detail })
  const tag = pass ? 'PASS' : 'FAIL'
  console.log(`  [${tag}] ${name}${detail ? ' — ' + detail : ''}`)
}

async function post(base, p, body, headers = {}) {
  const res = await fetch(base + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json }
}
async function get(base, p, headers = {}) {
  const res = await fetch(base + p, { headers })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* */
  }
  return { status: res.status, json }
}

const HHMM = /^\d{2}:\d{2}$/
const CHENNAI = { from_lat: 13.085, from_lng: 80.2101, to_lat: 13.0418, to_lng: 80.2341 }

async function reachable(base) {
  try {
    const r = await fetch(base + '/', { signal: AbortSignal.timeout(2500) })
    return r.ok
  } catch {
    return false
  }
}

async function contractTests() {
  console.log('\n== A. Data-contract shapes (BASE) ==')

  // routes
  const r = await post(BASE, '/api/routes', { ...CHENNAI, safe_mode: true, depart_min: 540 })
  const routes = r.json?.routes
  const route0 = routes?.[0]
  const routeShapeOk =
    r.status === 200 &&
    Array.isArray(routes) &&
    routes.length > 0 &&
    ['id', 'label', 'modes', 'transfers', 'steps', 'coordinates', 'total_time', 'total_fare', 'safety_score', 'depart_at', 'arrive_at'].every((k) => k in route0)
  record('A', 'POST /api/routes returns ranked routes with all contract fields', routeShapeOk, `${routes?.length || 0} routes`)

  // per-leg schedule fields on a transit leg
  const transitLeg = route0?.steps?.find((s) => s.mode === 'metro' || s.mode === 'train' || s.mode === 'bus')
  const legOk =
    !!transitLeg &&
    HHMM.test(transitLeg.depart_at) &&
    HHMM.test(transitLeg.arrive_at) &&
    typeof transitLeg.wait_min === 'number' &&
    'line' in transitLeg &&
    'board_stop' in transitLeg &&
    'alight_stop' in transitLeg
  record('A', 'Transit leg has depart_at/arrive_at/wait_min/line/board_stop/alight_stop', legOk, transitLeg ? `${transitLeg.line} ${transitLeg.depart_at}->${transitLeg.arrive_at}` : 'no transit leg')

  // coords GeoJSON [lng,lat]
  const c0 = route0?.coordinates?.[0]
  const coordsOk = Array.isArray(c0) && c0[0] > 79 && c0[0] < 81 && c0[1] > 12 && c0[1] < 14
  record('A', 'Route coordinates are GeoJSON [lng,lat]', coordsOk, c0 ? `[${c0[0]},${c0[1]}]` : 'none')

  // heatmap
  const h = await get(BASE, '/api/safety/heatmap?city=chennai&hour=21')
  const z0 = h.json?.zones?.[0]
  const heatOk =
    h.status === 200 &&
    Array.isArray(h.json?.zones) &&
    h.json.zones.length >= 40 &&
    ['area_name', 'latitude', 'longitude', 'radius_m', 'risk_score', 'currently_active'].every((k) => k in z0)
  record('A', 'GET /api/safety/heatmap returns ≥40 zones with contract fields', heatOk, `${h.json?.count} zones, source=${h.json?.source}`)

  // chat
  const ch = await post(BASE, '/api/chat', { message: 'Is my route safe tonight?', safe_mode: true })
  const chatOk = ch.status === 200 && typeof ch.json?.reply === 'string' && ch.json.reply.length > 0 && 'source' in ch.json
  record('A', 'POST /api/chat returns { reply, source }', chatOk, `source=${ch.json?.source}`)

  // sos (unverified number → 21608 caught; never 500)
  const sos = await post(BASE, '/api/sos', { lat: 13.08, lng: 80.21, user_name: 'Audit', contact_name: 'Mom', contact_number: '9999999999' })
  const sosOk =
    sos.status === 200 &&
    sos.json?.success === true &&
    sos.json?.sms_sent === false &&
    Array.isArray(sos.json?.channels) &&
    sos.json.channels.includes('browser_notification')
  record('A', 'POST /api/sos succeeds; Twilio 21608 caught (sms_sent=false, no 500)', sosOk, `sms_error=${sos.json?.sms_error}`)

  // trips require auth (IDOR closed) — must 401, not crash
  const tg = await get(BASE, '/api/trips')
  record('A', 'GET /api/trips without token → 401 (IDOR closed, no crash)', tg.status === 401, `status=${tg.status}`)
  const tp = await post(BASE, '/api/trips', { from_lat: 13, from_lng: 80.2, to_lat: 13.1, to_lng: 80.3, user_id: 'demo' })
  record('A', 'POST /api/trips with body user_id but no token → 401 (not 500)', tp.status === 401, `status=${tp.status}`)
}

async function edgeTests() {
  console.log('\n== B. Edge cases (BASE) ==')

  const oob = await post(BASE, '/api/routes', { from_lat: 28.6, from_lng: 77.2, to_lat: 13.0418, to_lng: 80.2341 })
  record('B', 'Out-of-Chennai coordinates → 400', oob.status === 400, `status=${oob.status}`)

  const bad = await post(BASE, '/api/routes', { from_lat: 'x', from_lng: 80, to_lat: 13, to_lng: 80 })
  record('B', 'Non-numeric coordinates → 400', bad.status === 400, `status=${bad.status}`)

  const short = await post(BASE, '/api/routes', { from_lat: 13.085, from_lng: 80.2101, to_lat: 13.0853, to_lng: 80.2104 })
  const shortOk = short.status === 200 && short.json.routes.length === 1 && short.json.routes[0].modes.join() === 'walk'
  record('B', 'Origin ≈ destination → single short walk', shortOk, short.json?.routes?.map((x) => x.id).join(','))

  // double-tap SOS throttle (wait for any prior cooldown to be irrelevant: new IP key per run is same; first call may 429 if a recent test ran — handle both)
  const s1 = await post(BASE, '/api/sos', { lat: 13.08, lng: 80.21, contact_number: '9999999999' })
  const s2 = await post(BASE, '/api/sos', { lat: 13.08, lng: 80.21, contact_number: '9999999999' })
  const throttleOk = s2.status === 429 || s1.status === 429
  record('B', 'Repeat SOS within 30s → 429 (double-tap safe)', throttleOk, `s1=${s1.status} s2=${s2.status}`)

  const r = await post(BASE, '/api/routes', { ...CHENNAI, depart_min: 540 })
  const timesOk = r.json?.routes?.every((rt) => HHMM.test(rt.depart_at) && HHMM.test(rt.arrive_at))
  record('B', 'Every route has HH:MM depart_at/arrive_at', !!timesOk)
}

async function degradationTests() {
  console.log('\n== C. Graceful degradation (DEGRADED — keys unset) ==')
  if (!(await reachable(DEGRADED))) {
    record('C', 'DEGRADED backend reachable', false, `SKIPPED — start one on ${DEGRADED} (see header)`)
    results[results.length - 1].skip = true
    return
  }

  const r = await post(DEGRADED, '/api/routes', { ...CHENNAI, depart_min: 540 })
  record('C', 'routes work without Supabase (no DB needed)', r.status === 200 && r.json?.routes?.length > 0)

  const h = await get(DEGRADED, '/api/safety/heatmap?city=chennai')
  record('C', 'heatmap falls back to seed source when Supabase unset', h.status === 200 && h.json?.source === 'seed', `source=${h.json?.source}`)

  const ch = await post(DEGRADED, '/api/chat', { message: 'safe at night?', safe_mode: true })
  record('C', 'chat falls back to local reply when Groq key unset', ch.status === 200 && ch.json?.source === 'local', `source=${ch.json?.source}`)

  const sos = await post(DEGRADED, '/api/sos', { lat: 13.08, lng: 80.21, contact_number: '9999999999' })
  const sosOk = sos.status === 200 && sos.json?.success === true && sos.json?.sms_sent === false && sos.json?.channels?.includes('in_app_alert')
  record('C', 'sos works without Twilio (alarm/notification/in-app still fire)', sosOk, `sms_sent=${sos.json?.sms_sent}`)

  const tp = await post(DEGRADED, '/api/trips', { from_lat: 13, from_lng: 80.2, to_lat: 13.1, to_lng: 80.3 })
  record('C', 'trips POST without auth → 401 even with Supabase unset (no crash)', tp.status === 401, `status=${tp.status}`)
}

function istTests() {
  console.log('\n== D. IST is host-timezone-independent ==')
  // Run the time helper in a child process pinned to America/Los_Angeles and
  // assert Chennai night detection for fixed UTC instants (DoD #5).
  const snippet =
    "const t=require('./lib/time');" +
    "const n=new Date('2024-01-01T18:00:00Z');" + // 23:30 IST → night
    "const d=new Date('2024-01-01T06:00:00Z');" + // 11:30 IST → day
    'process.stdout.write(JSON.stringify({h:t.istParts(n).hour,night:t.isNightIST(t.istParts(n).hour),day:t.isNightIST(t.istParts(d).hour)}))'
  try {
    const out = execSync(`node -e "${snippet}"`, {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, TZ: 'America/Los_Angeles' },
    }).toString()
    const o = JSON.parse(out)
    record('D', 'Under TZ=America/Los_Angeles, 18:00Z reads as 23:30 IST hour=23', o.h === 23, `hour=${o.h}`)
    record('D', 'Chennai night detected at 23:30 IST regardless of host TZ', o.night === true)
    record('D', 'Chennai daytime detected at 11:30 IST regardless of host TZ', o.day === false)
  } catch (e) {
    record('D', 'IST subprocess test', false, e.message)
  }
}

function printTable() {
  console.log('\n================= AUDIT SUMMARY =================')
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n)
  let pass = 0
  let fail = 0
  let skip = 0
  for (const r of results) {
    if (r.skip) skip++
    else if (r.pass) pass++
    else fail++
    const tag = r.skip ? 'SKIP' : r.pass ? 'PASS' : 'FAIL'
    console.log(`${r.section} | ${tag} | ${pad(r.name, 60)}${r.detail ? ' | ' + r.detail : ''}`)
  }
  console.log('------------------------------------------------')
  console.log(`TOTAL: ${pass} passed, ${fail} failed, ${skip} skipped (of ${results.length})`)
  console.log('================================================')
  return fail
}

;(async () => {
  console.log(`Marg backend audit — BASE=${BASE}`)
  if (!(await reachable(BASE))) {
    console.error(`BASE backend not reachable at ${BASE}. Start it: (cd backend && node index.js)`)
    process.exit(2)
  }
  await contractTests()
  await edgeTests()
  await degradationTests()
  istTests()
  const fail = printTable()
  process.exit(fail > 0 ? 1 : 0)
})()
