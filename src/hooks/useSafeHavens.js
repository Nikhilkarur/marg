import { useEffect, useState } from 'react'
import { fetchSafeHavens } from '@/lib/api'
import { SAFE_HAVENS } from '@/data/safeHavens'

// Returns real safe-havens (police/hospital/24×7 pharmacy) near `center` from
// live OpenStreetMap data, falling back to the curated seed list while loading or
// if Overpass is unavailable — so the map is never empty and never shows dummies
// when real data exists.
export function useSafeHavens(center) {
  const [havens, setHavens] = useState(SAFE_HAVENS)

  useEffect(() => {
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return
    let cancelled = false
    fetchSafeHavens(center)
      .then((live) => { if (!cancelled && live?.length) setHavens(live) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [center?.lat, center?.lng])

  return havens
}
