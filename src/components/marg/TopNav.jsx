import { Link, useLocation } from 'react-router-dom'
import { Navigation, Shield } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Avatar } from '@/components/ui/avatar'
import { useSafeMode } from '@/hooks/useSafeMode'
import { useAuth } from '@/hooks/useAuth'
import { cn, initials } from '@/lib/utils'

const tabs = [
  { label: 'Plan', to: '/home', match: ['/home', '/results', '/map'] },
  { label: 'Trips', to: '/trips', match: ['/trips'] },
  { label: 'Profile', to: '/profile', match: ['/profile'] },
]

export function TopNav() {
  const { pathname } = useLocation()
  const { safeMode, toggle } = useSafeMode()
  const { user } = useAuth()

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
              {tab.label}
              {active && (
                <span className="absolute inset-x-3 -bottom-[21px] h-0.5 rounded-full bg-emerald-600" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Right */}
      <div className="flex items-center gap-4">
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
            Safe Mode
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
