// Spectral-fingerprint scream fallback for the Guardian.
//
// YAMNet is a general 521-class classifier; it's accurate but can be flaky to
// load and conservative on a noisy stage. This adds a second, dead-simple
// on-device detector: a frequency "fingerprint" of a known scream. We bucket the
// live mic spectrum into 32 log-spaced bands (200 Hz–8 kHz), L2-normalize it (so
// it matches by spectral *shape*, independent of volume/distance), and compare to
// stored fingerprints via cosine similarity.
//
// Fingerprints come from two places:
//   1. SCREAM_PRINTS below — hardcoded (paste from /fingerprint.html for a
//      permanent, deploy-baked match).
//   2. localStorage 'marg_screamprints' — captured live by /fingerprint.html.
//      Same-origin, so you can lock in the exact clip + room acoustics right
//      before a demo with no rebuild.
//
// Everything is on-device; no audio leaves the phone.

export const BANDS = 32
const FMIN = 200
const FMAX = 8000

// Log-spaced band edges (BANDS + 1 of them). Kept in sync with /fingerprint.html.
const EDGES = (() => {
  const e = new Float32Array(BANDS + 1)
  const lmin = Math.log(FMIN)
  const lmax = Math.log(FMAX)
  for (let i = 0; i <= BANDS; i++) e[i] = Math.exp(lmin + ((lmax - lmin) * i) / BANDS)
  return e
})()

// Turn an analyser's byte spectrum (getByteFrequencyData, 0..255) into a
// 32-band, L2-normalized fingerprint vector. binHz = sampleRate / fftSize.
export function bandsFromBytes(freq, binHz) {
  const out = new Float32Array(BANDS)
  const cnt = new Float32Array(BANDS)
  for (let i = 0; i < freq.length; i++) {
    const f = i * binHz
    if (f < FMIN || f > FMAX) continue
    let b = 0
    while (b < BANDS && f > EDGES[b + 1]) b++
    if (b >= BANDS) continue
    out[b] += freq[i]
    cnt[b] += 1
  }
  for (let b = 0; b < BANDS; b++) if (cnt[b]) out[b] /= cnt[b]
  let n = 0
  for (let b = 0; b < BANDS; b++) n += out[b] * out[b]
  n = Math.sqrt(n) || 1
  for (let b = 0; b < BANDS; b++) out[b] /= n
  return out
}

export function cosine(a, b) {
  let d = 0
  for (let i = 0; i < a.length && i < b.length; i++) d += a[i] * b[i]
  return d
}

// Hardcoded fingerprints (each a length-32 array). Paste output from
// /fingerprint.html here to bake a permanent match into the build.
const SCREAM_PRINTS = [
  // e.g. [0.12, 0.08, ...] // 32 numbers
]

const LS_KEY = 'marg_screamprints'
function lsPrints() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    return Array.isArray(v) ? v.filter((p) => Array.isArray(p) && p.length === BANDS) : []
  } catch {
    return []
  }
}

// Append a captured fingerprint to localStorage (used by the capture tool).
export function savePrint(arr) {
  try {
    const cur = lsPrints()
    cur.push(Array.from(arr))
    localStorage.setItem(LS_KEY, JSON.stringify(cur))
  } catch {}
}

export function clearPrints() {
  try { localStorage.removeItem(LS_KEY) } catch {}
}

// Combined hardcoded + localStorage fingerprints, cached (matchScream runs every
// animation frame; don't re-parse localStorage 60×/s).
let _cache = null
let _cacheAt = 0
function allPrints() {
  const now = Date.now()
  if (_cache && now - _cacheAt < 2000) return _cache
  _cache = SCREAM_PRINTS.concat(lsPrints())
  _cacheAt = now
  return _cache
}

export function hasPrints() {
  return allPrints().length > 0
}

// Best cosine similarity (0..1) of the current spectrum against any stored
// fingerprint. Returns 0 when none are configured (so the caller no-ops).
export function matchScream(freq, binHz) {
  const prints = allPrints()
  if (!prints.length) return 0
  const v = bandsFromBytes(freq, binHz)
  let best = 0
  for (const p of prints) {
    const s = cosine(v, p)
    if (s > best) best = s
  }
  return best
}
