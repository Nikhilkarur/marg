import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, PhoneCall, Share2, PhoneIncoming, ShieldAlert, Star, Trash2, Plus, Check, X, UserPlus, Mic,
} from 'lucide-react'
import { AppLayout } from '@/components/marg/AppLayout'
import { Button } from '@/components/ui/button'
import { FakeCall } from '@/components/marg/FakeCall'
import { loadContacts, addContact, removeContact, setPrimary } from '@/lib/contacts'
import { formatNumber } from '@/lib/sos'
import { useGuardian } from '@/hooks/useGuardian'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// Indian women/emergency helplines — one tap to dial.
const HELPLINES = [
  { label: 'Police / Emergency', number: '112', tone: 'danger' },
  { label: 'Women Helpline', number: '1091', tone: 'gold' },
  { label: 'Chennai Police', number: '100', tone: 'muted' },
]

async function shareLiveLocation() {
  const pos = await new Promise((res) =>
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 5000 })
      : res(null),
  )
  const link = pos
    ? `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`
    : 'https://maps.google.com/'
  const text = `Here's my live location — please keep an eye on me.\n${link}`
  try {
    if (navigator.share) await navigator.share({ title: 'My live location', text })
    else await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export default function Safety() {
  const navigate = useNavigate()
  const { t } = useT()
  const { safeWord, setSafeWord, voiceSupported } = useGuardian()
  const [contacts, setContacts] = useState(loadContacts)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', number: '', relation: '' })
  const [fakeCall, setFakeCall] = useState(false)
  const [shared, setShared] = useState(false)
  const [wordInput, setWordInput] = useState(safeWord)
  const [wordSaved, setWordSaved] = useState(false)

  const saveWord = () => {
    setSafeWord(wordInput)
    setWordSaved(true)
    setTimeout(() => setWordSaved(false), 2000)
  }

  const submit = () => {
    const number = (form.number || '').replace(/[^\d+]/g, '')
    if (number.replace(/\D/g, '').length < 7) return
    setContacts(addContact({ ...form, number }))
    setForm({ name: '', number: '', relation: '' })
    setAdding(false)
  }

  const onShare = async () => {
    const ok = await shareLiveLocation()
    if (ok) { setShared(true); setTimeout(() => setShared(false), 2500) }
  }

  return (
    <AppLayout fullWidth>
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="flex size-9 items-center justify-center rounded-full text-marg-text transition-colors hover:bg-gray-100"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-marg-text">{t('safety.title')}</h1>
            <p className="text-sm text-marg-muted">{t('safety.subtitle')}</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <a
            href="tel:112"
            className="flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 p-4 text-white shadow-sm transition-transform active:scale-95"
          >
            <PhoneCall className="size-6" />
            <span className="text-sm font-semibold">{t('safety.call112')}</span>
          </a>
          <button
            type="button"
            onClick={onShare}
            className="flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white shadow-sm transition-transform active:scale-95"
          >
            {shared ? <Check className="size-6" /> : <Share2 className="size-6" />}
            <span className="text-sm font-semibold">{shared ? t('safety.shared') : t('safety.shareLoc')}</span>
          </button>
          <button
            type="button"
            onClick={() => setFakeCall(true)}
            className="flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 p-4 text-white shadow-sm transition-transform active:scale-95"
          >
            <PhoneIncoming className="size-6" />
            <span className="text-sm font-semibold">{t('safety.fakeCall')}</span>
          </button>
        </div>

        {/* Helplines */}
        <div className="mb-5 rounded-2xl border border-marg-border bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-marg-muted">{t('safety.helplines')}</p>
          <div className="flex flex-col gap-2">
            {HELPLINES.map((h) => (
              <a
                key={h.number}
                href={`tel:${h.number}`}
                className="flex items-center gap-3 rounded-xl border border-marg-border px-3 py-2.5 transition-colors hover:bg-gray-50"
              >
                <PhoneCall className={cn('size-4', h.tone === 'danger' ? 'text-marg-danger' : h.tone === 'gold' ? 'text-gold-500' : 'text-marg-muted')} />
                <span className="text-sm font-medium text-marg-text">{h.label}</span>
                <span className="ml-auto font-mono text-sm font-semibold text-marg-text">{h.number}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Voice safe word — spoken trigger for the Guardian */}
        <div className="mb-5 rounded-2xl border border-marg-border bg-white p-4">
          <div className="mb-1 flex items-center gap-2">
            <Mic className="size-4 text-emerald-600" />
            <p className="text-xs font-semibold uppercase tracking-wide text-marg-muted">{t('safety.voiceWord')}</p>
          </div>
          <p className="mb-3 text-xs text-marg-muted">
            While the AI Audio Guardian is active, saying this word out loud triggers the SOS countdown — hands-free, without reaching for your phone. Pick something you wouldn&apos;t say by accident (e.g. <span className="font-medium text-marg-text">&ldquo;red mango&rdquo;</span>).
          </p>
          {voiceSupported ? (
            <>
              <div className="flex gap-2">
                <input
                  value={wordInput}
                  onChange={(e) => setWordInput(e.target.value)}
                  placeholder="e.g. red mango"
                  className="h-10 flex-1 rounded-lg border border-marg-border px-3 text-sm outline-none focus:border-emerald-500"
                />
                <Button size="sm" onClick={saveWord}>
                  {wordSaved ? <Check className="size-4" /> : null}
                  {wordSaved ? 'Saved' : 'Save'}
                </Button>
              </div>
              {safeWord && (
                <p className="mt-2 text-xs text-emerald-700">
                  Active safe word: <span className="font-semibold">&ldquo;{safeWord}&rdquo;</span>
                  <button type="button" onClick={() => { setSafeWord(''); setWordInput('') }} className="ml-2 text-marg-muted underline hover:text-marg-danger">clear</button>
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-marg-muted">Your browser doesn&apos;t support voice recognition. Try Chrome on Android or desktop.</p>
          )}
        </div>

        {/* Trusted contacts */}
        <div className="rounded-2xl border border-marg-border bg-white p-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-marg-muted">{t('safety.trusted')}</p>
            {!adding && (
              <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700">
                <Plus className="size-4" /> Add
              </button>
            )}
          </div>
          <p className="mb-3 text-xs text-marg-muted">
            Your SOS alerts go to the <Star className="inline size-3 fill-gold-500 text-gold-500" /> primary contact. Tap the star to switch.
          </p>

          {contacts.length === 0 && !adding && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <UserPlus className="size-8 text-marg-muted" />
              <p className="text-sm text-marg-muted">No trusted contacts yet. Add someone who should know if you trigger SOS.</p>
              <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-4" /> Add contact</Button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {contacts.map((c) => (
              <div key={c.id} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5', c.primary ? 'border-gold-200 bg-gold-50' : 'border-marg-border')}>
                <button type="button" onClick={() => setContacts(setPrimary(c.id))} aria-label="Make primary" className="shrink-0">
                  <Star className={cn('size-5', c.primary ? 'fill-gold-500 text-gold-500' : 'text-marg-muted hover:text-gold-500')} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-marg-text">{c.name}{c.relation ? ` · ${c.relation}` : ''}</p>
                  <p className="truncate text-xs text-marg-muted">{formatNumber(c.number)}</p>
                </div>
                <a href={`tel:${c.number}`} aria-label={`Call ${c.name}`} className="flex size-9 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50">
                  <PhoneCall className="size-4" />
                </a>
                <button type="button" onClick={() => setContacts(removeContact(c.id))} aria-label="Remove" className="flex size-9 items-center justify-center rounded-full text-marg-muted hover:bg-red-50 hover:text-marg-danger">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>

          {adding && (
            <div className="mt-3 rounded-xl border border-marg-border p-3">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Name"
                className="mb-2 h-10 w-full rounded-lg border border-marg-border px-3 text-sm outline-none focus:border-emerald-500"
              />
              <div className="mb-2 flex overflow-hidden rounded-lg border border-marg-border">
                <span className="flex items-center border-r border-marg-border bg-gray-50 px-3 text-sm font-medium text-marg-text">+91</span>
                <input
                  value={form.number}
                  onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                  type="tel"
                  inputMode="numeric"
                  placeholder="98765 43210"
                  className="h-10 flex-1 px-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <input
                value={form.relation}
                onChange={(e) => setForm((f) => ({ ...f, relation: e.target.value }))}
                placeholder="Relation (optional) — e.g. Sister"
                className="mb-3 h-10 w-full rounded-lg border border-marg-border px-3 text-sm outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={submit}><Check className="size-4" /> Save</Button>
                <Button variant="outline" size="sm" onClick={() => { setAdding(false); setForm({ name: '', number: '', relation: '' }) }}><X className="size-4" /> Cancel</Button>
              </div>
            </div>
          )}
        </div>

        {/* SOS reminder */}
        <div className="mt-5 flex items-start gap-2 rounded-xl bg-red-50 p-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-marg-danger" />
          <p className="text-xs text-marg-muted">
            The floating <strong className="text-marg-danger">SOS</strong> button and the AI Audio Guardian both alert your primary contact with your live location.
          </p>
        </div>
      </div>

      <FakeCall open={fakeCall} onClose={() => setFakeCall(false)} />
    </AppLayout>
  )
}
