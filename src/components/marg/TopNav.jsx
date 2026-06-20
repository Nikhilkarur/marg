import { Link, useLocation } from 'react-router-dom'
import { Navigation, Shield } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Avatar } from '@/components/ui/avatar'
import { useSafeMode } from '@/hooks/useSafeMode'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/lib/i18n'
import { cn, initials } from '@/lib/utils'

const tabs = [
  { key: 'nav.plan', to: '/home', match: ['/home', '/results', '/map'] },
  { key: 'nav.trips', to: '/trips', match: ['/trips'] },
  { key: 'nav.safety', to: '/safety', match: ['/safety'] },
  { key: 'nav.profile', to: '/profile', match: ['/profile'] },
]

export function TopNav() {
  const { pathname } = useLocation()
  const { safeMode, toggle } = useSafeMode()
  const { user } = useAuth()
  const { t, lang, setLanguage } = useT()

  return (
    <header className="sticky top-0 z-40 hidden h-16 items-center justify-between border-b border-marg-border bg-white/90 px-6 backdrop-blur md:flex">
      {/* Logo */}
      <Link to="/home" className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 shadow-sm shadow-emerald-600/30">
          <Navigation className="size-5 text-white" fill="currentColor" />
        </span>
        <span className="text-xl font-bold tracking-tight text-marg-text">Marg</span>
      </Link>

      {/* Tabs */}
      <nav className="flex items-center gap-1">
        {tabs.map((tab) => {
          const active = tab.match.some((m) => pathname.startsWith(m))
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                'relative px-4 py-2 text-sm font-medium transition-colors duration-150',
                active
                  ? 'text-emerald-600'
                  : 'text-marg-muted hover:text-marg-text',
              )}
            >
              {t(tab.key)}
              {active && (
                <span className="absolute inset-x-3 -bottom-[21px] h-0.5 rounded-full bg-emerald-600" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Right */}
      <div className="flex items-center gap-4">
        {/* Language toggle */}
        <div className="flex overflow-hidden rounded-full border border-marg-border">
          {[{ id: 'en', label: 'EN' }, { id: 'ta', label: 'தமிழ்' }].map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLanguage(l.id)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium transition-colors',
                lang === l.id ? 'bg-emerald-600 text-white' : 'text-marg-muted hover:text-marg-text',
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Shield
            className={cn(
              'size-4 transition-colors',
              safeMode ? 'text-gold-500' : 'text-marg-muted',
            )}
            fill={safeMode ? 'currentColor' : 'none'}
          />
          <span
            className={cn(
              'text-sm font-medium transition-colors',
              safeMode ? 'text-gold-600' : 'text-marg-text',
            )}
          >
            {t('nav.safeMode')}
          </span>
          <Switch
            checked={safeMode}
            onCheckedChange={toggle}
            tone={safeMode ? 'gold' : 'emerald'}
          />
        </div>
        <Avatar initials={initials(user?.user_metadata?.full_name)} className="size-9 text-sm" />
      </div>
    </header>
  )
}
