// Shared input validation & sanitization. Inputs from the client are untrusted
// (TASK 5C #13): we bound coordinates to the Chennai region, clamp string
// lengths, and normalise phone numbers before anything touches a DB or an API.

// Generous greater-Chennai box (covers Tambaram/Chengalpattu fringe). Anything
// outside is almost certainly a bug or abuse, not a real Chennai trip.
const CHENNAI_BOUNDS = { latMin: 12.5, latMax: 13.8, lngMin: 79.7, lngMax: 80.6 }

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

function isValidLatLng(lat, lng) {
  return isNum(lat) && isNum(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

function inChennaiBounds(lat, lng) {
  return (
    isNum(lat) &&
    isNum(lng) &&
    lat >= CHENNAI_BOUNDS.latMin &&
    lat <= CHENNAI_BOUNDS.latMax &&
    lng >= CHENNAI_BOUNDS.lngMin &&
    lng <= CHENNAI_BOUNDS.lngMax
  )
}

/** Trim + hard-cap a string; non-strings become ''. */
function clampStr(s, max = 200) {
  if (typeof s !== 'string') return ''
  return s.trim().slice(0, max)
}

/** Keep only +, digits and spaces; cap length. Returns '' if implausible. */
function sanitizePhone(s) {
  if (typeof s !== 'string') return ''
  const cleaned = s.replace(/[^\d+\s]/g, '').trim().slice(0, 20)
  const digits = cleaned.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15 ? cleaned : ''
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v)

module.exports = { CHENNAI_BOUNDS, isNum, isValidLatLng, inChennaiBounds, clampStr, sanitizePhone, isUuid, UUID_RE }
