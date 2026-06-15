import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Flame, MapPinOff } from 'lucide-react'
import { useSafeMode } from '@/hooks/useSafeMode'

const CHENNAI = [13.0827, 80.2707] // [lat, lng]

function dotIcon(color) {
  return L.divIcon({
    className: 'marg-pin',
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

// Dev-only guard: route coordinates must be GeoJSON [lng,lat]. A [lat,lng]
// regression draws the route in the Arabian Sea, so catch it loudly in dev
// (TASK 4 #19). For Chennai, lng≈80 and lat≈13, so a flipped pair is obvious.
function assertGeoJson(coords) {
  if (!import.meta.env.DEV || !coords?.length) return
  const [a, b] = coords[0]
  if (a >= 12 && a <= 14 && b >= 79 && b <= 81) {
    // eslint-disable-next-line no-console
    console.warn('[MapComponent] coordinates look like [lat,lng]; expected GeoJSON [lng,lat].', coords[0])
  }
}

/**
 * Leaflet + OpenStreetMap map (no API key needed).
 * @param route         { coordinates } or [[lng,lat], ...]  (GeoJSON order)
 * @param heatmapZones  [{ latitude, longitude, radius_m, risk_score, area_name }]
 */
export default function MapComponent({ route, heatmapZones = [], center, zoom = 12 }) {
  const { safeMode } = useSafeMode()
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layers = useRef({ route: null, markers: [], zones: [] })
  const [tileError, setTileError] = useState(false)

  const coords = Array.isArray(route) ? route : route?.coordinates

  // Init once. StrictMode double-invokes effects in dev; the mapRef guard plus a
  // full map.remove() in cleanup prevent "Map container is already initialized"
  // (TASK 4 #18).
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    // Defensive: if a previous instance left an id on the node, clear it.
    if (containerRef.current._leaflet_id) containerRef.current._leaflet_id = undefined

    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      center ? [center[1], center[0]] : CHENNAI,
      zoom,
    )
    const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map)
    mapRef.current = map

    // Surface a subtle overlay if tiles can't load (offline) instead of a blank
    // grey void (TASK 4 #21).
    let tileErrCount = 0
    tiles.on('tileerror', () => {
      tileErrCount += 1
      if (tileErrCount > 8) setTileError(true)
    })
    tiles.on('load', () => setTileError(false))

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(containerRef.current)
    // Mobile browsers often report the final container size a beat after first
    // paint (address-bar collapse, flex settle), leaving half-rendered/grey
    // tiles. Nudge a few times and on orientation change so the map fills cleanly.
    const settle = () => map.invalidateSize()
    const timers = [120, 350, 700, 1200].map((ms) => setTimeout(settle, ms))
    window.addEventListener('orientationchange', settle)

    return () => {
      ro.disconnect()
      timers.forEach(clearTimeout)
      window.removeEventListener('orientationchange', settle)
      map.remove()
      mapRef.current = null
      layers.current = { route: null, markers: [], zones: [] }
    }
  }, [])

  // Route + start/end markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (layers.current.route) {
      map.removeLayer(layers.current.route)
      layers.current.route = null
    }
    layers.current.markers.forEach((m) => map.removeLayer(m))
    layers.current.markers = []
    if (!coords?.length) return

    assertGeoJson(coords)
    const latlngs = coords
      .map((c) => [c[1], c[0]])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])) // drop bad points (#20)
    if (!latlngs.length) return

    const line = L.polyline(latlngs, {
      color: safeMode ? '#F59E0B' : '#10B981',
      weight: 5,
      opacity: 0.9,
      dashArray: '8 6',
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map)
    layers.current.route = line

    const start = L.marker(latlngs[0], { icon: dotIcon('#059669') }).addTo(map)
    const end = L.marker(latlngs[latlngs.length - 1], { icon: dotIcon('#EF4444') }).addTo(map)
    layers.current.markers = [start, end]

    // Guard degenerate bounds (single point / identical endpoints) — fitBounds
    // on a zero-area box throws / zooms to the max (TASK 4 #20).
    const bounds = line.getBounds()
    if (latlngs.length > 1 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    } else {
      map.setView(latlngs[0], 15)
    }
  }, [coords, safeMode])

  // Crime risk zones (safe mode only)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    layers.current.zones.forEach((z) => map.removeLayer(z))
    layers.current.zones = []
    if (!safeMode || !heatmapZones?.length) return

    layers.current.zones = heatmapZones
      .filter((z) => Number.isFinite(z.latitude) && Number.isFinite(z.longitude))
      .map((z) => {
        const color = z.risk_score >= 75 ? '#EF4444' : z.risk_score >= 55 ? '#F59E0B' : '#FBBF24'
        return L.circle([z.latitude, z.longitude], {
          radius: z.radius_m || 500,
          color,
          weight: 1,
          opacity: 0.5,
          fillColor: color,
          fillOpacity: 0.22,
        })
          .addTo(map)
          .bindPopup(`<b>${z.area_name || 'Risk zone'}</b><br/>Safety risk ${z.risk_score}/100`)
      })
  }, [safeMode, heatmapZones])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full bg-[#eef1f4]" />
      {safeMode && (
        <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-marg-text shadow-md ring-1 ring-marg-border">
          <Flame className="size-4 text-gold-500" />
          Crime Heatmap
        </div>
      )}
      {tileError && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[1000] mx-auto flex w-fit items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-sm font-medium text-marg-muted shadow-md ring-1 ring-marg-border">
          <MapPinOff className="size-4" />
          Map tiles unavailable — check your connection
        </div>
      )}
    </div>
  )
}
