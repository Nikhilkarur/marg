import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/** First name from a full name, for greetings. */
export function firstName(name) {
  return (name || '').trim().split(/\s+/)[0] || ''
}

/** Up-to-two-letter initials from a full name, for avatars. */
export function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}
