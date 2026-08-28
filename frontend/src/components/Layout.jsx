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
          Sessions Marketplace
        </Link>
        <nav>
          <NavLink to="/">Catalog</NavLink>
          {user && <NavLink to="/bookings">My bookings</NavLink>}
          {user?.is_creator && <NavLink to="/dashboard">Creator</NavLink>}
          {user && <NavLink to="/profile">Profile</NavLink>}
        </nav>
        <div className="topbar-right">
          {user ? (
            <>
              <span className="muted small">{user.email}</span>
              <button className="link-button" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  )
}
