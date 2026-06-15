import { useEffect, useRef, useState } from 'react'
import { Sparkles, Send, X } from 'lucide-react'
import { useSafeMode } from '@/hooks/useSafeMode'
import { askAssistant } from '@/lib/api'
import { HEATMAP_ZONES } from '@/data/heatmapZones'
import { loadTripState } from '@/lib/tripState'
import { cn } from '@/lib/utils'

const QUICK = ['Is my route safe?', 'Cheapest option?', 'Late-night tips']

function reply(input, safeMode) {
  const q = input.toLowerCase()
  if (/(safe|safety|danger|risk|alone|scared)/.test(q))
    return safeMode
      ? 'Your recommended route stays on well-lit, busy roads based on real crime data. Women Safety Mode has re-ranked routes to avoid isolated stretches.'
      : 'Turn on Women Safety Mode and I\'ll re-rank these routes by real Chennai crime data to surface the safest option, especially after dark.'
  if (/(cheap|cost|fare|price|budget|money)/.test(q))
    return 'The bus route is usually cheapest but scores lower on safety. The Metro combo costs more but is faster and safer — worth it after dark.'
  if (/(fast|quick|time|hurry)/.test(q))
    return 'The fastest route typically uses Metro for the main stretch. Check the route cards — the top card shows the quickest option with real departure times.'
  if (/(night|late|dark|evening)/.test(q))
    return 'After dark, prefer Metro or a direct Auto over bus + walk combos. Share your live trip via the SOS menu so a contact can track you. Women Safety Mode will highlight any risky stretches on your route.'
  return 'I can compare your routes on safety, cost and time, or share tips for travelling after dark in Chennai. Try "Is my route safe?" or "Cheapest option?"'
}

export function ChatButton() {
  const { safeMode } = useSafeMode()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef(null)
  const idRef = useRef(0)

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: ++idRef.current,
          role: 'ai',
          text: "I'm Marg AI. I can compare your routes on safety, cost and time, or suggest the safer option after dark.",
        },
      ])
    }
  }, [open, messages.length])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  const send = async (text) => {
    const t = text.trim()
    if (!t) return
    setMessages((m) => [...m, { id: ++idRef.current, role: 'user', text: t }])
    setDraft('')
    setTyping(true)
    let answer
    try {
      const trip = loadTripState()
      const from = trip?.origin?.name?.split(',')[0] || trip?.origin?.short || 'your origin'
      const to = trip?.destination?.name?.split(',')[0] || trip?.destination?.short || 'your destination'
      const data = await askAssistant({
        message: t,
        safe_mode: safeMode,
        hour: new Date().getHours(),
        crime_count: HEATMAP_ZONES.length,
        route_context: `${from} → ${to}`,
      })
      answer = data.reply
    } catch {
      answer = reply(t, safeMode)
    }
    setTyping(false)
    setMessages((m) => [...m, { id: ++idRef.current, role: 'ai', text: answer }])
  }

  return (
    <>
      {/* Floating action button, top-right below the profile avatar. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Marg AI assistant"
        className="fixed right-5 top-4 z-50 flex items-center gap-2 rounded-full bg-emerald-600 py-3 pl-4 pr-5 text-white shadow-xl shadow-emerald-600/30 transition-transform hover:scale-105 active:scale-95 md:right-6 md:top-20"
      >
        <Sparkles className="size-5" />
        <span className="text-sm font-semibold">Marg AI</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[65] flex flex-col justify-end bg-black/40 sm:items-end sm:justify-end sm:p-6">
          <button
            type="button"
            aria-label="Close chat"
            className="absolute inset-0"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-[78dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-[500px] sm:w-96 sm:rounded-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-marg-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-gold-500" />
                <div>
                  <p className="text-sm font-semibold leading-tight text-marg-text">Marg AI</p>
                  <p className="text-xs text-marg-muted">Routes, safety & fares in Chennai</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-full text-marg-muted hover:bg-gray-100"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      m.role === 'user'
                        ? 'rounded-tr-sm bg-emerald-600 text-white'
                        : 'rounded-tl-sm bg-gray-100 text-marg-text',
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3">
                    <span className="size-1.5 animate-bounce rounded-full bg-marg-muted [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-marg-muted [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-marg-muted" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick prompts */}
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="shrink-0 rounded-full border border-marg-border px-3 py-1.5 text-xs font-medium text-marg-muted transition-colors hover:border-emerald-500 hover:text-emerald-600"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send(draft)
              }}
              className="flex gap-2 border-t border-marg-border p-3"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about your route…"
                className="flex-1 rounded-xl border border-marg-border px-4 py-2 text-sm text-marg-text outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={!draft.trim()}
                className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
              >
                <Send className="size-5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
