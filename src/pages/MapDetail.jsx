import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ChevronLeft,
  Clock,
  IndianRupee,
  Shield,
  ShieldCheck,
  Footprints,
  Train,
  TrainFront,
  Car,
  Bus,
  ArrowRight,
  Info,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import { AppLayout } from '@/components/marg/AppLayout'
import MapComponent from '@/components/marg/MapComponent'
import { SafetyBadge } from '@/components/marg/SafetyBadge'
import { TripSafety } from '@/components/marg/TripSafety'
import { fetchDirections } from '@/lib/api'
import { loadTripState } from '@/lib/tripState'
import { useSafeMode } from '@/hooks/useSafeMode'
import { cn } from '@/lib/utils'

const MODE = {
  walk: { icon: Footprints, tint: 'bg-blue-100 text-blue-600' },
  metro: { icon: Train, tint: 'bg-purple-100 text-purple-600' },
  train: { icon: TrainFront, tint: 'bg-blue-100 text-blue-600' },
  auto: { icon: Car, tint: 'bg-gold-100 text-gold-600' },
  bus: { icon: Bus, tint: 'bg-emerald-100 text-emerald-600' },
}

// Where to actually buy/track a ticket for each transit mode (real apps).
const BOOKING = {
  metro: { label: 'Book · Chennai Metro', url: 'https://chennaimetrorail.org/' },
  train: { label: 'Book · IR UTS app', url: 'https://www.utsonmobile.indianrail.gov.in/' },
  bus: { label: 'Live · Chalo', url: 'https://chalo.com/' },
}

// Shown only when navigated to directly with no trip data (e.g. a hard refresh
// that sessionStorage couldn't restore). Includes the new schedule fields so
// the layout looks the same as a real itinerary.
const DEFAULT_ROUTE = {
  total_time: 34,
  total_fare: 47,
  safety_score: 82,
  depart_at: '14:27',
  arrive_at: '15:01',
  coordinates: null,
  steps: [
    { mode: 'walk', label: 'Walk to Anna Nagar Tower', distance_m: 350, duration_min: 5, fare: 0, depart_at: '14:27', arrive_at: '14:32' },
    { mode: 'metro', label: 'Green Line → Alandur', line: 'Green Line', board_stop: 'Anna Nagar Tower', alight_stop: 'Alandur', duration_min: 16, wait_min: 4, fare: 30, depart_at: '14:36', arrive_at: '14:52' },
    { mode: 'auto', label: 'Auto to destination', distance_m: 2400, duration_min: 9, fare: 47, depart_at: '14:52', arrive_at: '15:01' },
  ],
}

function isTransit(s) {
  return s.mode === 'metro' || s.mode === 'train' || s.mode === 'bus'
}

// Secondary detail line for a step.
function stepMeta(s) {
  const parts = []
  if (s.distance_m) parts.push(s.distance_m >= 1000 ? `${(s.distance_m / 1000).toFixed(1)} km` : `${s.distance_m}m`)
  if (s.duration_min) parts.push(`${s.duration_min} min`)
  if (s.fare) parts.push(`₹${s.fare}`)
  return parts.join(' · ')
}

export default function MapDetail() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { safeMode } = useSafeMode()
  // Restore from sessionStorage on refresh so we don't silently revert to the
  // Anna Nagar→T.Nagar default (TASK 4 #22).
  const restored = state || loadTripState()
  const route = restored?.route || DEFAULT_ROUTE
  const zones = restored?.zones || []
  const origin = restored?.origin
  const destination = restored?.destination
  const [coords, setCoords] = useState(route.coordinates || null)

  // If we arrived without a polyline, fetch a real one for the map.
  useEffect(() => {
    if (coords?.length) return
    if (origin && destination) {
      fetchDirections(origin, destination)
        .then((line) => line && setCoords(line))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const steps = route.steps?.length ? route.steps : DEFAULT_ROUTE.steps
  const showNote = route.representative || route.estimated || steps.some((s) => s.estimated || s.schedule_basis === 'representative')

  return (
    <AppLayout chat map={<MapComponent route={coords} heatmapZones={zones} />}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-marg-border p-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex size-9 items-center justify-center rounded-full text-marg-text transition-colors hover:bg-gray-100"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-marg-text">Route Details</p>
          {route.depart_at && route.arrive_at && (
            <p className="text-xs text-marg-muted">
              Depart {route.depart_at} · Arrive {route.arrive_at}
            </p>
          )}
        </div>
        <SafetyBadge score={route.safety_score} />
      </div>

      {/* Summary */}
      <div className="m-4 grid grid-cols-3 gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
        <div className="flex flex-col items-center gap-1">
          <Clock className="size-5 text-emerald-600" />
          <span className="text-lg font-bold text-marg-text">{route.total_time} min</span>
          <span className="text-xs text-marg-muted">Total time</span>
        </div>
        <div className="flex flex-col items-center gap-1 border-x border-emerald-200">
          <IndianRupee className="size-5 text-emerald-600" />
          <span className="text-lg font-bold text-marg-text">{route.total_fare}</span>
          <span className="text-xs text-marg-muted">Est. fare</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Shield className="size-5 text-emerald-600" />
          <span className="text-lg font-bold text-emerald-600">
            {typeof route.safety_score === 'number' ? `${route.safety_score}/100` : '—'}
          </span>
          <span className="text-xs text-marg-muted">Safety score</span>
        </div>
      </div>

      {/* Women-safety actions (Safe Mode only): share trip + arrival check-in */}
      {safeMode && <TripSafety origin={origin} destination={destination} route={route} />}

      {/* Steps */}
      <div className="px-4 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-marg-muted">
          Journey breakdown
        </p>
        <div>
          {steps.map((step, i) => {
            const m = MODE[step.mode] || MODE.walk
            const Icon = m.icon
            const last = i === steps.length - 1
            const transit = isTransit(step)
            return (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={cn('flex size-10 items-center justify-center rounded-full', m.tint)}>
                    <Icon className="size-5" />
                  </span>
                  {!last && <span className="my-1 w-px flex-1 border-l-2 border-dashed border-marg-border" />}
                </div>
                <div className={cn('flex-1 pt-1.5', last ? 'pb-1' : 'pb-5')}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium text-marg-text">{step.label}</p>
                    {step.depart_at && step.arrive_at && (
                      <span className="shrink-0 text-xs font-medium tabular-nums text-marg-muted">
                        {step.depart_at}–{step.arrive_at}
                      </span>
                    )}
                  </div>

                  {/* Transit legs: board/alight stops + line + wait */}
                  {transit && (step.board_stop || step.alight_stop) && (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-marg-text">
                      {step.depart_at && <span className="font-semibold tabular-nums">{step.depart_at}</span>}
                      <span>{step.board_stop}</span>
                      <ArrowRight className="size-3 text-marg-muted" />
                      {step.arrive_at && <span className="font-semibold tabular-nums">{step.arrive_at}</span>}
                      <span>{step.alight_stop}</span>
                    </p>
                  )}

                  <p className="mt-0.5 text-sm text-marg-muted">
                    {transit && step.wait_min > 0 && (
                      <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-gold-600">
                        wait {step.wait_min} min
                      </span>
                    )}
                    {stepMeta(step)}
                  </p>

                  {/* Time/fare source + where to book the ticket */}
                  {(step.time_source || BOOKING[step.mode]) && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {step.time_source && (
                        <span className="text-[11px] text-marg-muted">
                          {step.time_source}
                          {step.fare_source ? ` · ${step.fare_source}` : ''}
                        </span>
                      )}
                      {BOOKING[step.mode] && (
                        <a
                          href={BOOKING[step.mode].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 hover:underline"
                        >
                          {BOOKING[step.mode].label}
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Next few departures for this transit leg */}
                  {step.next_departures?.length > 1 && (
                    <p className="mt-1 text-[11px] text-marg-muted">
                      Next: <span className="font-medium tabular-nums text-marg-text">{step.next_departures.join(' · ')}</span>
                    </p>
                  )}

                  {/* Crime-zone warning — only in Women Safety Mode */}
                  {safeMode && step.risk_zones?.length > 0 && (
                    <p className="mt-1 flex items-start gap-1 text-[11px] font-medium text-marg-danger">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      <span>
                        Passes {step.risk_zones.map((z) => z.name).join(', ')} ({step.risk_zones[0].risk_level} risk) — stay alert
                      </span>
                    </p>
                  )}

                  {/* Reserved women's coach / ladies' compartment — Safe Mode */}
                  {safeMode && (step.mode === 'metro' || step.mode === 'train') && (
                    <p className="mt-1 flex items-start gap-1 text-[11px] font-medium text-purple-600">
                      <ShieldCheck className="mt-0.5 size-3 shrink-0" />
                      {step.mode === 'metro'
                        ? "Reserved women's coach available — board the first coach"
                        : "Reserved ladies' compartment available on this local train"}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showNote && (
        <div className="mx-4 mt-3 flex items-start gap-1.5">
          <Info className="mt-0.5 size-3.5 shrink-0 text-marg-muted" />
          <p className="text-xs text-marg-muted">
            Some times use representative timetables or estimates (no official free GTFS for
            Chennai suburban/bus). Metro times use published headways. See SOURCES.md.
          </p>
        </div>
      )}

      <div className="mb-6" />
    </AppLayout>
  )
}
