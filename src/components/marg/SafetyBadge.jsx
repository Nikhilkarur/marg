import { cn } from '@/lib/utils'

export function SafetyBadge({ score, size = 'md', className }) {
  // Guard a missing/invalid score so an undefined route doesn't render an
  // alarming red "high risk" badge (TASK 4 #23). Show a neutral placeholder.
  const known = typeof score === 'number' && Number.isFinite(score)
  const tone = !known
    ? 'bg-gray-100 text-marg-muted ring-gray-300/50'
    : score >= 70
      ? 'bg-emerald-100 text-emerald-700 ring-emerald-600/20'
      : score >= 40
        ? 'bg-gold-100 text-gold-600 ring-gold-500/25'
        : 'bg-red-100 text-red-600 ring-red-500/20'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums ring-1 ring-inset',
        size === 'lg' ? 'size-11 text-base' : 'size-9 text-sm',
        tone,
        className,
      )}
      aria-label={known ? `Safety score ${score} out of 100` : 'Safety score unavailable'}
    >
      {known ? score : '—'}
    </span>
  )
}
