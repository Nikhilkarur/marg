import { useState, useEffect } from 'react'
import { supabase, supabaseEnabled } from '@/lib/supabase'

const DEMO_USER = { id: 'demo', user_metadata: { full_name: 'Karur Nikhil' } }

const hasDemo = () => {
  try {
    return Boolean(localStorage.getItem('marg_user'))
  } catch {
    return false
  }
}

/**
 * Auth state. Source-of-truth order: a real Supabase session wins; the
 * localStorage "demo" flag is only a fallback for explore mode (TASK 5 #16 — a
 * real login is no longer permanently masked by a stale demo flag). Never hangs
 * on "Loading…": getSession has a .catch() and a timeout guard (TASK 4 #5).
 */
export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // No Supabase configured → pure demo mode driven by the local flag.
    if (!supabaseEnabled) {
      const sync = () => setUser(hasDemo() ? DEMO_USER : null)
      sync()
      setLoading(false)
      window.addEventListener('storage', sync)
      return () => window.removeEventListener('storage', sync)
    }

    let active = true
    const resolve = (session) => {
      if (!active) return
      setUser(session?.user ?? (hasDemo() ? DEMO_USER : null))
      setLoading(false)
    }

    // If Supabase is unreachable, fall back to demo/null instead of spinning.
    const timeout = setTimeout(() => resolve(null), 4000)

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        clearTimeout(timeout)
        resolve(session)
      })
      .catch(() => {
        clearTimeout(timeout)
        resolve(null)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active) setUser(session?.user ?? (hasDemo() ? DEMO_USER : null))
    })

    return () => {
      active = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
