import { Link, useLocation } from 'react-router-dom'
import { MapPin, Clock, User, ShieldCheck } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const tabs = [
  { key: 'nav.home', to: '/home', icon: MapPin, match: ['/home', '/results', '/map'] },
  { key: 'nav.trips', to: '/trips', icon: Clock, match: ['/trips'] },
  { key: 'nav.safety', to: '/safety', icon: ShieldCheck, match: ['/safety'] },
  { key: 'nav.profile', to: '/profile', icon: User, match: ['/profile'] },
]

export function BottomNav() {
  const { pathname } = useLocation()
  const { t } = useT()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-marg-border bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {tabs.map((tab) => {
        const active = tab.match.some((m) => pathname.startsWith(m))
        const Icon = tab.icon
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-150',
              active ? 'text-emerald-600' : 'text-marg-muted',
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
            {t(tab.key)}
          </Link>
        )
      })}
    </nav>
  )
}
