import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Flame, MapPinOff } from 'lucide-react'
import { useSafeMode } from '@/hooks/useSafeMode'

const CHENNAI = [13.0827, 80.2707] // [lat, lng]

// Rough distance (km) between two [lat,lng] points — used to show only the
// nearest few safe havens so the map doesn't turn into a pile of badges.
function distKm(a, b) {
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLng = ((b[1] - a[1]) * Math.PI) / 180
  const la1 = (a[0] * Math.PI) / 180
  const la2 = (b[0] * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

function dotIcon(color) {
  return L.divIcon({
    className: 'marg-pin',
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

// Safe-haven markers: a small white badge with a coloured glyph per type.
const HAVEN_STYLE = {
  police: { bg: '#2563EB', glyph: '🛡' },
  hospital: { bg: '#DC2626', glyph: '✚' },
  pharmacy: { bg: '#059669', glyph: '✚' },
}
function havenIcon(type) {
  const s = HAVEN_STYLE[type] || HAVEN_STYLE.police
  return L.divIcon({
    className: 'marg-haven',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:#fff;border:2px solid ${s.bg};color:${s.bg};font-size:12px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.3)">${s.glyph}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
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
export default function MapComponent({ route, safeWalk = null, heatmapZones = [], safeHavens = [], havenNear = null, maxHavens = 12, center, zoom = 12 }) {
  const { safeMode } = useSafeMode()
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layers = useRef({ route: null, markers: [], zones: [], havens: [], safeWalk: null })
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
      layers.current = { route: null, markers: [], zones: [], havens: [], safeWalk: null }
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

  // Safe havens (police / hospital / 24×7 pharmacy) — safe mode only.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    layers.current.havens.forEach((h) => map.removeLayer(h))
    layers.current.havens = []
    if (!safeMode || !safeHavens?.length) return
    const TYPE_LABEL = { police: 'Police station', hospital: 'Hospital (24×7)', pharmacy: '24×7 pharmacy' }
    // Only the nearest few to the trip (or map centre) so the map stays readable.
    const ref = havenNear
      || (coords?.length ? [coords[coords.length - 1][1], coords[coords.length - 1][0]] : null)
      || (center ? [center[1], center[0]] : CHENNAI)
    layers.current.havens = safeHavens
      .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng))
      .map((h) => ({ ...h, _d: distKm(ref, [h.lat, h.lng]) }))
      .sort((a, b) => a._d - b._d)
      .slice(0, maxHavens)
      .map((h) =>
        L.marker([h.lat, h.lng], { icon: havenIcon(h.type), zIndexOffset: 500 })
          .addTo(map)
          .bindPopup(`<b>${h.name}</b><br/>${TYPE_LABEL[h.type] || 'Safe spot'}`),
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeMode, safeHavens, havenNear, coords, maxHavens])

  // Safe-Walk leg (safe mode only) — the crime-avoiding last-mile path, drawn as
  // a bold solid emerald line on top of the dashed route so it reads as "this is
  // the safer way to walk".
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (layers.current.safeWalk) {
      map.removeLayer(layers.current.safeWalk)
      layers.current.safeWalk = null
    }
    const line = Array.isArray(safeWalk) ? safeWalk : safeWalk?.coordinates
    if (!safeMode || !line?.length) return
    const latlngs = line
      .map((c) => [c[1], c[0]])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    if (latlngs.length < 2) return
    layers.current.safeWalk = L.polyline(latlngs, {
      color: '#059669',
      weight: 6,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    })
      .addTo(map)
      .bindPopup('Safe-Walk — last-mile path that avoids crime zones')
  }, [safeMode, safeWalk])

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
