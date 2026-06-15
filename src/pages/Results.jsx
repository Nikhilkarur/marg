import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, Info, Footprints, Train, TrainFront, Car, Bus, Moon } from 'lucide-react'
import { AppLayout } from '@/components/marg/AppLayout'
import MapComponent from '@/components/marg/MapComponent'
import { RouteCard } from '@/components/marg/RouteCard'
import { useSafeMode } from '@/hooks/useSafeMode'
import { fetchRoutes, fetchHeatmap, fetchDirections, saveTrip } from '@/lib/api'
import { saveTripState, loadTripState } from '@/lib/tripState'
import { cn } from '@/lib/utils'

const DEFAULT_ORIGIN = { name: 'Anna Nagar, Chennai', lat: 13.085, lng: 80.2101 }
const DEFAULT_DEST = { name: 'T. Nagar, Chennai', lat: 13.0418, lng: 80.2341 }

const MODE_ICON = {
  walk: { icon: Footprints, color: 'text-blue-500' },
  metro: { icon: Train, color: 'text-purple-500' },
  train: { icon: TrainFront, color: 'text-blue-500' },
  auto: { icon: Car, color: 'text-gold-500' },
  bus: { icon: Bus, color: 'text-emerald-500' },
}

// Used when the backend is unreachable so the screen still works.
const FALLBACK_ROUTES = [
  { id: 'metro-auto', label: 'Metro + Auto', modes: ['walk', 'metro', 'auto'], steps: [{ mode: 'walk' }, { mode: 'metro' }, { mode: 'auto' }], total_time: 34, total_fare: 47, safety_score: 82, transfers: 2 },
  { id: 'direct-auto', label: 'Direct Auto', modes: ['auto'], steps: [{ mode: 'auto' }], total_time: 28, total_fare: 120, safety_score: 74, transfers: 0 },
  { id: 'bus-walk', label: 'Bus + Walk', modes: ['bus', 'walk'], steps: [{ mode: 'bus' }, { mode: 'walk' }], total_time: 41, total_fare: 15, safety_score: 58, transfers: 1 },
]

const SORTS = [
  { key: 'fastest', label: 'Fastest' },
  { key: 'safest', label: 'Safest' },
  { key: 'cheapest', label: 'Cheapest' },
]
const RECO_LABEL = {
  fastest: 'Recommended — Fastest Route',
  safest: 'Recommended — Safest Route',
  cheapest: 'Recommended — Cheapest Route',
}

function toCard(route, index, sort) {
  const steps = route.steps?.length ? route.steps : route.modes.map((m) => ({ mode: m }))
  return {
    id: route.id,
    legs: steps.map((s) => MODE_ICON[s.mode] || MODE_ICON.walk),
    time: `${route.total_time} min`,
    fare: `₹${route.total_fare}`,
    safety: route.safety_score,
    transfers: route.transfers,
    schedule: route.depart_at && route.arrive_at ? `${route.depart_at} – ${route.arrive_at}` : null,
    warning: route.safety_score < 60 ? 'Includes an isolated stretch — caution after dark' : null,
    recommended: index === 0,
    recommendedLabel: RECO_LABEL[sort],
  }
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export default function Results() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { safeMode } = useSafeMode()
  // Restore from sessionStorage on a hard refresh (state is lost) so we keep
  // the user's real trip instead of reverting to the default (TASK 4 #22).
  const restored = state || loadTripState()
  const origin = restored?.origin || DEFAULT_ORIGIN
  const destination = restored?.destination || DEFAULT_DEST
  const departMin = Number.isFinite(restored?.departMin) ? restored.departMin : null
  const departLabel = departMin != null
    ? `Departing ${String(Math.floor(departMin / 60)).padStart(2, '0')}:${String(departMin % 60).padStart(2, '0')}`
    : 'Departing now'

  const [routes, setRoutes] = useState([])
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  // True once a load has been slow for a few seconds — on the deployed free
  // backend (Render) the first request cold-starts ~30–60s, so we reassure
  // instead of showing frozen-looking skeletons.
  const [slowLoad, setSlowLoad] = useState(false)
  const [fallbackLine, setFallbackLine] = useState(null)
  const [sort, setSort] = useState('safest')
  // Set when the user taps a mode chip on Home (Bus/Metro/Train/Auto).
  const [modeFilter, setModeFilter] = useState(restored?.mode || null)
  // The backend's IST hour for this result, so we can explain late-night gaps.
  const [serverHour, setServerHour] = useState(null)

  useEffect(() => {
    setSort(safeMode ? 'safest' : 'fastest')
  }, [safeMode])

  // Keep the active mode filter in sessionStorage so a refresh doesn't revert to
  // a stale filtered/unfiltered view (TASK 4 #22 consistency).
  useEffect(() => {
    saveTripState({ mode: modeFilter })
  }, [modeFilter])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSlowLoad(false)
    const slowTimer = setTimeout(() => !cancelled && setSlowLoad(true), 6000)
    // The backend restricts to `modeFilter` (so Train never returns metro, etc.).
    Promise.all([
      fetchRoutes(origin, destination, safeMode, modeFilter, departMin).catch(() => null),
      fetchHeatmap(),
    ]).then(async ([routesData, zonesData]) => {
      clearTimeout(slowTimer)
      if (cancelled) return
      setZones(zonesData)
      setServerHour(Number.isInteger(routesData?.hour) ? routesData.hour : null)
      if (routesData?.routes) {
        // Backend responded (array, possibly empty for a mode with no service).
        setRoutes(routesData.routes)
        setFallbackLine(null)
      } else {
        // Only fall back when the backend is unreachable.
        setRoutes(FALLBACK_ROUTES)
        const line = await fetchDirections(origin, destination).catch(() => null)
        if (!cancelled) {
          setFallbackLine(line || [[origin.lng, origin.lat], [destination.lng, destination.lat]])
        }
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
      clearTimeout(slowTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin.lat, origin.lng, destination.lat, destination.lng, safeMode, modeFilter, departMin])

  const sorted = useMemo(() => {
    const list = [...routes]
    if (sort === 'safest') list.sort((a, b) => b.safety_score - a.safety_score)
    else if (sort === 'cheapest') list.sort((a, b) => a.total_fare - b.total_fare)
    else list.sort((a, b) => a.total_time - b.total_time)
    return list
  }, [routes, sort])

  const noneForMode = !loading && modeFilter && sorted.length === 0
  const mapCoords = sorted[0]?.coordinates?.length ? sorted[0].coordinates : fallbackLine

  // Late-night context: metro/suburban/bus stop running ~11pm–4:30am, so the
  // honest reason for "only autos" (or no result for a transit mode) is the
  // hour, not coverage. Drive the messaging off the backend's IST hour.
  const hasTransit = sorted.some((r) => r.modes?.some((m) => m === 'metro' || m === 'train' || m === 'bus'))
  const lateNight = serverHour != null && (serverHour >= 23 || serverHour < 5)
  const transitClosed = !loading && !modeFilter && sorted.length > 0 && !hasTransit && lateNight
  const modeClosedAtNight = lateNight && (modeFilter === 'metro' || modeFilter === 'train' || modeFilter === 'bus')

  return (
    <AppLayout chat map={<MapComponent route={mapCoords} heatmapZones={zones} />}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-marg-border p-4">
        <button
          type="button"
          onClick={() => navigate('/home')}
          aria-label="Back"
          className="flex size-9 items-center justify-center rounded-full text-marg-text transition-colors hover:bg-gray-100"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0">
          <p className="truncate font-semibold text-marg-text">
            {origin.short || origin.name?.split(',')[0]} → {destination.short || destination.name?.split(',')[0]}
          </p>
          <p className="text-xs text-marg-muted">
            {departLabel} · {loading ? 'finding routes…' : `${sorted.length} ${modeFilter ? cap(modeFilter) + ' ' : ''}route${sorted.length === 1 ? '' : 's'} found`}
          </p>
        </div>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-2 px-4 pb-2 pt-3">
        {SORTS.map((s) => {
          const active = sort === s.key
          const isSafe = s.key === 'safest'
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150',
                active
                  ? isSafe
                    ? 'bg-gold-500 text-white'
                    : 'bg-emerald-600 text-white'
                  : 'border border-marg-border text-marg-muted hover:text-marg-text',
              )}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Active mode filter chip */}
      {modeFilter && (
        <div className="px-4 pb-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
            {cap(modeFilter)} only
            <button type="button" aria-label="Clear mode filter" onClick={() => setModeFilter(null)} className="text-emerald-700 hover:text-emerald-900">
              ✕
            </button>
          </span>
        </div>
      )}

      {/* Late-night explainer so "only autos" doesn't look like a bug */}
      {transitClosed && (
        <div className="mx-4 mb-1 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <Moon className="mt-0.5 size-4 shrink-0 text-gold-600" />
          <p className="text-xs text-marg-muted">
            <span className="font-semibold text-marg-text">It&apos;s late.</span> Metro and suburban
            trains run roughly 4:30 AM–11 PM and buses are limited overnight, so these are auto
            options. Turn on Women Safety Mode for night-travel guidance.
          </p>
        </div>
      )}

      {/* Cards */}
      <div className="flex flex-col gap-3 px-4 pb-2">
        {loading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl border border-marg-border bg-white" />
            ))}
            {slowLoad && (
              <p className="pt-1 text-center text-xs text-marg-muted">
                Waking up the free server — the first search can take up to a minute…
              </p>
            )}
          </>
        ) : noneForMode ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
            <p className="font-semibold text-marg-text">
              {modeClosedAtNight ? `${cap(modeFilter)} has stopped for the night` : `No ${cap(modeFilter)} route for this trip`}
            </p>
            <p className="mt-1 text-sm text-marg-muted">
              {modeClosedAtNight
                ? `${cap(modeFilter)} doesn’t run at this hour (service is roughly 4:30 AM–11 PM). Try Auto, or check back in the morning.`
                : `${cap(modeFilter)} doesn’t serve this origin → destination (likely outside its coverage). Try another mode.`}
            </p>
            <button
              type="button"
              onClick={() => setModeFilter(null)}
              className="mt-3 rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Show all options
            </button>
          </div>
        ) : (
          sorted.map((route, i) => (
            <div key={route.id} className="animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
              <RouteCard
                route={toCard(route, i, sort)}
                onClick={() => {
                  const trip = { route, origin, destination, zones }
                  saveTripState(trip) // persist the chosen route for /map refreshes
                  // Log to history for signed-in users (no-op for demo); no "start" framing.
                  saveTrip({
                    from_name: origin.name,
                    from_lat: origin.lat,
                    from_lng: origin.lng,
                    to_name: destination.name,
                    to_lat: destination.lat,
                    to_lng: destination.lng,
                    route_data: route,
                    safe_mode: safeMode,
                  }).catch(() => {})
                  navigate('/map', { state: trip })
                }}
              />
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-start gap-1.5 px-4 pb-6 pt-2">
        <Info className="mt-0.5 size-3.5 shrink-0 text-marg-muted" />
        <p className="text-xs text-marg-muted">
          Safety scores use real incident data from Safecity.in
        </p>
      </div>
    </AppLayout>
  )
}
