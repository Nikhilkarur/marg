import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, ShieldCheck, ChevronRight, Pencil, MapPin, LogOut, Check, X } from 'lucide-react'
import { AppLayout } from '@/components/marg/AppLayout'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Avatar } from '@/components/ui/avatar'
import { useSafeMode } from '@/hooks/useSafeMode'
import { useAuth } from '@/hooks/useAuth'
import { supabase, supabaseEnabled } from '@/lib/supabase'
import { loadRecentTrips, saveTripState } from '@/lib/tripState'

function getSosContact() {
  try {
    const raw = localStorage.getItem('marg_sos_contact')
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { name: 'Emergency Contact', number: '9876543210' }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function Profile() {
  const navigate = useNavigate()
  const { safeMode, toggle } = useSafeMode()
  const { user } = useAuth()
  const [contact, setContact] = useState(getSosContact)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: contact.name, number: contact.number })
  const [recents] = useState(() => loadRecentTrips())

  const displayNumber = contact.number?.startsWith('+')
    ? contact.number
    : `+91 ${(contact.number || '').replace(/(\d{5})(\d{5})/, '$1 $2')}`

  const saveContact = async () => {
    const number = (form.number || '').replace(/[^\d+]/g, '')
    const digits = number.replace(/\D/g, '')
    if (digits.length < 7) return // need a plausible number
    const next = { name: form.name?.trim() || 'Emergency Contact', number }
    setContact(next)
    setEditing(false)
    try {
      localStorage.setItem('marg_sos_contact', JSON.stringify(next))
    } catch {
      /* ignore */
    }
    // Persist for real users (upsert — user_id is UNIQUE).
    if (supabaseEnabled && UUID_RE.test(user?.id || '')) {
      try {
        await supabase
          .from('emergency_contacts')
          .upsert({ user_id: user.id, contact_name: next.name, contact_number: next.number, relationship: 'Emergency Contact' }, { onConflict: 'user_id' })
      } catch {
        /* best effort */
      }
    }
  }

  const openTrip = (t) => {
    saveTripState({ origin: t.origin, destination: t.destination, route: null })
    navigate('/results', { state: { origin: t.origin, destination: t.destination } })
  }

  const logout = async () => {
    try {
      localStorage.removeItem('marg_user')
      if (supabaseEnabled) await supabase.auth.signOut()
    } catch {
      /* ignore */
    }
    navigate('/login')
  }

  return (
    <AppLayout fullWidth>
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        {/* Avatar */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Avatar initials="KN" className="size-20 text-2xl" />
          <h1 className="mt-3 text-xl font-bold text-marg-text">{user?.user_metadata?.full_name || 'Karur Nikhil'}</h1>
          <p className="text-sm text-marg-muted">{user?.email || 'karurnikhil2507@gmail.com'}</p>
        </div>

        {/* Settings */}
        <div className="mb-4 overflow-hidden rounded-2xl border border-marg-border bg-white">
          {/* Emergency SOS contact — editable */}
          {editing ? (
            <div className="px-4 py-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldAlert className="size-5 shrink-0 text-gold-500" />
                <span className="font-medium text-marg-text">Emergency SOS Contact</span>
              </div>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Contact name"
                className="mb-2 h-11 w-full rounded-xl border border-marg-border px-3.5 text-sm text-marg-text outline-none focus:border-emerald-500"
              />
              <div className="flex overflow-hidden rounded-xl border border-marg-border">
                <span className="flex items-center border-r border-marg-border bg-gray-50 px-3 text-sm font-medium text-marg-text">+91</span>
                <input
                  value={form.number}
                  onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                  type="tel"
                  inputMode="numeric"
                  placeholder="98765 43210"
                  className="h-11 flex-1 px-3.5 text-sm text-marg-text outline-none focus:border-emerald-500"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={saveContact}>
                  <Check className="size-4" /> Save
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setForm({ name: contact.name, number: contact.number }); setEditing(false) }}>
                  <X className="size-4" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-4">
              <ShieldAlert className="size-5 shrink-0 text-gold-500" />
              <span className="font-medium text-marg-text">Emergency SOS Contact</span>
              <span className="ml-auto text-sm text-marg-muted">{displayNumber}</span>
              <button aria-label="Edit contact" onClick={() => { setForm({ name: contact.name, number: contact.number }); setEditing(true) }} className="text-emerald-600 hover:text-emerald-700">
                <Pencil className="size-4" />
              </button>
            </div>
          )}
          <div className="h-px bg-marg-border" />
          <div className="flex items-center gap-3 px-4 py-4">
            <ShieldCheck className="size-5 shrink-0 text-emerald-500" />
            <span className="font-medium text-marg-text">Women Safety Mode default</span>
            <Switch className="ml-auto" checked={safeMode} onCheckedChange={toggle} tone={safeMode ? 'gold' : 'emerald'} />
          </div>
        </div>

        {/* Recent trips */}
        {recents.length > 0 && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-marg-border bg-white">
            <p className="border-b border-marg-border px-4 py-3 font-semibold text-marg-text">Recent Trips</p>
            {recents.map((t, i) => (
              <button
                key={i}
                onClick={() => openTrip(t)}
                className="flex w-full items-center gap-3 border-b border-marg-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-gray-50"
              >
                <MapPin className="size-4 shrink-0 text-emerald-500" />
                <p className="min-w-0 truncate text-sm font-medium text-marg-text">
                  {t.origin?.short || t.origin?.name?.split(',')[0]} → {t.destination?.short || t.destination?.name?.split(',')[0]}
                </p>
                <ChevronRight className="ml-auto size-4 shrink-0 text-marg-muted" />
              </button>
            ))}
          </div>
        )}

        <Button variant="outlineDanger" size="lg" className="w-full" onClick={logout}>
          <LogOut className="size-5" />
          Logout
        </Button>
      </div>
    </AppLayout>
  )
}
