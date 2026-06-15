import { Link, useLocation } from 'react-router-dom'
import { MapPin, Clock, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'Home', to: '/home', icon: MapPin, match: ['/home', '/results', '/map'] },
  { label: 'Trips', to: '/trips', icon: Clock, match: ['/trips'] },
  { label: 'Profile', to: '/profile', icon: User, match: ['/profile'] },
]

export function BottomNav() {
  const { pathname } = useLocation()

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
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
