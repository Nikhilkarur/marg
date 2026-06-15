import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-marg-bg text-sm text-marg-muted">
        Loading…
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}
