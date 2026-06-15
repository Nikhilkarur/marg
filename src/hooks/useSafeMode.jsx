import { createContext, useContext, useEffect, useState } from 'react'

const SafeModeContext = createContext(null)

const STORAGE_KEY = 'marg_safe_mode'

export function SafeModeProvider({ children }) {
  const [safeMode, setSafeMode] = useState(false)

  // Restore preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) setSafeMode(stored === 'true')
    } catch {
      /* ignore */
    }
  }, [])

  const update = (value) => {
    setSafeMode(value)
    try {
      localStorage.setItem(STORAGE_KEY, String(value))
    } catch {
      /* ignore */
    }
  }

  const toggle = () => update(!safeMode)

  return (
    <SafeModeContext.Provider
      value={{ safeMode, toggle, setSafeMode: update }}
    >
      {children}
    </SafeModeContext.Provider>
  )
}

export function useSafeMode() {
  const ctx = useContext(SafeModeContext)
  if (!ctx) throw new Error('useSafeMode must be used within SafeModeProvider')
  return ctx
}
