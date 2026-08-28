import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Sessions
        </Link>
        <nav>
          <NavLink to="/" end>
            Catalog
          </NavLink>
          {user && <NavLink to="/bookings">My bookings</NavLink>}
          {user?.is_creator && <NavLink to="/dashboard">Creator</NavLink>}
          {user && <NavLink to="/profile">Profile</NavLink>}
        </nav>
        <div className="topbar-right">
          {user ? (
            <>
              <span className="muted small">{user.email}</span>
              <button className="secondary" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <NavLink to="/login" className="button">
              Sign in
            </NavLink>
          )}
        </div>
      </header>

      <main className="content">{children}</main>

      <footer className="footer">
        Sessions Marketplace · a small demo of concurrency-safe booking
      </footer>
    </div>
  )
}
