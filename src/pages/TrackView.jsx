import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Navigation, MapPin, Clock, ShieldCheck } from 'lucide-react'
import MapComponent from '@/components/marg/MapComponent'
import { fetchTrack } from '@/lib/track'

// Public, no-auth viewer a trusted contact opens from a share link. Polls the
// relay every few seconds and shows the traveller's latest position on a map.
export default function TrackView() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let stop = false
    const tick = async () => {
      const d = await fetchTrack(id)
      if (!stop) { setData(d); setLoading(false) }
    }
    tick()
    const t = setInterval(tick, 5000)
    return () => { stop = true; clearInterval(t) }
  }, [id])

  const coords = data?.lat != null ? [[data.lng, data.lat]] : null
  const dest = data?.dest
  const mapRoute = coords && dest?.lat != null ? [[data.lng, data.lat], [dest.lng, dest.lat]] : coords
  const stale = data?.ageSeconds != null && data.ageSeconds > 60
  const ended = data && data.active === false && !data.notFound && !data.error

  return (
    <div className="flex min-h-dvh flex-col bg-marg-bg">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-marg-border bg-white px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-600">
          <Navigation className="size-5 text-white" fill="currentColor" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-marg-text">Live trip — Marg</p>
          <p className="truncate text-xs text-marg-muted">
            {loading ? 'Connecting…'
              : data?.notFound ? 'This tracking link is invalid or has expired'
              : ended ? 'Trip ended — they have arrived safely'
              : stale ? `Last update ${data.ageSeconds}s ago` : 'Live · updating'}
          </p>
        </div>
        {!loading && !data?.notFound && (
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ended ? 'bg-gray-100 text-marg-muted' : stale ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            <span className={`size-2 rounded-full ${ended ? 'bg-marg-muted' : stale ? 'bg-amber-500' : 'animate-pulse bg-emerald-500'}`} />
            {ended ? 'Ended' : stale ? 'Delayed' : 'Live'}
          </span>
        )}
      </div>

      {/* Map */}
      <div className="relative flex-1">
        {coords ? (
          <MapComponent route={mapRoute} zoom={15} />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <MapPin className="mx-auto size-10 text-marg-muted" />
              <p className="mt-3 text-sm text-marg-muted">
                {loading ? 'Loading location…'
                  : data?.notFound ? 'No active trip for this link.'
                  : 'Waiting for the first location update…'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-marg-border bg-white px-4 py-3 text-xs text-marg-muted">
        {dest?.name ? (
          <><MapPin className="size-3.5 text-gold-500" /> Heading to <span className="font-medium text-marg-text">{dest.name}</span></>
        ) : (
          <><ShieldCheck className="size-3.5 text-emerald-600" /> Shared via Marg Women Safety</>
        )}
        {data?.updatedAt && !ended && (
          <span className="ml-auto flex items-center gap-1"><Clock className="size-3" />{new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>
    </div>
  )
}
