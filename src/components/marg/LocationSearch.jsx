import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { geocode } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function LocationSearch({ icon: Icon, iconColor, placeholder, value, onSelect }) {
  const [query, setQuery] = useState(value?.name || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const timer = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    setQuery(value?.name || '')
  }, [value])

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      clearTimeout(timer.current)
      abortRef.current?.abort()
    }
  }, [])

  const runSearch = (q) => {
    // Cancel any in-flight request so stale results can't overwrite fresh ones
    // and we stay under Nominatim's rate limit (TASK 4 #4).
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    geocode(q, { signal: ctrl.signal })
      .then((r) => {
        setResults(r)
        setHighlight(-1)
        setOpen(true)
        setLoading(false)
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return // superseded — ignore
        // Network/throw is no longer an unhandled rejection (TASK 4 #7).
        setResults([])
        setError('Search unavailable — check your connection')
        setOpen(true)
        setLoading(false)
      })
  }

  const onChange = (e) => {
    const q = e.target.value
    setQuery(q)
    clearTimeout(timer.current)
    if (!q.trim()) {
      abortRef.current?.abort()
      setResults([])
      setError(null)
      setLoading(false)
      setOpen(false)
      return
    }
    timer.current = setTimeout(() => runSearch(q), 300)
  }

  const pick = (r) => {
    if (!r) return
    onSelect(r)
    setQuery(r.name)
    setOpen(false)
    setHighlight(-1)
  }

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (results.length) setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && results.length) {
        e.preventDefault()
        pick(results[highlight >= 0 ? highlight : 0])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative flex-1">
      <div className="flex items-center gap-3">
        {Icon && <Icon className={cn('size-[18px] shrink-0', iconColor)} />}
        <input
          value={query}
          onChange={onChange}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          onFocus={() => {
            setActive(true)
            if (results.length || error) setOpen(true)
          }}
          onBlur={() => setActive(false)}
          placeholder={placeholder}
          className="w-full bg-transparent text-base text-marg-text outline-none placeholder:text-marg-muted"
        />
        {loading && <Loader2 className="size-4 shrink-0 animate-spin text-marg-muted" />}
      </div>

      {open && (query.trim() || error) && (
        <ul className="absolute left-0 right-0 top-9 z-30 max-h-64 overflow-y-auto rounded-xl border border-marg-border bg-white py-1 shadow-lg">
          {error ? (
            <li className="px-3 py-2 text-sm text-marg-danger">{error}</li>
          ) : loading && !results.length ? (
            <li className="px-3 py-2 text-sm text-marg-muted">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-marg-muted">No results found</li>
          ) : (
            results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(r)}
                  className={cn(
                    'flex w-full flex-col items-start px-3 py-2 text-left transition-colors',
                    i === highlight ? 'bg-emerald-50' : 'hover:bg-emerald-50',
                  )}
                >
                  <span className="text-sm font-medium text-marg-text">{r.short}</span>
                  <span className="line-clamp-1 text-xs text-marg-muted">{r.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {/* subtle active underline */}
      <span
        className={cn(
          'pointer-events-none absolute -bottom-0.5 left-0 h-px bg-emerald-500 transition-all duration-200',
          active ? 'w-full opacity-100' : 'w-0 opacity-0',
        )}
      />
    </div>
  )
}
