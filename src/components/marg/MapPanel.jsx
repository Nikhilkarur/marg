import { MapPin, Flag, Train, Flame } from 'lucide-react'
import { useSafeMode } from '@/hooks/useSafeMode'
import { cn } from '@/lib/utils'

/**
 * Stylised live-map placeholder, Uber-web style.
 * @param {boolean} showRoute  draw the route polyline + markers
 * @param {string}  tooltip    floating "34 min · ₹47" label
 * @param {string}  emptyLabel text shown when no route
 */
export function MapPanel({ showRoute = false, tooltip, emptyLabel = 'Map will load here', className }) {
  const { safeMode } = useSafeMode()

  return (
    <div className={cn('map-grid relative h-full w-full overflow-hidden', className)}>
      {/* parks + water + roads */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <path d="M72 0 L100 0 L100 38 Q88 46 84 64 T78 100 L62 100 Q72 60 72 0 Z" fill="#d7e8f2" />
        <rect x="8" y="60" width="22" height="16" rx="3" fill="#dcefdc" />
        <circle cx="60" cy="20" r="9" fill="#dcefdc" />
        <g stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round">
          <line x1="0" y1="70" x2="100" y2="58" />
          <line x1="46" y1="0" x2="54" y2="100" />
        </g>
      </svg>

      {/* heatmap */}
      {safeMode && showRoute && (
        <div className="absolute inset-0" aria-hidden>
          <div className="absolute left-[26%] top-[46%] size-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/30 blur-2xl" />
          <div className="absolute left-[58%] top-[66%] size-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-500/30 blur-2xl" />
          <div className="absolute left-[44%] top-[34%] size-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/25 blur-2xl" />
        </div>
      )}

      {showRoute ? (
        <>
          {/* route line */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <path d="M18 84 Q32 62 48 52 T82 20" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
            <path d="M18 84 Q32 62 48 52 T82 20" fill="none" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="0.4 4" />
          </svg>

          {/* markers */}
          <div className="absolute left-[18%] top-[84%] -translate-x-1/2 -translate-y-1/2">
            <span className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-emerald-600 shadow-md">
              <MapPin className="size-4 text-white" />
            </span>
          </div>
          <div className="absolute left-[48%] top-[52%] -translate-x-1/2 -translate-y-1/2">
            <span className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-marg-text shadow-md">
              <Train className="size-4 text-white" />
            </span>
          </div>
          <div className="absolute left-[82%] top-[20%] -translate-x-1/2 -translate-y-1/2">
            <span className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-marg-danger shadow-md">
              <Flag className="size-4 text-white" fill="white" />
            </span>
          </div>

          {/* tooltip */}
          {tooltip && (
            <div className="absolute left-[60%] top-[36%] -translate-x-1/2 -translate-y-1/2">
              <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-marg-text shadow-lg ring-1 ring-marg-border">
                <Train className="size-3.5 text-emerald-600" />
                {tooltip}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <MapPin className="size-12 text-emerald-200" />
          <p className="text-sm font-medium text-marg-muted">{emptyLabel}</p>
        </div>
      )}

      {/* crime heatmap pill */}
      {safeMode && (
        <button className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-marg-text shadow-md ring-1 ring-marg-border transition-colors hover:bg-gray-50">
          <Flame className="size-4 text-gold-500" />
          Crime Heatmap
        </button>
      )}
    </div>
  )
}
