import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { SafetyBadge } from './SafetyBadge'
import { cn } from '@/lib/utils'

export function RouteCard({ route, onClick }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={onClick || (() => navigate('/map'))}
      className={cn(
        'w-full overflow-hidden rounded-2xl bg-white p-4 text-left shadow-sm transition-all duration-150 hover:shadow-md',
        route.recommended ? 'border-2 border-emerald-500' : 'border border-marg-border',
      )}
    >
      {route.recommended && (
        <div className="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 rounded-t-xl bg-emerald-50 px-4 py-2">
          <CheckCircle2 className="size-3.5 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700">
            {route.recommendedLabel || 'Recommended — Safest Route'}
          </span>
        </div>
      )}

      {/* Mode sequence */}
      <div className="mb-3 flex items-center gap-2">
        {route.legs.map((leg, i) => {
          const Icon = leg.icon
          return (
            <div key={i} className="flex items-center gap-2">
              <Icon className={cn('size-[18px]', leg.color)} />
              {i < route.legs.length - 1 && (
                <ArrowRight className="size-3 text-marg-muted" />
              )}
            </div>
          )
        })}
      </div>

      {/* Stats */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-marg-text">{route.time}</p>
          <p className="text-sm text-marg-muted">{route.fare} total</p>
        </div>
        <SafetyBadge score={route.safety} />
      </div>

      {route.schedule && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-marg-text">
          <Clock className="size-3.5 text-emerald-600" />
          {route.schedule}
        </p>
      )}

      <p className="mt-1 text-xs text-marg-muted">
        {route.transfers} transfer{route.transfers === 1 ? '' : 's'}
      </p>

      {route.warning && (
        <div className="mt-2 flex items-start gap-2 border-t border-marg-border pt-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-gold-500" />
          <span className="text-xs text-gold-600">{route.warning}</span>
        </div>
      )}
    </button>
  )
}
