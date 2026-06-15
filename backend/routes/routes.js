const express = require('express')
const router = express.Router()
const { planJourney } = require('../lib/planner')
const { istHour, istMinutesSinceMidnight, istParts } = require('../lib/time')
const { isNum, inChennaiBounds } = require('../lib/validate')

// POST /api/routes  { from_lat, from_lng, to_lat, to_lng, safe_mode, hour?, depart_min? }
router.post('/', async (req, res) => {
  try {
    const { from_lat, from_lng, to_lat, to_lng, safe_mode, hour, depart_min, mode } = req.body || {}
    const modeFilter = ['metro', 'train', 'bus', 'auto'].includes(mode) ? mode : null

    if (![from_lat, from_lng, to_lat, to_lng].every(isNum)) {
      return res.status(400).json({ error: 'from_lat, from_lng, to_lat, to_lng are required numbers' })
    }
    // #8 / TASK5: reject coordinates outside the Chennai region instead of
    // planning a nonsense trip (and snapping it to a random Chennai station).
    if (!inChennaiBounds(from_lat, from_lng) || !inChennaiBounds(to_lat, to_lng)) {
      return res.status(400).json({ error: 'Coordinates must be within the Chennai region' })
    }

    // Departure time T. Default to IST "now"; allow explicit overrides for
    // testing and for the contract's `hour` field. All time-of-day logic is IST
    // regardless of server timezone (lib/time.js).
    let departMin
    let currentHour
    if (isNum(depart_min) && depart_min >= 0 && depart_min < 1440) {
      departMin = Math.floor(depart_min)
      currentHour = Math.floor(departMin / 60)
    } else if (isNum(hour) && hour >= 0 && hour < 24) {
      currentHour = Math.floor(hour)
      departMin = currentHour * 60 + istParts().minute
    } else {
      departMin = istMinutesSinceMidnight()
      currentHour = istHour()
    }

    const { routes } = await planJourney({
      fromLat: from_lat,
      fromLng: from_lng,
      toLat: to_lat,
      toLng: to_lng,
      departMin,
      hour: currentHour,
      safeMode: Boolean(safe_mode),
      mode: modeFilter,
    })

    res.json({ routes, hour: currentHour })
  } catch (err) {
    console.error('[Routes]', err.message) // log detail server-side only
    res.status(500).json({ error: 'Internal error planning routes' }) // generic to client
  }
})

module.exports = router
