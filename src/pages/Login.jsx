import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Navigation, Mail, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase, supabaseEnabled } from '@/lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (supabaseEnabled) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        localStorage.removeItem('marg_user') // real session is now source of truth (TASK 5 #16)
      } else {
        localStorage.setItem('marg_user', 'demo')
      }
      navigate('/home')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-marg-bg px-4 py-10">
      <div className="w-full max-w-md animate-fade-up rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-600 shadow-md shadow-emerald-600/30">
            <Navigation className="size-7 text-white" fill="currentColor" />
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-marg-text">Marg</h1>
          <p className="mt-1 text-sm text-marg-muted">Smarter routes for Chennai. Safer after dark.</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-marg-text">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-marg-muted" />
              <Input id="email" type="email" required placeholder="you@example.com" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-marg-text">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-marg-muted" />
              <Input id="password" type="password" required placeholder="••••••••" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm font-medium text-marg-danger">{error}</p>}

          <Button type="submit" size="lg" className="mt-2 w-full" disabled={busy}>
            {busy ? 'Logging in…' : 'Login'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            localStorage.setItem('marg_user', 'demo')
            navigate('/home')
          }}
          className="mt-3 w-full text-center text-xs font-medium text-marg-muted hover:text-emerald-600"
        >
          {supabaseEnabled ? 'Explore in demo mode →' : 'Demo mode — any email/password works · skip →'}
        </button>

        <p className="mt-5 text-center text-sm text-marg-muted">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-emerald-600 hover:underline">
            Sign up →
          </Link>
        </p>

        <p className="mt-6 border-t border-marg-border pt-4 text-center text-xs leading-relaxed text-marg-muted">
          Marg is an MVP built as a web app — delivered on the web to avoid Google
          Play deployment constraints for this hackathon.
        </p>
      </div>
    </div>
  )
}
