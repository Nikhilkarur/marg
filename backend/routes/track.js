const express = require('express')
const router = express.Router()
const { clampStr } = require('../lib/validate')

// Live trip-tracking: a lightweight, in-memory relay so a trusted contact can
// follow a journey via a share link. No DB — sessions live in memory and expire,
// which is exactly right for ephemeral "watch me get home" tracking.
//
// Flow: the traveller's app POSTs their location to /api/track/:id every few
// seconds; the contact opens /track/:id in the web app, which GETs the latest
// fix and re-polls. Sessions auto-expire 2h after the last update.

const sessions = new Map() // id -> { lat, lng, updatedAt, dest, ended }
const TTL_MS = 2 * 60 * 60 * 1000

function sweep() {
  const now = Date.now()
  for (const [id, s] of sessions) if (now - s.updatedAt > TTL_MS) sessions.delete(id)
}
setInterval(sweep, 10 * 60 * 1000).unref?.()

const ID_RE = /^[a-z0-9]{6,40}$/i

// POST /api/track/:id  { lat, lng, dest?, ended? } — push a location update.
router.post('/:id', (req, res) => {
  const id = req.params.id
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'bad id' })
  const { lat, lng, dest, ended } = req.body || {}
  if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'bad coordinates' })
  }
  const prev = sessions.get(id) || {}
  sessions.set(id, {
    lat,
    lng,
    dest: dest && typeof dest.lat === 'number' ? { lat: dest.lat, lng: dest.lng, name: clampStr(dest.name, 80) } : prev.dest || null,
    ended: !!ended,
    updatedAt: Date.now(),
  })
  res.json({ ok: true })
})

// GET /api/track/:id — latest known location for the viewer page.
router.get('/:id', (req, res) => {
  const id = req.params.id
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'bad id' })
  const s = sessions.get(id)
  if (!s) return res.status(404).json({ error: 'not found', active: false })
  res.json({
    active: !s.ended,
    lat: s.lat,
    lng: s.lng,
    dest: s.dest,
    updatedAt: s.updatedAt,
    ageSeconds: Math.round((Date.now() - s.updatedAt) / 1000),
  })
})

module.exports = router
