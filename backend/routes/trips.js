const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')
const { requireAuth } = require('../lib/auth')
const { clampStr, isValidLatLng } = require('../lib/validate')

// All trip access is scoped to the authenticated user (req.authUser, set by
// requireAuth from a verified JWT). The body's user_id is never trusted — this
// closes the IDOR where any UUID could read/write another user's trips
// (TASK 5A #1, TASK 4 #6).

// POST /api/trips — save a trip for the authenticated user.
router.post('/', requireAuth, async (req, res) => {
  try {
    if (!supabase) return res.json({ saved: false, reason: 'supabase-not-configured' })
    const b = req.body || {}
    // Validate optional coordinates; drop the trip rather than store garbage.
    const coordsOk =
      [b.from_lat, b.from_lng, b.to_lat, b.to_lng].every((v) => typeof v === 'number') &&
      isValidLatLng(b.from_lat, b.from_lng) &&
      isValidLatLng(b.to_lat, b.to_lng)
    if (!coordsOk) return res.status(400).json({ saved: false, error: 'Invalid trip coordinates' })

    const { data, error } = await supabase
      .from('trips')
      .insert({
        user_id: req.authUser.id, // verified uid, NOT req.body.user_id
        from_name: clampStr(b.from_name, 120),
        from_lat: b.from_lat,
        from_lng: b.from_lng,
        to_name: clampStr(b.to_name, 120),
        to_lat: b.to_lat,
        to_lng: b.to_lng,
        route_data: b.route_data ?? null,
        safe_mode: Boolean(b.safe_mode),
      })
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('[Trips POST]', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// GET /api/trips — recent history for the authenticated user only.
router.get('/', requireAuth, async (req, res) => {
  try {
    if (!supabase) return res.json([])
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', req.authUser.id)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('[Trips GET]', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

module.exports = router
