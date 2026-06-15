import { useState, useEffect } from 'react'
import { ShieldAlert, MapPin, MapPinOff, Bell, Clock, ExternalLink, Check } from 'lucide-react'
import { useSafeMode } from '@/hooks/useSafeMode'
import { useAuth } from '@/hooks/useAuth'
import { triggerSos } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function getEmergencyContact() {
  try {
    const raw = localStorage.getItem('marg_sos_contact')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { name: 'Emergency Contact', number: '9876543210' }
}

function playAlarm() {
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

const COOLDOWN_S = 30 // matches the backend per-user throttle

export function SOSButton() {
  const { safeMode } = useSafeMode()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState(null)
  const [sending, setSending] = useState(false)
  const [remaining, setRemaining] = useState(0)

  // Cooldown countdown so a double-tap can't fire multiple real SMS (TASK 4 #15).
  useEffect(() => {
    if (!open || result) return
    const tick = () => {
      const last = Number(localStorage.getItem('marg_sos_last') || 0)
      setRemaining(last ? Math.max(0, COOLDOWN_S - Math.floor((Date.now() - last) / 1000)) : 0)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [open, result])

  const contact = getEmergencyContact()
  const displayNumber = contact.number.startsWith('+')
    ? contact.number
    : `+91 ${contact.number.replace(/(\d{5})(\d{5})/, '$1 $2')}`

  const send = async () => {
    if (sending || remaining > 0) return // debounce double-taps within cooldown
    setSending(true)
    playAlarm()
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])

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
      // No user_id sent — the backend derives identity from the session token
      // and uses the body contact only for demo users (IDOR fix, TASK 5A).
      const data = await triggerSos({
        lat,
        lng,
        user_name: user?.user_metadata?.full_name || 'Marg User',
        contact_name: contact.name,
        contact_number: contact.number,
      })
      backendOk = data?.success !== false
    } catch {}

    localStorage.setItem('marg_sos_last', String(Date.now())) // start cooldown
    const alert = { timestamp: timestamp.toISOString(), lat, lng, contact: contact.name, mapsUrl }
    saveAlert(alert)

    setSending(false)
    setResult({ lat, lng, mapsUrl, timestamp, notified, backendOk, contactName: contact.name })
  }

  const close = () => {
    setOpen(false)
    setResult(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setResult(null) }}
        aria-label="Send emergency SOS"
        className="fixed bottom-20 right-5 z-50 flex size-14 flex-col items-center justify-center rounded-full bg-marg-danger text-white shadow-xl shadow-red-500/30 transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
      >
        {safeMode && (
          <span className="absolute inset-0 animate-ping rounded-full bg-marg-danger/50" />
        )}
        <span className="relative text-xs font-bold tracking-wide">SOS</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm animate-fade-up rounded-2xl bg-white p-6 shadow-2xl">
            {result ? (
              <div className="flex flex-col items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
                  <ShieldAlert className="size-8 text-emerald-600" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-marg-text">Emergency Alert Sent</h2>

                <div className="mt-4 w-full space-y-2 text-left">
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                    <Check className="size-4 shrink-0 text-emerald-600" />
                    <span className="text-sm text-marg-text">Alert sent to <strong>{result.contactName}</strong></span>
                  </div>
                  {result.notified && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                      <Bell className="size-4 shrink-0 text-emerald-600" />
                      <span className="text-sm text-marg-text">Browser notification delivered</span>
                    </div>
                  )}
                  {result.lat ? (
                    <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
                      <MapPin className="size-4 shrink-0 text-blue-600" />
                      <span className="text-sm text-marg-text">{result.lat.toFixed(4)}, {result.lng.toFixed(4)}</span>
                      {result.mapsUrl && (
                        <a href={result.mapsUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-blue-600 hover:text-blue-700">
                          <ExternalLink className="size-4" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
                      <MapPinOff className="size-4 shrink-0 text-gold-600" />
                      <span className="text-sm text-marg-text">Location unavailable — alert sent without coordinates</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                    <Clock className="size-4 shrink-0 text-marg-muted" />
                    <span className="text-sm text-marg-muted">{result.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                </div>

                <Button variant="primary" size="lg" className="mt-5 w-full" onClick={close}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center text-center">
                  <ShieldAlert className="size-14 text-marg-danger" />
                  <h2 className="mt-4 text-xl font-bold text-marg-text">
                    Send SOS Alert?
                  </h2>
                  <p className="mt-2 text-sm text-marg-muted">
                    This will immediately alert <strong>{contact.name}</strong> ({displayNumber}) with your current location.
                  </p>
                </div>
                <div className="mt-6 flex flex-col gap-3">
                  <Button variant="danger" size="lg" onClick={send} disabled={sending || remaining > 0}>
                    <ShieldAlert className="size-5" />
                    {sending ? 'Sending…' : remaining > 0 ? `Wait ${remaining}s` : 'Send SOS Now'}
                  </Button>
                  <Button variant="outline" size="lg" onClick={close} disabled={sending}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
