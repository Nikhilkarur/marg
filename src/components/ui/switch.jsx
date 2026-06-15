import { cn } from '@/lib/utils'

/**
 * Accessible toggle switch (shadcn-style API).
 * @param {boolean} checked
 * @param {(value:boolean)=>void} onCheckedChange
 * @param {'emerald'|'gold'} tone
 */
export function Switch({ checked, onCheckedChange, tone = 'emerald', className, ...props }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        checked
          ? tone === 'gold'
            ? 'bg-gold-500 focus-visible:ring-gold-500'
            : 'bg-emerald-600 focus-visible:ring-emerald-500'
          : 'bg-gray-300 focus-visible:ring-gray-400',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
