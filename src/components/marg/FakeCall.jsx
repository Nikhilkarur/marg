import { useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, Volume2, Video, Grip } from 'lucide-react'

// Looping "ringtone" via Web Audio — a two-tone warble, no asset needed.
function useRingtone(active) {
  const ref = useRef(null)
  useEffect(() => {
    if (!active) return
    let ctx, interval, stopped = false
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      const ring = () => {
        if (stopped) return
        ;[0, 0.4].forEach((t, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = i === 0 ? 480 : 440
          gain.gain.value = 0.0001
          osc.connect(gain)
          gain.connect(ctx.destination)
          const start = ctx.currentTime + t
          gain.gain.setValueAtTime(0.0001, start)
          gain.gain.exponentialRampToValueAtTime(0.25, start + 0.05)
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35)
          osc.start(start)
          osc.stop(start + 0.4)
        })
      }
      ring()
      interval = setInterval(ring, 2000)
      if (navigator.vibrate) {
        navigator.vibrate([600, 800, 600, 800, 600, 800])
        ref.current = setInterval(() => navigator.vibrate([600, 800]), 2400)
      }
    } catch {}
    return () => {
      stopped = true
      clearInterval(interval)
      clearInterval(ref.current)
      if (navigator.vibrate) navigator.vibrate(0)
      if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {})
    }
  }, [active])
}

/**
 * Fake incoming call — a classic women-safety escape: trigger a realistic call
 * to make an exit from an uncomfortable situation. Rings (with vibration), then
 * an "answered" screen with a running timer. Fully local, no telephony.
 */
export function FakeCall({ open, caller = 'Amma', onClose }) {
  const [answered, setAnswered] = useState(false)
  const [secs, setSecs] = useState(0)
  useRingtone(open && !answered)

  useEffect(() => {
    if (!open) { setAnswered(false); setSecs(0) }
  }, [open])

  useEffect(() => {
    if (!answered) return
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [answered])

  if (!open) return null
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-between bg-gradient-to-b from-gray-900 to-black px-6 py-16 text-white">
      <div className="flex flex-col items-center">
        <p className="text-sm text-white/60">{answered ? 'Calling…' : 'Incoming call'}</p>
        <div className="mt-8 flex size-28 items-center justify-center rounded-full bg-white/15 text-4xl font-semibold ring-4 ring-white/20">
          {caller.charAt(0)}
        </div>
        <h2 className="mt-5 text-3xl font-semibold">{caller}</h2>
        <p className="mt-1 text-white/60">{answered ? `${mm}:${ss}` : 'mobile'}</p>
      </div>

      {answered ? (
        <>
          <div className="grid grid-cols-3 gap-x-10 gap-y-7 text-center text-xs text-white/80">
            {[[Mic, 'mute'], [Grip, 'keypad'], [Volume2, 'speaker'], [Video, 'video'], [Phone, 'add']].map(([Icon, label], i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <span className="flex size-16 items-center justify-center rounded-full bg-white/10"><Icon className="size-6" /></span>
                {label}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="End call"
            className="flex size-16 items-center justify-center rounded-full bg-red-500 shadow-lg active:scale-95"
          >
            <PhoneOff className="size-7" />
          </button>
        </>
      ) : (
        <div className="flex w-full items-center justify-between px-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Decline"
            className="flex flex-col items-center gap-2 text-xs text-white/80"
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-red-500 shadow-lg active:scale-95">
              <PhoneOff className="size-7" />
            </span>
            Decline
          </button>
          <button
            type="button"
            onClick={() => setAnswered(true)}
            aria-label="Accept"
            className="flex flex-col items-center gap-2 text-xs text-white/80"
          >
            <span className="flex size-16 animate-bounce items-center justify-center rounded-full bg-emerald-500 shadow-lg active:scale-95">
              <Phone className="size-7" />
            </span>
            Accept
          </button>
        </div>
      )}
    </div>
  )
}
