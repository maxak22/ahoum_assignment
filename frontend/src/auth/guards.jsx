import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import Loading from '../components/Loading.jsx'

export function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

// Client-side gate for creator-only pages. The backend enforces the real rule
// (403); this just avoids showing a page the user can't use.
export function RequireCreator({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_creator) return <Navigate to="/profile" replace />
  return children
}
