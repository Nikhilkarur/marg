import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Navigation, Mail, Lock, User, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase, supabaseEnabled } from '@/lib/supabase'

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (supabaseEnabled) {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          // Pass the contact in metadata so the handle_new_user trigger creates
          // it atomically with the profile (no FK race, TASK 5B #6).
          options: {
            data: {
              full_name: form.name,
              contact_name: `${form.name || 'My'} contact`,
              contact_number: form.phone.replace(/\s/g, ''),
            },
          },
        })
        if (error) throw error
        if (form.phone) {
          localStorage.setItem('marg_sos_contact', JSON.stringify({
            name: `${form.name || 'My'} contact`,
            number: form.phone.replace(/\s/g, ''),
          }))
        }
        if (data.user && data.session) {
          localStorage.removeItem('marg_user') // real session is source of truth (TASK 5 #16)
          try {
            // UPSERT: emergency_contacts.user_id is UNIQUE, so a plain insert
            // throws on a second save / re-signup (TASK 5B #5).
            await supabase.from('emergency_contacts').upsert(
              {
                user_id: data.user.id,
                contact_name: `${form.name || 'My'} contact`,
                contact_number: form.phone,
                relationship: 'Emergency Contact',
              },
              { onConflict: 'user_id' },
            )
          } catch {}
        }
        // If email confirmation is required there is no session yet.
        if (!data.session) {
          setError('Account created. Please confirm your email, then log in.')
          setBusy(false)
          return
        }
      } else {
        if (form.phone) {
          localStorage.setItem('marg_sos_contact', JSON.stringify({
            name: `${form.name || 'My'} contact`,
            number: form.phone.replace(/\s/g, ''),
          }))
        }
        localStorage.setItem('marg_user', 'demo')
      }
      navigate('/home')
    } catch (err) {
      setError(err.message || 'Sign up failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-marg-bg px-4 py-10">
      <div className="w-full max-w-md animate-fade-up rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-600 shadow-md shadow-emerald-600/30">
            <Navigation className="size-7 text-white" fill="currentColor" />
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-marg-text">Marg</h1>
          <p className="mt-1 text-sm text-marg-muted">Smarter routes for Chennai. Safer after dark.</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium text-marg-text">Full Name</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-marg-muted" />
              <Input id="name" required placeholder="Karur Nikhil" className="pl-9" value={form.name} onChange={set('name')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-marg-text">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-marg-muted" />
              <Input id="email" type="email" required placeholder="you@example.com" className="pl-9" value={form.email} onChange={set('email')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-marg-text">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-marg-muted" />
              <Input id="password" type="password" required placeholder="••••••••" className="pl-9" value={form.password} onChange={set('password')} />
            </div>
          </div>

          <div className="my-1 border-t border-marg-border" />

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-gold-500" />
              <span className="font-semibold text-marg-text">Emergency SOS Contact</span>
            </div>
            <p className="mt-1 text-sm text-marg-muted">
              We&apos;ll SMS this number instantly if you tap SOS.
            </p>
            <div className="mt-3 flex overflow-hidden rounded-xl border border-marg-border bg-white">
              <span className="flex items-center border-r border-marg-border bg-gray-50 px-3 text-sm font-medium text-marg-text">
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                required
                placeholder="98765 43210"
                className="h-11 flex-1 px-3.5 text-sm text-marg-text outline-none placeholder:text-marg-muted"
                value={form.phone}
                onChange={set('phone')}
              />
            </div>
          </div>

          {error && <p className="text-sm font-medium text-marg-danger">{error}</p>}

          <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create Account'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-marg-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-emerald-600 hover:underline">
            Login →
          </Link>
        </p>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-xs leading-relaxed text-amber-900">
          <strong>Note:</strong> Marg is an MVP built as a web app to avoid Google Play deployment constraints for this hackathon.
          <br className="my-1" />
          <span className="font-bold">It currently only works for locations in Chennai.</span>
        </div>
      </div>
    </div>
  )
}
