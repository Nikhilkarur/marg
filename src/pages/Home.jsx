import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin,
  Navigation,
  ArrowUpDown,
  Bus,
  Train,
  TrainFront,
  Car,
  ShieldCheck,
  Clock,
} from 'lucide-react'
import { AppLayout } from '@/components/marg/AppLayout'
import MapComponent from '@/components/marg/MapComponent'
import LocationSearch from '@/components/marg/LocationSearch'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useSafeMode } from '@/hooks/useSafeMode'
import { HEATMAP_ZONES } from '@/data/heatmapZones'
import { saveTripState, saveRecentTrip, loadRecentTrips } from '@/lib/tripState'
import { cn } from '@/lib/utils'

const modes = [
  { label: 'Bus', icon: Bus, color: 'text-emerald-500' },
  { label: 'Metro', icon: Train, color: 'text-purple-500' },
  { label: 'Train', icon: TrainFront, color: 'text-blue-500' },
  { label: 'Auto', icon: Car, color: 'text-gold-500' },
]

// Sensible Chennai defaults so a demo works without typing.
const DEFAULT_ORIGIN = { name: 'Anna Nagar, Chennai', lat: 13.085, lng: 80.2101 }
const DEFAULT_DEST = { name: 'T. Nagar, Chennai', lat: 13.0418, lng: 80.2341 }

export default function Home() {
  const navigate = useNavigate()
  const { safeMode, toggle } = useSafeMode()
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN)
  const [destination, setDestination] = useState(DEFAULT_DEST)
  const [when, setWhen] = useState('now')
  const [recents] = useState(() => loadRecentTrips())

  const swap = () => {
    setOrigin(destination)
    setDestination(origin)
  }

  // mode = null → all options; otherwise a mode chip filters Results to that mode.
  const findRoutes = (mode = null, o = origin, d = destination) => {
    if (!o || !d) return
    saveRecentTrip(o, d) // remember for the Home quick-launch
    saveTripState({ origin: o, destination: d, route: null, mode }) // survive a refresh
    navigate('/results', { state: { origin: o, destination: d, mode } })
  }

  return (
    <AppLayout map={<MapComponent heatmapZones={HEATMAP_ZONES} />}>
      {/* Greeting */}
      <div className="p-6 pb-2">
        <h1 className="text-2xl font-bold text-marg-text">Where to, Nikhil?</h1>
        <p className="mt-1 text-sm text-marg-muted">
          Compare metro, train, bus and auto — by time, cost and safety.
        </p>
      </div>

      {/* Search card */}
      <div className="mx-4 mb-4 rounded-2xl border border-marg-border bg-white p-4 shadow-sm">
        <LocationSearch
          icon={MapPin}
          iconColor="text-emerald-500"
          placeholder="Where are you?"
          value={origin}
          onSelect={setOrigin}
        />

        <div className="relative my-2.5 flex items-center">
          <div className="h-px flex-1 bg-marg-border" />
          <button
            type="button"
            onClick={swap}
            aria-label="Swap locations"
            className="mx-2 flex size-8 items-center justify-center rounded-full border border-marg-border bg-white text-marg-muted transition-colors hover:text-emerald-600 active:scale-90"
          >
            <ArrowUpDown className="size-4" />
          </button>
          <div className="h-px flex-1 bg-marg-border" />
        </div>

        <LocationSearch
          icon={Navigation}
          iconColor="text-gold-500"
          placeholder="Where to?"
          value={destination}
          onSelect={setDestination}
        />

        <div className="mt-4 flex gap-2">
          {['now', 'schedule'].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWhen(w)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors duration-150',
                when === w
                  ? 'bg-emerald-600 text-white'
                  : 'border border-marg-border text-marg-muted hover:text-marg-text',
              )}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Recent trips quick-launch */}
      {recents.length > 0 && (
        <div className="mx-4 mb-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-marg-muted">
            <Clock className="size-3.5" /> Recent
          </p>
          <div className="flex flex-col gap-2">
            {recents.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => findRoutes(null, r.origin, r.destination)}
                className="flex items-center gap-2 rounded-xl border border-marg-border bg-white px-3 py-2 text-left text-sm transition-colors hover:border-emerald-500 hover:bg-emerald-50"
              >
                <MapPin className="size-4 shrink-0 text-emerald-500" />
                <span className="truncate text-marg-text">
                  {r.origin.short || r.origin.name?.split(',')[0]} → {r.destination.short || r.destination.name?.split(',')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mode chips */}
      <div className="mx-4 mb-4 grid grid-cols-4 gap-3">
        {modes.map((mode) => {
          const Icon = mode.icon
          return (
            <button
              key={mode.label}
              type="button"
              onClick={() => findRoutes(mode.label.toLowerCase())}
              className="flex flex-col items-center gap-1 rounded-xl border border-marg-border bg-white p-3 transition-colors duration-150 hover:border-emerald-500 hover:bg-emerald-50"
            >
              <Icon className={cn('size-6', mode.color)} />
              <span className="text-xs font-medium text-marg-text">{mode.label}</span>
            </button>
          )
        })}
      </div>

      {/* Women Safety Mode card */}
      <div
        className={cn(
          'mx-4 mb-4 flex items-center gap-3 rounded-xl border p-4 transition-colors duration-200',
          safeMode ? 'border-amber-300 bg-amber-50' : 'border-marg-border bg-white',
        )}
      >
        <ShieldCheck className={cn('size-8 shrink-0', safeMode ? 'text-gold-500' : 'text-marg-muted')} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-marg-text">Women Safety Mode</p>
          <p className="mt-0.5 text-xs text-marg-muted">Re-routes using real crime data</p>
        </div>
        <Switch checked={safeMode} onCheckedChange={toggle} tone={safeMode ? 'gold' : 'emerald'} />
      </div>

      {/* CTA */}
      <div className="mx-4 mb-6">
        <Button size="lg" className="w-full" onClick={() => findRoutes()}>
          Find Routes →
        </Button>
      </div>
    </AppLayout>
  )
}
