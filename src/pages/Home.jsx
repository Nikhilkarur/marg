import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin,
  Navigation,
  ArrowUpDown,
  Bus,
  Train,
  TrainFront,
  Car,
  ShieldCheck,
  Clock,
  Mic,
  Map as MapIcon,
  Footprints,
  Check,
} from 'lucide-react'
import { AppLayout } from '@/components/marg/AppLayout'
import MapComponent from '@/components/marg/MapComponent'
import LocationSearch from '@/components/marg/LocationSearch'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useSafeMode } from '@/hooks/useSafeMode'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/lib/i18n'
import { useGuardian } from '@/hooks/useGuardian'
import { GuardianToggleCard } from '@/components/marg/GuardianOverlay'
import { HEATMAP_ZONES } from '@/data/heatmapZones'
import { withReports } from '@/lib/reports'
import { useSafeHavens } from '@/hooks/useSafeHavens'
import { saveTripState, saveRecentTrip, loadRecentTrips } from '@/lib/tripState'
import { cn, firstName } from '@/lib/utils'

const modes = [
  { key: 'bus', icon: Bus, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { key: 'metro', icon: Train, color: 'text-purple-500', bg: 'bg-purple-50' },
  { key: 'train', icon: TrainFront, color: 'text-blue-500', bg: 'bg-blue-50' },
  { key: 'auto', icon: Car, color: 'text-gold-500', bg: 'bg-gold-50' },
]

// Sensible Chennai defaults so a demo works without typing.
const DEFAULT_ORIGIN = { name: 'Anna Nagar, Chennai', lat: 13.085, lng: 80.2101 }
const DEFAULT_DEST = { name: 'T. Nagar, Chennai', lat: 13.0418, lng: 80.2341 }

export default function Home() {
  const navigate = useNavigate()
  const { safeMode, toggle } = useSafeMode()
  const { user } = useAuth()
  const { t } = useT()
  const { armed, status } = useGuardian()
  const name = firstName(user?.user_metadata?.full_name)
  const guardianLabel = status === 'error' ? t('home.protect.guardianErr') : armed ? t('home.protect.guardianOn') : t('home.protect.guardianStart')
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN)
  const [destination, setDestination] = useState(DEFAULT_DEST)
  const [when, setWhen] = useState('now')
  const [departTime, setDepartTime] = useState('') // "HH:MM" when scheduling
  const [recents] = useState(() => loadRecentTrips())
  const safeHavens = useSafeHavens(origin)

  const swap = () => {
    setOrigin(destination)
    setDestination(origin)
  }

  // Choosing "schedule" pre-fills the current clock time so the picker is never
  // empty — an empty time silently behaved like "now", making the button useless.
  const pickWhen = (w) => {
    setWhen(w)
    if (w === 'schedule' && !departTime) {
      const n = new Date()
      setDepartTime(`${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`)
    }
  }

  // mode = null → all options; otherwise a mode chip filters Results to that mode.
  const findRoutes = (mode = null, o = origin, d = destination) => {
    if (!o || !d) return
    // Scheduled departure → minutes-since-midnight; "now" → null (backend uses IST now).
    let departMin = null
    if (when === 'schedule' && departTime) {
      const [h, m] = departTime.split(':').map(Number)
      if (Number.isFinite(h) && Number.isFinite(m)) departMin = h * 60 + m
    }
    saveRecentTrip(o, d) // remember for the Home quick-launch
    saveTripState({ origin: o, destination: d, route: null, mode, departMin }) // survive a refresh
    navigate('/results', { state: { origin: o, destination: d, mode, departMin } })
  }

  return (
    <AppLayout map={<MapComponent heatmapZones={withReports(HEATMAP_ZONES)} safeHavens={safeHavens} />}>
      {/* Greeting hero */}
      <div className="animate-fade-up bg-gradient-to-br from-emerald-600 to-emerald-700 px-6 pb-10 pt-6 text-white md:px-7 md:pt-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur">
          <MapPin className="size-3" /> Chennai
        </span>
        <h1 className="mt-2.5 text-2xl font-bold md:text-[28px] md:leading-tight">{name ? t('home.greetingName', { name }) : t('home.greeting')}</h1>
        <p className="mt-1 text-sm text-white/85">{t('home.subtitle')}</p>
      </div>

      {/* Search card — overlaps the hero for a premium, layered feel */}
      <div
        className="mx-4 -mt-5 mb-4 animate-fade-up rounded-2xl border border-marg-border bg-white p-4 shadow-lg"
        style={{ animationDelay: '60ms' }}
      >
        <LocationSearch
          icon={MapPin}
          iconColor="text-emerald-500"
          placeholder={t('home.from')}
          value={origin}
          onSelect={setOrigin}
        />

        <div className="relative my-2.5 flex items-center">
          <div className="h-px flex-1 bg-marg-border" />
          <button
            type="button"
            onClick={swap}
            aria-label="Swap locations"
            className="mx-2 flex size-8 items-center justify-center rounded-full border border-marg-border bg-white text-marg-muted transition-colors hover:text-emerald-600 active:scale-90"
          >
            <ArrowUpDown className="size-4" />
          </button>
          <div className="h-px flex-1 bg-marg-border" />
        </div>

        <LocationSearch
          icon={Navigation}
          iconColor="text-gold-500"
          placeholder={t('home.to')}
          value={destination}
          onSelect={setDestination}
        />

        <div className="mt-4 flex items-center gap-2">
          {['now', 'schedule'].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => pickWhen(w)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150',
                when === w
                  ? 'bg-emerald-600 text-white'
                  : 'border border-marg-border text-marg-muted hover:text-marg-text',
              )}
            >
              {t(`home.${w}`)}
            </button>
          ))}
          {when === 'schedule' && (
            <input
              type="time"
              value={departTime}
              onChange={(e) => setDepartTime(e.target.value)}
              aria-label="Departure time"
              className="rounded-full border border-marg-border px-3 py-1.5 text-sm text-marg-text outline-none focus:border-emerald-500"
            />
          )}
        </div>
      </div>

      {/* Recent trips quick-launch */}
      {recents.length > 0 && (
        <div className="mx-4 mb-4 animate-fade-up" style={{ animationDelay: '120ms' }}>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-marg-muted">
            <Clock className="size-3.5" /> {t('home.recent')}
          </p>
          <div className="flex flex-col gap-2">
            {recents.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => findRoutes(null, r.origin, r.destination)}
                className="flex items-center gap-2 rounded-xl border border-marg-border bg-white px-3 py-2 text-left text-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-sm active:scale-[0.98]"
              >
                <MapPin className="size-4 shrink-0 text-emerald-500" />
                <span className="truncate text-marg-text">
                  {r.origin.short || r.origin.name?.split(',')[0]} → {r.destination.short || r.destination.name?.split(',')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mode chips */}
      <div className="mx-4 mb-4 grid animate-fade-up grid-cols-4 gap-3" style={{ animationDelay: '180ms' }}>
        {modes.map((mode) => {
          const Icon = mode.icon
          return (
            <button
              key={mode.key}
              type="button"
              onClick={() => findRoutes(mode.key)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-marg-border bg-white p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-sm active:scale-95"
            >
              <span className={cn('flex size-9 items-center justify-center rounded-full', mode.bg)}>
                <Icon className={cn('size-5', mode.color)} />
              </span>
              <span className="text-xs font-medium text-marg-text">{t(`mode.${mode.key}`)}</span>
            </button>
          )
        })}
      </div>

      {/* Women Safety Mode card — when on, shows the protections it activates */}
      <div
        style={{ animationDelay: '240ms' }}
        className={cn(
          'mx-4 mb-4 animate-fade-up rounded-xl border p-4 transition-colors duration-200',
          safeMode ? 'border-amber-300 bg-amber-50' : 'border-marg-border bg-white',
        )}
      >
        <div className="flex items-center gap-3">
          <ShieldCheck className={cn('size-8 shrink-0', safeMode ? 'text-gold-500' : 'text-marg-muted')} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-marg-text">{t('home.safeTitle')}</p>
            <p className="mt-0.5 text-xs text-marg-muted">{t('home.safeDesc')}</p>
          </div>
          <Switch checked={safeMode} onCheckedChange={toggle} tone={safeMode ? 'gold' : 'emerald'} />
        </div>

        {safeMode && (
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-amber-200 pt-3">
            {[
              { icon: Mic, label: guardianLabel },
              { icon: MapIcon, label: t('home.protect.crime') },
              { icon: ShieldCheck, label: t('home.protect.havens') },
              { icon: Footprints, label: t('home.protect.safeWalk') },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-1.5">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-600">
                  <Check className="size-2.5 text-white" strokeWidth={3} />
                </span>
                <f.icon className="size-3.5 shrink-0 text-marg-muted" />
                <span className="text-[11px] font-medium text-marg-text">{f.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Audio Guardian — auto-activates with Safe Mode; manual control here */}
      <div className="mx-4 mb-4 animate-fade-up" style={{ animationDelay: '270ms' }}>
        <GuardianToggleCard />
      </div>

      {/* CTA */}
      <div className="mx-4 mb-6 animate-fade-up" style={{ animationDelay: '300ms' }}>
        <Button size="lg" className="w-full" onClick={() => findRoutes()}>
          {t('home.find')}
        </Button>
      </div>
    </AppLayout>
  )
}
