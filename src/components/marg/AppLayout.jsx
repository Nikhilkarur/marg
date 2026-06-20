import { TopNav } from './TopNav'
import { BottomNav } from './BottomNav'
import { SOSButton } from './SOSButton'
import { ChatButton } from './ChatButton'
import { BackendBanner } from './BackendBanner'
import { GuardianOverlay } from './GuardianOverlay'
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
        {/* Content panel. On desktop it's a fixed left rail (or a centred max-width
            column for full-width pages); on phone it rides over the map below as a
            rounded bottom-sheet (max-md: classes keep desktop untouched). */}
        <div
          className={cn(
            'flex w-full flex-col pb-32 transition-colors duration-300 md:pb-0',
            fullWidth ? 'md:w-full' : 'md:w-[420px] lg:w-[480px] md:shrink-0',
            !fullWidth && 'md:h-[calc(100dvh-4rem)] md:overflow-y-auto md:border-r md:border-marg-border',
            map &&
              'max-md:relative max-md:z-10 max-md:-mt-5 max-md:overflow-hidden max-md:rounded-t-2xl max-md:shadow-[0_-8px_24px_rgba(0,0,0,0.08)]',
            safeMode ? 'bg-marg-safemode' : 'bg-marg-panel',
          )}
        >
          {/* Phone-only grab handle so the panel reads as a draggable sheet */}
          {map && <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-black/15 md:hidden" />}
          {children}
        </div>

        {/* Map column — a tall hero on phone, a sticky full-height pane on desktop */}
        {map && (
          <div className="order-first h-[38dvh] w-full md:order-none md:sticky md:top-16 md:h-[calc(100dvh-4rem)] md:flex-1">
            {map}
          </div>
        )}
      </div>

      <BottomNav />
      {/* Floating actions: SOS + the Marg AI assistant, stacked bottom-right. */}
      <SOSButton />
      <ChatButton />
      {/* AI Audio Guardian status pill + distress countdown (follows the user). */}
      <GuardianOverlay />
    </div>
  )
}
