import { TopNav } from './TopNav'
import { BottomNav } from './BottomNav'
import { SOSButton } from './SOSButton'
import { ChatButton } from './ChatButton'
import { BackendBanner } from './BackendBanner'
import { useSafeMode } from '@/hooks/useSafeMode'
import { cn } from '@/lib/utils'

/**
 * Uber-web layout shell: top nav + left panel + full-height map.
 * @param {ReactNode} children  left-panel content
 * @param {ReactNode} map       right-side map (omit for full-width pages)
 * @param {boolean}   chat      show the AI chat button
 * @param {boolean}   fullWidth left panel spans full width (no map column)
 */
export function AppLayout({ children, map, chat = false, fullWidth = false }) {
  const { safeMode } = useSafeMode()

  return (
    <div className="flex min-h-dvh flex-col bg-marg-bg">
      <TopNav />
      <BackendBanner />

      <div className="flex flex-1 flex-col md:flex-row">
        {/* Left panel */}
        <div
          className={cn(
            'flex w-full flex-col pb-24 transition-colors duration-300 md:pb-0',
            fullWidth ? 'md:w-full' : 'md:w-[420px] md:shrink-0',
            !fullWidth && 'md:h-[calc(100dvh-4rem)] md:overflow-y-auto md:border-r md:border-marg-border',
            safeMode ? 'bg-marg-safemode' : 'bg-marg-panel',
          )}
        >
          {children}
        </div>

        {/* Map column */}
        {map && (
          <div className="order-first h-[280px] w-full md:order-none md:sticky md:top-16 md:h-[calc(100dvh-4rem)] md:flex-1">
            {map}
          </div>
        )}
      </div>

      <BottomNav />
      {/* Floating actions: SOS + the Marg AI assistant, stacked bottom-right. */}
      <SOSButton />
      <ChatButton />
    </div>
  )
}
