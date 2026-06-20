import { useState } from 'react'
import { Flag, Check, X } from 'lucide-react'
import { addReport } from '@/lib/reports'
import { cn } from '@/lib/utils'

/**
 * Crowd-sourced reporting: tag the current location as an unsafe spot. The report
 * is saved and merged into the crime heatmap (see lib/reports.js), so it shows up
 * on the map immediately and influences Women-Safety routing for the reporter.
 * `onReported` is called with the updated report list so the parent can refresh.
 */
export function ReportUnsafeSpot({ onReported }) {
  const [open, setOpen] = useState(false)
  const [severity, setSeverity] = useState('medium')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = () => {
    setError('')
    setBusy(true)
    const finish = (lat, lng) => {
      const all = addReport({ lat, lng, severity, note })
      onReported?.(all)
      setBusy(false)
      setDone(true)
      setTimeout(() => { setDone(false); setOpen(false); setNote('') }, 1800)
    }
    if (!navigator.geolocation) { setBusy(false); setError('Location not available on this device.'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => finish(pos.coords.latitude, pos.coords.longitude),
      () => { setBusy(false); setError('Allow location access to pin the spot.') },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-4 mt-3 flex items-center justify-center gap-2 rounded-xl border border-marg-border bg-white px-4 py-2.5 text-sm font-medium text-marg-text transition-colors hover:border-gold-300 hover:bg-gold-50"
      >
        <Flag className="size-4 text-gold-500" />
        Report an unsafe spot here
      </button>
    )
  }

  return (
    <div className="mx-4 mt-3 rounded-xl border border-gold-200 bg-gold-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-marg-text">
          <Flag className="size-4 text-gold-500" /> Report unsafe spot
        </p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cancel" className="text-marg-muted hover:text-marg-text">
          <X className="size-4" />
        </button>
      </div>
      <p className="mb-2 text-xs text-marg-muted">Pins your current location and adds it to the safety heatmap.</p>

      <div className="mb-2 flex gap-2">
        {[{ id: 'medium', label: 'Feels unsafe' }, { id: 'high', label: 'Very unsafe' }].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSeverity(s.id)}
            className={cn(
              'flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              severity === s.id ? 'border-gold-500 bg-white text-gold-700' : 'border-marg-border bg-white text-marg-muted',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What happened? (optional)"
        maxLength={80}
        className="mb-2 h-10 w-full rounded-lg border border-marg-border px-3 text-sm outline-none focus:border-gold-500"
      />

      {error && <p className="mb-2 text-xs text-marg-danger">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || done}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gold-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gold-600 disabled:opacity-70"
      >
        {done ? <><Check className="size-4" /> Added to heatmap</> : busy ? 'Pinning location…' : 'Submit report'}
      </button>
    </div>
  )
}
