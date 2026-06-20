// One-tap booking hand-off for each leg of a journey. We can't place a real
// booking without partner APIs + payment (CMRL/Uber/Ola/IRCTC), so — exactly like
// Google Maps — we deep-link into the right app with pickup/drop pre-filled. This
// makes "plans AND books the best combined journey" concrete and demoable.

// Auto/cab → Uber universal link (opens the app if installed, else the web flow),
// pickup + drop pre-filled.
export function uberLink(pickup, dropoff) {
  const q = new URLSearchParams({
    action: 'setPickup',
    'pickup[latitude]': pickup.lat,
    'pickup[longitude]': pickup.lng,
    'pickup[nickname]': pickup.name || 'Pickup',
    'dropoff[latitude]': dropoff.lat,
    'dropoff[longitude]': dropoff.lng,
    'dropoff[nickname]': dropoff.name || 'Destination',
  })
  return `https://m.uber.com/ul/?${q.toString()}`
}

// Auto/cab → Ola deep link with pickup + drop.
export function olaLink(pickup, dropoff) {
  const q = new URLSearchParams({
    serviceType: 'p2p',
    utm_source: 'marg',
    lat: pickup.lat,
    lng: pickup.lng,
    drop_lat: dropoff.lat,
    drop_lng: dropoff.lng,
  })
  return `https://book.olacabs.com/?${q.toString()}`
}

// Fixed ticketing hand-offs per public-transport mode.
export const TICKETING = {
  metro: { label: 'Chennai Metro', url: 'https://chennaimetrorail.org/' },
  train: { label: 'IR UTS app', url: 'https://www.utsonmobile.indianrail.gov.in/' },
  bus: { label: 'Chalo (live bus)', url: 'https://chalo.com/' },
}

// Pickup/drop {lat,lng,name} from a leg's GeoJSON [lng,lat] coordinates.
export function legEndpoints(step, fallbackOrigin, fallbackDest) {
  const c = step?.coordinates
  if (c?.length) {
    const a = c[0]
    const b = c[c.length - 1]
    return [
      { lat: a[1], lng: a[0], name: step.board_stop || fallbackOrigin?.short || 'Pickup' },
      { lat: b[1], lng: b[0], name: step.alight_stop || fallbackDest?.short || 'Destination' },
    ]
  }
  if (fallbackOrigin && fallbackDest) {
    return [
      { lat: fallbackOrigin.lat, lng: fallbackOrigin.lng, name: fallbackOrigin.short || 'Pickup' },
      { lat: fallbackDest.lat, lng: fallbackDest.lng, name: fallbackDest.short || 'Destination' },
    ]
  }
  return null
}
