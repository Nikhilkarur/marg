import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { checkBackend } from '@/lib/api'

/**
 * Visible warning when the backend is unreachable (TASK 4 #2). Without this the
 * app silently degrades to estimated routes + local heatmap (VITE_BACKEND_URL
 * falls back to localhost in prod), hiding a real outage. Re-checks on mount.
 */
export function BackendBanner() {
  const [down, setDown] = useState(false)

  useEffect(() => {
    let active = true
    const ping = () => checkBackend().then((ok) => active && setDown(!ok))
    ping()
    const id = setInterval(ping, 30000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  if (!down) return null
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-gold-700">
      <AlertTriangle className="size-3.5 shrink-0" />
      Backend unreachable — showing estimated routes &amp; local safety data. Live timetables and SOS SMS need the server.
    </div>
  )
}
