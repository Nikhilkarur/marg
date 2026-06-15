import { useEffect, useRef, useState } from 'react'
import { Share2, BellRing, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

function getContact() {
  try {
    const raw = localStorage.getItem('marg_sos_contact')
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { name: 'your contact' }
}

/**
 * Women-safety helpers on a route: share the trip + ETA with a contact, and arm
 * a "reached safely" check-in that nudges (browser notification) at the ETA so a
 * contact can be alerted if you don't confirm. (Live GPS tracking would need a
 * backend; this shares trip details + a one-tap location link instead.)
 */
export function TripSafety({ origin, destination, route }) {
  const [shared, setShared] = useState(false)
  const [armed, setArmed] = useState(false)
  const timer = useRef(null)
  const contact = getContact()

  useEffect(() => () => clearTimeout(timer.current), [])

  const share = async () => {
    const from = origin?.name || origin?.short || 'my origin'
    const dest = destination?.name || destination?.short || 'my destination'
    let loc = ''
    try {
      const pos = await new Promise((res) =>
        navigator.geolocation
          ? navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 4000 })
          : res(null),
      )
      if (pos) loc = `\nMy location: https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`
    } catch {
      /* location optional */
    }
    const text = `I'm travelling from ${from} to ${dest} via Marg.${route?.arrive_at ? ` ETA ~${route.arrive_at}.` : ''}${loc}`
    try {
      if (navigator.share) await navigator.share({ title: 'My Marg trip', text })
      else await navigator.clipboard.writeText(text)
      setShared(true)
      setTimeout(() => setShared(false), 2500)
    } catch {
      /* user cancelled share */
    }
  }

  const arm = async () => {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
    setArmed(true)
    const mins = route?.total_time || 30
    clearTimeout(timer.current)
    timer.current = setTimeout(
      () => {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Marg check-in', {
            body: `Have you reached ${destination?.short || destination?.name || 'your destination'}? Tap "I've arrived", or alert ${contact?.name || 'your contact'}.`,
            tag: 'marg-checkin',
            requireInteraction: true,
          })
        }
      },
      Math.min(mins * 60000, 6 * 60 * 60000),
    )
  }

  const arrived = () => {
    setArmed(false)
    clearTimeout(timer.current)
  }

  return (
    <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
      <Button variant="outline" onClick={share}>
        {shared ? <Check className="size-4" /> : <Share2 className="size-4" />}
        {shared ? 'Shared' : 'Share trip'}
      </Button>
      {armed ? (
        <Button variant="outline" onClick={arrived}>
          <Check className="size-4" />
          I&apos;ve arrived
        </Button>
      ) : (
        <Button variant="outline" onClick={arm}>
          <BellRing className="size-4" />
          Check-in on arrival
        </Button>
      )}
    </div>
  )
}
