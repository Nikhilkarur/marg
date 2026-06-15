const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')
const { verifyUser } = require('../lib/auth')
const { clampStr, sanitizePhone, isValidLatLng } = require('../lib/validate')
const { istParts } = require('../lib/time')

function getTwilioClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null
  return require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
}

// Per-user (or per-IP) 30s throttle so a double-tap can't fire multiple real
// SMS and drain the Twilio balance (TASK 4 #15 / TASK 5C). In-memory.
const lastSos = new Map()
const SOS_COOLDOWN_MS = 30 * 1000

// POST /api/sos  { lat, lng, user_name, contact_name?, contact_number? }
// Auth optional: a logged-in user's saved contact is used; demo users may pass
// their own contact in the body. We NEVER read a contact via a body user_id.
router.post('/', async (req, res) => {
  try {
    const user = await verifyUser(req) // null for demo / no token
    const throttleKey = user?.id || req.ip
    const now = Date.now()
    const prev = lastSos.get(throttleKey)
    if (prev && now - prev < SOS_COOLDOWN_MS) {
      return res.status(429).json({
        success: false,
        error: 'recently_sent',
        retry_after_s: Math.ceil((SOS_COOLDOWN_MS - (now - prev)) / 1000),
      })
    }

    let lat = typeof req.body.lat === 'number' ? req.body.lat : null
    let lng = typeof req.body.lng === 'number' ? req.body.lng : null
    if (lat !== null && lng !== null && !isValidLatLng(lat, lng)) {
      lat = null // ignore garbage coordinates rather than sending bad ones
      lng = null
    }
    const user_name = clampStr(req.body.user_name, 80) || 'A Marg user'

    // Resolve the emergency contact: prefer the authenticated user's saved row
    // (looked up by the VERIFIED uid — no IDOR); else a contact supplied in the
    // body (demo mode sends its own localStorage contact).
    let contact = {
      contact_name: clampStr(req.body.contact_name, 80),
      contact_number: sanitizePhone(req.body.contact_number),
    }
    if (user && supabase) {
      const { data } = await supabase
        .from('emergency_contacts')
        .select('contact_name, contact_number')
        .eq('user_id', user.id)
        .single()
      if (data?.contact_number) contact = data
    }

    const number = sanitizePhone(contact.contact_number)
    if (!number) return res.status(400).json({ success: false, error: 'No valid emergency contact available' })

    const mapsLink = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : 'Location unavailable'
    const p = istParts()
    const timeStr = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')} IST`
    const message = `SOS ALERT: ${user_name} needs help.\n\nLast known location:\n${mapsLink}\n\nSent via Marg at ${timeStr}.`

    const to = number.startsWith('+') ? number.replace(/\s/g, '') : `+91${number.replace(/\s/g, '')}`

    // Set the throttle now that we're committing to an attempt.
    lastSos.set(throttleKey, now)

    const client = getTwilioClient()
    let smsSent = false
    let smsError = null
    if (client && process.env.TWILIO_FROM_NUMBER) {
      try {
        await client.messages.create({ body: message, from: process.env.TWILIO_FROM_NUMBER, to })
        smsSent = true
      } catch (smsErr) {
        // Trial accounts reject unverified numbers with code 21608 — caught here
        // so SOS never 500s; the alarm/notification/in-app card still fire.
        smsError = smsErr.code === 21608 ? 'unverified_number_trial' : 'sms_failed'
        console.warn('[SOS] Twilio SMS failed:', smsErr.code || smsErr.message)
      }
    } else {
      console.warn('[SOS] Twilio not configured — SMS skipped for', to)
    }

    // Log the incident only for an authenticated user (verified uid).
    if (user && supabase) {
      try {
        await supabase.from('incidents').insert({
          user_id: user.id,
          latitude: lat,
          longitude: lng,
          status: 'open',
          source: 'sos',
          display_name: user_name,
        })
      } catch {
        /* incident logging is best-effort */
      }
    }

    res.json({
      success: true,
      sent_to: contact.contact_name || to,
      sms_sent: smsSent,
      sms_error: smsError,
      location_known: Boolean(lat && lng),
      channels: [smsSent ? 'sms' : null, 'browser_notification', 'in_app_alert'].filter(Boolean),
    })
  } catch (err) {
    console.error('[SOS]', err.message)
    res.status(500).json({ success: false, error: 'Internal error' })
  }
})

module.exports = router
