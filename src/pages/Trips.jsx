import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Footprints, Train, TrainFront, Car, Bus, ArrowRight, MapPin, Navigation } from 'lucide-react'
import { AppLayout } from '@/components/marg/AppLayout'
import { SafetyBadge } from '@/components/marg/SafetyBadge'
import { Button } from '@/components/ui/button'
import { fetchTrips } from '@/lib/api'
import { loadRecentTrips } from '@/lib/tripState'
import { cn } from '@/lib/utils'

const ICON = { walk: Footprints, metro: Train, train: TrainFront, auto: Car, bus: Bus }
const COLOR = {
  walk: 'text-blue-500',
  metro: 'text-purple-500',
  train: 'text-blue-500',
  auto: 'text-gold-500',
  bus: 'text-emerald-500',
}

// A saved trip from Supabase (has full route_data → time/fare/safety/legs).
function savedToCard(row) {
  const r = row.route_data || {}
  const modes = r.modes?.length ? r.modes : (r.steps || []).map((s) => s.mode)
  const legs = (modes.length ? modes : ['walk']).map((mode) => ({
    icon: ICON[mode] || Footprints,
    color: COLOR[mode] || COLOR.walk,
  }))
  return {
    kind: 'saved',
    from: row.from_name?.split(',')[0] || 'Origin',
    to: row.to_name?.split(',')[0] || 'Destination',
    date: row.created_at
      ? new Date(row.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '',
    time: r.total_time != null ? `${r.total_time} min` : '—',
    fare: r.total_fare != null ? `₹${r.total_fare}` : '—',
    safety: typeof r.safety_score === 'number' ? r.safety_score : null,
    legs,
    _raw: row,
  }
}

// A recent search from localStorage (origin/destination only — no fake stats).
function recentToCard(r) {
  return {
    kind: 'recent',
    from: r.origin?.short || r.origin?.name?.split(',')[0] || 'Origin',
    to: r.destination?.short || r.destination?.name?.split(',')[0] || 'Destination',
    origin: r.origin,
    destination: r.destination,
  }
}

export default function Trips() {
  const navigate = useNavigate()
  // Start with the user's real recent searches (empty for a brand-new user — no
  // more fake sample journeys). Signed-in users get their richer saved trips.
  const [trips, setTrips] = useState(() => loadRecentTrips().map(recentToCard))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchTrips()
      .then((rows) => {
        if (active && rows?.length) setTrips(rows.map(savedToCard))
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const openTrip = (trip) => {
    if (trip.kind === 'saved' && trip._raw) {
      const row = trip._raw
      navigate('/map', {
        state: {
          route: row.route_data,
          origin: { name: row.from_name, lat: row.from_lat, lng: row.from_lng },
          destination: { name: row.to_name, lat: row.to_lat, lng: row.to_lng },
        },
      })
    } else if (trip.origin && trip.destination) {
      navigate('/results', { state: { origin: trip.origin, destination: trip.destination } })
    } else {
      navigate('/home')
    }
  }

  return (
    <AppLayout fullWidth>
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-marg-text">My Trips</h1>
        <p className="mb-5 mt-1 text-sm text-marg-muted">Your planned journeys across Chennai</p>

        {loading && trips.length === 0 ? (
          /* Loading skeleton while saved trips are fetched (signed-in users). */
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl border border-marg-border bg-white" />
            ))}
          </div>
        ) : trips.length === 0 ? (
          /* Honest empty state — a new user has no history (TASK 4 #25). */
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-marg-border bg-white px-6 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50">
              <Navigation className="size-7 text-emerald-500" />
            </span>
            <p className="mt-4 font-semibold text-marg-text">No trips yet</p>
            <p className="mt-1 max-w-xs text-sm text-marg-muted">
              Plan a journey from the home screen and it’ll show up here.
            </p>
            <Button className="mt-5" onClick={() => navigate('/home')}>
              Plan a trip
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {trips.map((trip, i) => (
              <button
                key={i}
                onClick={() => openTrip(trip)}
                className="rounded-2xl border border-marg-border bg-white p-4 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-marg-text">
                      {trip.from} → {trip.to}
                    </p>
                    <p className="text-xs text-marg-muted">{trip.kind === 'saved' ? trip.date : 'Recent search'}</p>
                  </div>
                  {trip.kind === 'saved' && <SafetyBadge score={trip.safety} />}
                </div>

                {trip.kind === 'saved' ? (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {trip.legs.map((leg, j) => {
                        const Icon = leg.icon
                        return (
                          <div key={j} className="flex items-center gap-1.5">
                            <Icon className={cn('size-[18px]', leg.color)} />
                            {j < trip.legs.length - 1 && <ArrowRight className="size-3 text-marg-muted" />}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-marg-text">{trip.time}</span>
                      <span className="text-sm font-medium text-emerald-600">{trip.fare}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                    <MapPin className="size-4" />
                    Tap to plan this route
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
