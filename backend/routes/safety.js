const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')
const { SEED_ZONES } = require('../data/zones')
const { istHour, isNightIST } = require('../lib/time')
const { clampStr } = require('../lib/validate')

// GET /api/safety/heatmap?city=chennai&hour=21
router.get('/heatmap', async (req, res) => {
  try {
    const city = (clampStr(req.query.city, 40) || 'chennai').toLowerCase()
    const hourParam = parseInt(req.query.hour, 10)
    // Time-of-day is IST regardless of server timezone (TASK 4A1).
    const currentHour = Number.isInteger(hourParam) && hourParam >= 0 && hourParam < 24 ? hourParam : istHour()
    const night = isNightIST(currentHour)

    let zones = SEED_ZONES
    let source = 'seed'

    // Prefer live Supabase data when configured; fall back to the seed list.
    // Use whichever is richer so the heatmap never looks empty.
    if (supabase) {
      const { data, error } = await supabase.from('heatmap_zones').select('*').eq('city', city)
      if (!error && data?.length >= SEED_ZONES.length) {
        zones = data
        source = 'supabase'
      } else if (!error && data?.length) {
        const byName = new Map(SEED_ZONES.map((z) => [z.area_name, z]))
        data.forEach((z) => byName.set(z.area_name, z))
        zones = [...byName.values()]
        source = 'supabase+seed'
      }
    }

    // Show ALL known risk zones regardless of hour; annotate the night-peaking
    // ones so the frontend can style them. Route scoring handles time-of-day.
    const annotated = zones.map((z) => ({
      ...z,
      currently_active: z.active_hours === 'all' || (z.active_hours === 'night' ? night : !night),
    }))

    res.json({ zones: annotated, count: annotated.length, hour: currentHour, source })
  } catch (err) {
    console.error('[Safety]', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

module.exports = router
