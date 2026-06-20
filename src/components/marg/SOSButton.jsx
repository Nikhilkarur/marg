import { useState, useEffect } from 'react'
import { ShieldAlert, MapPin, MapPinOff, Bell, Clock, ExternalLink, Check } from 'lucide-react'
import { useSafeMode } from '@/hooks/useSafeMode'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { getEmergencyContact, formatNumber, sendSos, sosCooldownRemaining } from '@/lib/sos'

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
    const tick = () => setRemaining(sosCooldownRemaining())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [open, result])

  const contact = getEmergencyContact()
  const displayNumber = formatNumber(contact.number)

  const send = async () => {
    if (sending || remaining > 0) return // debounce double-taps within cooldown
    setSending(true)
    const res = await sendSos(user, { trigger: 'manual' })
    setSending(false)
    setResult(res)
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
        className="fixed bottom-[5.25rem] right-4 z-50 flex size-14 flex-col items-center justify-center rounded-full bg-marg-danger text-white shadow-xl shadow-red-500/30 ring-4 ring-white transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6 md:ring-0"
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
