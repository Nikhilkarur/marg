// Curated Chennai "safe havens" — places to head to if you feel unsafe: police
// stations (24×7), major hospitals (24×7 casualty), and round-the-clock
// pharmacies. Coordinates are approximate, sufficient for the map overlay and the
// "nearest safe spot" helper. Shown only in Women Safety Mode.
//
// type: 'police' | 'hospital' | 'pharmacy'
export const SAFE_HAVENS = [
  // Police stations
  { name: 'Anna Nagar Police Station', type: 'police', lat: 13.0863, lng: 80.2106 },
  { name: 'T. Nagar Police Station', type: 'police', lat: 13.0418, lng: 80.2366 },
  { name: 'Guindy Police Station', type: 'police', lat: 13.0102, lng: 80.2128 },
  { name: 'Adyar Police Station', type: 'police', lat: 13.0064, lng: 80.2548 },
  { name: 'Velachery Police Station', type: 'police', lat: 12.9792, lng: 80.2206 },
  { name: 'Egmore Police Station', type: 'police', lat: 13.0732, lng: 80.2609 },
  { name: 'Mylapore Police Station', type: 'police', lat: 13.0336, lng: 80.2676 },
  { name: 'Kilpauk Police Station', type: 'police', lat: 13.0790, lng: 80.2412 },

  // Hospitals (24×7 emergency)
  { name: 'Apollo Hospitals, Greams Road', type: 'hospital', lat: 13.0638, lng: 80.2533 },
  { name: 'Rajiv Gandhi Govt General Hospital', type: 'hospital', lat: 13.0827, lng: 80.2785 },
  { name: 'MIOT International, Manapakkam', type: 'hospital', lat: 13.0179, lng: 80.1773 },
  { name: 'Fortis Malar, Adyar', type: 'hospital', lat: 13.0064, lng: 80.2573 },
  { name: 'SIMS Hospital, Vadapalani', type: 'hospital', lat: 13.0501, lng: 80.2095 },
  { name: 'Govt Kilpauk Medical College', type: 'hospital', lat: 13.0772, lng: 80.2415 },

  // 24×7 pharmacies
  { name: 'Apollo Pharmacy, Anna Nagar', type: 'pharmacy', lat: 13.0851, lng: 80.2148 },
  { name: 'Apollo Pharmacy, T. Nagar', type: 'pharmacy', lat: 13.0395, lng: 80.2330 },
  { name: 'MedPlus 24×7, Velachery', type: 'pharmacy', lat: 12.9815, lng: 80.2180 },
  { name: 'Apollo Pharmacy, Adyar', type: 'pharmacy', lat: 13.0078, lng: 80.2560 },
]

const R = 6371000
export function nearestHaven(lat, lng) {
  let best = null
  for (const h of SAFE_HAVENS) {
    const dLat = ((h.lat - lat) * Math.PI) / 180
    const dLng = ((h.lng - lng) * Math.PI) / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((h.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    const dist = 2 * R * Math.asin(Math.sqrt(a))
    if (!best || dist < best.dist_m) best = { ...h, dist_m: Math.round(dist) }
  }
  return best
}
