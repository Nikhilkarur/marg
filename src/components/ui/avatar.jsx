import { cn } from '@/lib/utils'

export function Avatar({ initials = 'KN', className }) {
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-emerald-600 font-semibold text-white',
        className,
      )}
    >
      {initials}
    </span>
  )
}
