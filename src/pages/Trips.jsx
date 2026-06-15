import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Footprints, Train, TrainFront, Car, Bus, ArrowRight } from 'lucide-react'
import { AppLayout } from '@/components/marg/AppLayout'
import { SafetyBadge } from '@/components/marg/SafetyBadge'
import { fetchTrips } from '@/lib/api'
import { cn } from '@/lib/utils'

const ICON = { walk: Footprints, metro: Train, train: TrainFront, auto: Car, bus: Bus }
const COLOR = {
  walk: 'text-blue-500',
  metro: 'text-purple-500',
  train: 'text-blue-500',
  auto: 'text-gold-500',
  bus: 'text-emerald-500',
}

// Example journeys — shown to demo users (no saved trips yet) so the screen
// isn't empty. Replaced by real Supabase trips for signed-in users (TASK 4 #25).
const SAMPLE_TRIPS = [
  { from: 'Anna Nagar', to: 'T. Nagar', date: 'Today, 2:30 PM', time: '34 min', fare: '₹47', safety: 82, legs: [{ icon: Footprints, color: COLOR.walk }, { icon: Train, color: COLOR.metro }, { icon: Car, color: COLOR.auto }] },
  { from: 'Adyar', to: 'Velachery', date: 'Yesterday, 6:40 PM', time: '28 min', fare: '₹22', safety: 74, legs: [{ icon: Bus, color: COLOR.bus }, { icon: Footprints, color: COLOR.walk }] },
  { from: 'Tambaram', to: 'Egmore', date: 'Mon, 8:05 AM', time: '56 min', fare: '₹38', safety: 65, legs: [{ icon: Train, color: COLOR.metro }, { icon: Car, color: COLOR.auto }] },
]

function rowToCard(row) {
  const r = row.route_data || {}
  const modes = r.modes?.length ? r.modes : (r.steps || []).map((s) => s.mode)
  const legs = (modes.length ? modes : ['walk']).map((mode) => ({
    icon: ICON[mode] || Footprints,
    color: COLOR[mode] || COLOR.walk,
  }))
  return {
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

export default function Trips() {
  const navigate = useNavigate()
  const [trips, setTrips] = useState(SAMPLE_TRIPS)
  const [isSample, setIsSample] = useState(true)

  useEffect(() => {
    let active = true
    fetchTrips()
      .then((rows) => {
        if (active && rows?.length) {
          setTrips(rows.map(rowToCard))
          setIsSample(false)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const openTrip = (trip) => {
    if (trip._raw) {
      const row = trip._raw
      navigate('/map', {
        state: {
          route: row.route_data,
          origin: { name: row.from_name, lat: row.from_lat, lng: row.from_lng },
          destination: { name: row.to_name, lat: row.to_lat, lng: row.to_lng },
        },
      })
    } else {
      navigate('/map')
    }
  }

  return (
    <AppLayout fullWidth>
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-marg-text">My Trips</h1>
        <p className="mb-5 mt-1 text-sm text-marg-muted">
          {isSample ? 'Example journeys — your saved trips will appear here' : 'Your recent journeys across Chennai'}
        </p>

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
                  <p className="text-xs text-marg-muted">{trip.date}</p>
                </div>
                <SafetyBadge score={trip.safety} />
              </div>
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
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
