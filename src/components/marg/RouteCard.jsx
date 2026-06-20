import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, AlertTriangle, Leaf, BadgeIndianRupee, Timer, Repeat } from 'lucide-react'
import { SafetyBadge } from './SafetyBadge'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function RouteCard({ route, onClick }) {
  const navigate = useNavigate()
  const { t } = useT()
  const departSoon = typeof route.departIn === 'number' && route.departIn >= 0 && route.departIn <= 90

  return (
    <button
      type="button"
      onClick={onClick || (() => navigate('/map'))}
      className={cn(
        'w-full overflow-hidden rounded-2xl bg-white text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]',
        route.recommended ? 'border-2 border-emerald-500' : 'border border-marg-border',
      )}
    >
      {route.recommended && (
        <div className="flex items-center gap-1.5 bg-emerald-50 px-4 py-2">
          <CheckCircle2 className="size-3.5 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700">
            {route.recommendedLabel || t('results.recommended')}
          </span>
        </div>
      )}

      <div className="p-4">
        {/* Mode sequence — labeled chips, transit-app style */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {route.legs.map((leg, i) => {
            const Icon = leg.icon
            return (
              <div key={i} className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1">
                  <Icon className={cn('size-4', leg.color)} />
                  <span className="text-xs font-medium text-marg-text">{leg.mode ? t('mode.' + leg.mode) : leg.label}</span>
                </span>
                {i < route.legs.length - 1 && <ArrowRight className="size-3 text-marg-muted" />}
              </div>
            )
          })}
        </div>

        {/* Headline: time + fare on the left, safety on the right */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold leading-none text-marg-text">{route.time} {t('card.min')}</p>
            <p className="mt-1 text-sm text-marg-muted">
              {route.fare} {t('card.total')}
              {route.schedule && <span className="text-marg-muted/80"> · {route.schedule}</span>}
            </p>
          </div>
          <SafetyBadge score={route.safety} />
        </div>

        {/* Live departure — real timetable data */}
        {(departSoon || route.nextDeps?.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-marg-border pt-2.5">
            {departSoon && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                <Timer className="size-3.5" />
                {route.departIn === 0 ? t('card.departsNow') : t('card.departsIn', { n: route.departIn })}
              </span>
            )}
            {route.nextDeps?.length > 0 && (
              <span className="text-xs text-marg-muted">
                {route.line ? `${route.line} · ` : ''}{t('card.next')}: <span className="font-medium tabular-nums text-marg-text">{route.nextDeps.join(' · ')}</span>
              </span>
            )}
          </div>
        )}

        {/* Transfers + track signals */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-marg-muted">
            <Repeat className="size-3" /> {t(route.transfers === 1 ? 'card.transfer' : 'card.transfers', { n: route.transfers })}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-marg-muted">
            <BadgeIndianRupee className="size-3" /> {t('card.fixedFare')}
          </span>
          {route.co2 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              <Leaf className="size-3" /> {t('card.saves', { v: route.co2 })}
            </span>
          )}
        </div>

        {route.warning && (
          <div className="mt-2.5 flex items-start gap-2 border-t border-marg-border pt-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-gold-500" />
            <span className="text-xs text-gold-600">{route.warning}</span>
          </div>
        )}
      </div>
    </button>
  )
}
