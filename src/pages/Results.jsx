import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, Info, Footprints, Train, TrainFront, Car, Bus, Moon, Columns3, List } from 'lucide-react'
import { AppLayout } from '@/components/marg/AppLayout'
import MapComponent from '@/components/marg/MapComponent'
import { RouteCard } from '@/components/marg/RouteCard'
import { RouteCompare } from '@/components/marg/RouteCompare'
import { useSafeMode } from '@/hooks/useSafeMode'
import { useT } from '@/lib/i18n'
import { fetchRoutes, fetchHeatmap, fetchDirections, snapRouteToRoads, saveTrip } from '@/lib/api'
import { saveTripState, loadTripState } from '@/lib/tripState'
import { withReports } from '@/lib/reports'
import { useSafeHavens } from '@/hooks/useSafeHavens'
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
  { key: 'best', tkey: 'sort.best' },
  { key: 'fastest', tkey: 'sort.fastest' },
  { key: 'safest', tkey: 'sort.safest' },
  { key: 'cheapest', tkey: 'sort.cheapest' },
]
const MODE_LABEL = { walk: 'Walk', metro: 'Metro', train: 'Train', auto: 'Auto', bus: 'Bus' }
const TRANSIT_MODES = new Set(['metro', 'train', 'bus'])

// Minutes from now until an "HH:MM" wall-clock time (today). Null if unparseable
// or already past by more than a couple of minutes.
function minsUntil(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null
  const [h, m] = hhmm.split(':').map(Number)
  const now = new Date()
  const t = new Date(now)
  t.setHours(h, m, 0, 0)
  const diff = Math.round((t - now) / 60000)
  return diff < -2 ? null : diff
}

// Passenger-km CO₂ factors (kg/km), public sources (incl. CMRL): a private car is
// the baseline we save against; transit modes are far lower.
const EMISSION = { car: 0.139, auto: 0.11, bus: 0.051, metro: 0.028, train: 0.035, walk: 0 }
const TRANSIT_ORDER = ['metro', 'train', 'bus', 'auto']

function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// How much CO₂ this route saves vs driving the same trip in a private car.
function co2SavedKg(route, tripKm) {
  const mode = TRANSIT_ORDER.find((m) => route.modes?.includes(m)) || 'auto'
  return Math.max(0, tripKm * (EMISSION.car - EMISSION[mode]))
}

function toCard(route, index, sort, tripKm, t) {
  const steps = route.steps?.length ? route.steps : route.modes.map((m) => ({ mode: m }))
  const saved = co2SavedKg(route, tripKm)
  // First transit leg drives the "next departure" readout (real timetable data).
  const transitLeg = steps.find((s) => TRANSIT_MODES.has(s.mode))
  const nextDeps = (transitLeg?.next_departures || []).filter(Boolean).slice(0, 3)
  const departIn = transitLeg?.depart_at ? minsUntil(transitLeg.depart_at) : null
  return {
    id: route.id,
    legs: steps.map((s) => ({ ...(MODE_ICON[s.mode] || MODE_ICON.walk), label: MODE_LABEL[s.mode] || 'Walk', mode: s.mode })),
    time: route.total_time,
    fare: `₹${route.total_fare}`,
    safety: route.safety_score,
    transfers: route.transfers,
    schedule: route.depart_at && route.arrive_at ? `${route.depart_at} – ${route.arrive_at}` : null,
    co2: saved >= 0.2 ? `${saved.toFixed(1)} kg` : null,
    line: transitLeg?.line || null,
    nextDeps,
    departIn,
    warning: route.safety_score < 60 ? 'Includes an isolated stretch — caution after dark' : null,
    recommended: index === 0,
    recommendedLabel: t(`reco.${sort}`),
  }
}

// Balanced "Best" score: normalise time/fare/safety across the result set so no
// single dimension dominates. Lower time & fare are better; higher safety better.
function rankBest(list) {
  if (list.length < 2) return list
  const times = list.map((r) => r.total_time)
  const fares = list.map((r) => r.total_fare)
  const tMin = Math.min(...times), tMax = Math.max(...times)
  const fMin = Math.min(...fares), fMax = Math.max(...fares)
  const norm = (v, lo, hi) => (hi === lo ? 0 : (v - lo) / (hi - lo))
  const score = (r) =>
    0.4 * norm(r.total_time, tMin, tMax) + // 0 = fastest
    0.3 * norm(r.total_fare, fMin, fMax) + // 0 = cheapest
    0.3 * (1 - (r.safety_score ?? 0) / 100) // 0 = safest
  return [...list].sort((a, b) => score(a) - score(b))
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export default function Results() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { safeMode } = useSafeMode()
  const { t } = useT()
  // Restore from sessionStorage on a hard refresh (state is lost) so we keep
  // the user's real trip instead of reverting to the default (TASK 4 #22).
  const restored = state || loadTripState()
  const origin = restored?.origin || DEFAULT_ORIGIN
  const destination = restored?.destination || DEFAULT_DEST
  const departMin = Number.isFinite(restored?.departMin) ? restored.departMin : null
  const departLabel = departMin != null
    ? t('results.departingAt', { time: `${String(Math.floor(departMin / 60)).padStart(2, '0')}:${String(departMin % 60).padStart(2, '0')}` })
    : t('results.departingNow')

  const [routes, setRoutes] = useState([])
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  // True once a load has been slow for a few seconds — on the deployed free
  // backend (Render) the first request cold-starts ~30–60s, so we reassure
  // instead of showing frozen-looking skeletons.
  const [slowLoad, setSlowLoad] = useState(false)
  const [fallbackLine, setFallbackLine] = useState(null)
  const [sort, setSort] = useState('best')
  const [compare, setCompare] = useState(false)
  // Set when the user taps a mode chip on Home (Bus/Metro/Train/Auto).
  const [modeFilter, setModeFilter] = useState(restored?.mode || null)
  // The backend's IST hour for this result, so we can explain late-night gaps.
  const [serverHour, setServerHour] = useState(null)

  useEffect(() => {
    setSort(safeMode ? 'safest' : 'best')
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
    else if (sort === 'fastest') list.sort((a, b) => a.total_time - b.total_time)
    else return rankBest(list)
    return list
  }, [routes, sort])

  // Straight-line distance + a detour factor → a "good enough" trip length for the
  // CO₂-saved estimate on each card (no per-leg distance needed from the backend).
  const tripKm = useMemo(() => haversineKm(origin, destination) * 1.25, [origin.lat, origin.lng, destination.lat, destination.lng])

  // Rows for the side-by-side comparison (top routes, raw numbers).
  const compareRows = useMemo(
    () =>
      sorted.slice(0, 4).map((r) => {
        const modes = (r.modes || r.steps?.map((s) => s.mode) || [])
          .filter((m) => m !== 'walk')
          .filter((m, i, a) => a.indexOf(m) === i)
          .map((m) => MODE_LABEL[m] || m)
        return {
          id: r.id,
          label: modes.length ? modes.join(' + ') : 'Walk',
          time: r.total_time,
          fare: r.total_fare,
          safety: r.safety_score,
          co2Kg: co2SavedKg(r, tripKm),
        }
      }),
    [sorted, tripKm],
  )

  const noneForMode = !loading && modeFilter && sorted.length === 0

  // Snap the top route's line to roads for the map (falls back to raw coords).
  const [snappedTop, setSnappedTop] = useState(null)
  const topRoute = sorted[0]
  useEffect(() => {
    let cancelled = false
    setSnappedTop(null)
    if (topRoute?.steps?.length) {
      snapRouteToRoads(topRoute).then((line) => !cancelled && line && setSnappedTop(line)).catch(() => {})
    }
    return () => { cancelled = true }
  }, [topRoute?.id, sort])

  const mapCoords = snappedTop || (topRoute?.coordinates?.length ? topRoute.coordinates : fallbackLine)

  // Live safe-havens around the trip mid-point.
  const havenCenter = useMemo(
    () => ({ lat: (origin.lat + destination.lat) / 2, lng: (origin.lng + destination.lng) / 2 }),
    [origin.lat, origin.lng, destination.lat, destination.lng],
  )
  const safeHavens = useSafeHavens(havenCenter)

  // Late-night context: metro/suburban/bus stop running ~11pm–4:30am, so the
  // honest reason for "only autos" (or no result for a transit mode) is the
  // hour, not coverage. Drive the messaging off the backend's IST hour.
  const hasTransit = sorted.some((r) => r.modes?.some((m) => m === 'metro' || m === 'train' || m === 'bus'))
  const lateNight = serverHour != null && (serverHour >= 23 || serverHour < 5)
  const transitClosed = !loading && !modeFilter && sorted.length > 0 && !hasTransit && lateNight
  const modeClosedAtNight = lateNight && (modeFilter === 'metro' || modeFilter === 'train' || modeFilter === 'bus')

  return (
    <AppLayout chat map={<MapComponent route={mapCoords} heatmapZones={withReports(zones)} safeHavens={safeHavens} />}>
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
            {departLabel} · {loading ? t('results.finding') : t(sorted.length === 1 ? 'results.routeFound' : 'results.routesFound', { n: sorted.length, mode: modeFilter ? t('mode.' + modeFilter) + ' ' : '' })}
          </p>
        </div>
      </div>

      {/* Sort tabs + compare toggle */}
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        <div className="flex flex-1 gap-1.5 overflow-x-auto">
          {SORTS.map((s) => {
            const active = sort === s.key
            const isSafe = s.key === 'safest'
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150',
                  active
                    ? isSafe
                      ? 'bg-gold-500 text-white'
                      : 'bg-emerald-600 text-white'
                    : 'border border-marg-border text-marg-muted hover:text-marg-text',
                )}
              >
                {t(s.tkey)}
              </button>
            )
          })}
        </div>
        {!loading && sorted.length > 1 && (
          <button
            type="button"
            onClick={() => setCompare((c) => !c)}
            aria-pressed={compare}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              compare ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-marg-border text-marg-muted hover:text-marg-text',
            )}
          >
            {compare ? <List className="size-3.5" /> : <Columns3 className="size-3.5" />}
            {compare ? t('results.list') : t('results.compare')}
          </button>
        )}
      </div>

      {/* Comparison panel */}
      {compare && !loading && sorted.length > 1 && (
        <div className="px-4 pb-1 pt-1">
          <RouteCompare
            rows={compareRows}
            onPick={(id) => {
              const route = sorted.find((r) => r.id === id)
              if (!route) return
              const trip = { route, origin, destination, zones }
              saveTripState(trip)
              navigate('/map', { state: trip })
            }}
          />
          <p className="mt-1.5 px-1 text-[11px] text-marg-muted">Best value in each column is highlighted · tap a row to open</p>
        </div>
      )}

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
      <div className={cn('flex flex-col gap-3 px-4 pb-2', compare && !loading && 'hidden')}>
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
                route={toCard(route, i, sort, tripKm, t)}
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
