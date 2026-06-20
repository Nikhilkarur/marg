// Shared SOS engine — used by the manual SOS button AND the AI Audio Guardian so
// both fire the exact same alert flow (geolocation → backend SMS → notification →
// local log + cooldown). Keeping this in one place means the auto-trigger is
// never a second-class path.
import { triggerSos } from '@/lib/api'

export const SOS_COOLDOWN_S = 30 // matches the backend per-user throttle

export function getEmergencyContact() {
  try {
    const raw = localStorage.getItem('marg_sos_contact')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { name: 'Emergency Contact', number: '9876543210' }
}

export function formatNumber(number) {
  return number?.startsWith('+')
    ? number
    : `+91 ${String(number || '').replace(/(\d{5})(\d{5})/, '$1 $2')}`
}

export function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.value = 880
    gain.gain.value = 0.15
    osc.start()
    const now = ctx.currentTime
    for (let i = 0; i < 6; i++) {
      gain.gain.setValueAtTime(0.15, now + i * 0.2)
      gain.gain.setValueAtTime(0, now + i * 0.2 + 0.1)
    }
    osc.stop(now + 1.2)
  } catch {}
}

async function sendNotification(contactName, lat, lng) {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'default') await Notification.requestPermission()
  if (Notification.permission !== 'granted') return false
  const loc = lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Location pending'
  new Notification('SOS Alert Sent — Marg', {
    body: `Emergency alert sent to ${contactName}. Location: ${loc}`,
    icon: '/vite.svg',
    tag: 'marg-sos',
    requireInteraction: true,
  })
  return true
}

function saveAlert(alert) {
  try {
    const key = 'marg_sos_log'
    const log = JSON.parse(localStorage.getItem(key) || '[]')
    log.unshift(alert)
    localStorage.setItem(key, JSON.stringify(log.slice(0, 20)))
  } catch {}
}

export function sosCooldownRemaining() {
  const last = Number(localStorage.getItem('marg_sos_last') || 0)
  return last ? Math.max(0, SOS_COOLDOWN_S - Math.floor((Date.now() - last) / 1000)) : 0
}

/**
 * Fire a full SOS alert. `trigger` records whether a human pressed the button or
 * the AI Guardian auto-fired it (shown in the confirmation + saved to the log).
 * Returns the same result shape the SOS modal renders.
 */
export async function sendSos(user, { trigger = 'manual' } = {}) {
  playAlarm()
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])

  const contact = getEmergencyContact()
  const pos = await new Promise((resolve) =>
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 })
      : resolve(null),
  )
  const lat = pos?.coords?.latitude ?? null
  const lng = pos?.coords?.longitude ?? null
  const timestamp = new Date()
  const mapsUrl = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : null

  const notified = await sendNotification(contact.name, lat, lng)

  let backendOk = false
  try {
    // No user_id sent — backend derives identity from the session token (IDOR fix).
    const data = await triggerSos({
      lat,
      lng,
      user_name: user?.user_metadata?.full_name || 'Marg User',
      contact_name: contact.name,
      contact_number: contact.number,
      trigger,
    })
    backendOk = data?.success !== false
  } catch {}

  localStorage.setItem('marg_sos_last', String(Date.now())) // start cooldown
  saveAlert({ timestamp: timestamp.toISOString(), lat, lng, contact: contact.name, mapsUrl, trigger })

  return { lat, lng, mapsUrl, timestamp, notified, backendOk, contactName: contact.name, trigger }
}
