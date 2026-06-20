import { useEffect, useRef, useState } from 'react'
import { Share2, BellRing, Check, Radio, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startTracking, newTrackId, trackUrl } from '@/lib/track'

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
 * Women-safety helpers on a route: share the trip + ETA with a contact, arm a
 * "reached safely" check-in that nudges (browser notification) at the ETA, and
 * share a live-tracking link a contact can open to follow the journey on a map.
 */
export function TripSafety({ origin, destination, route }) {
  const [shared, setShared] = useState(false)
  const [armed, setArmed] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const timer = useRef(null)
  const stopTrackRef = useRef(null)
  const linkRef = useRef('')
  const contact = getContact()

  useEffect(() => () => { clearTimeout(timer.current); stopTrackRef.current?.() }, [])

  const startLive = async () => {
    const id = newTrackId()
    const url = trackUrl(id)
    linkRef.current = url
    const dest = destination?.lat != null
      ? { lat: destination.lat, lng: destination.lng, name: destination.short || destination.name?.split(',')[0] }
      : null
    stopTrackRef.current = startTracking(id, dest)
    setTracking(true)
    const text = `Follow my live trip on Marg — you can see where I am until I arrive:\n${url}`
    try {
      if (navigator.share) await navigator.share({ title: 'My live Marg trip', text })
      else { await navigator.clipboard.writeText(text); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500) }
    } catch {
      /* user cancelled the share sheet — link is still active */
    }
  }

  const stopLive = () => {
    stopTrackRef.current?.()
    stopTrackRef.current = null
    setTracking(false)
  }

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(linkRef.current); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) } catch {}
  }

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
    <div className="mx-4 mt-3 flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
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

      {tracking ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-sm font-semibold text-emerald-800">Live tracking on — sharing your location</span>
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={copyLink} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
              {linkCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {linkCopied ? 'Link copied' : 'Copy link'}
            </button>
            <button type="button" onClick={stopLive} className="rounded-lg border border-marg-border bg-white px-3 py-2 text-xs font-medium text-marg-danger hover:bg-red-50">
              Stop sharing
            </button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={startLive}>
          <Radio className="size-4" />
          Share live location tracking
        </Button>
      )}
    </div>
  )
}
