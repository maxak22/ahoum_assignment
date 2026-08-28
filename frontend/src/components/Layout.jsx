import { useEffect, useRef, useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import Avatar from './Avatar.jsx'
import BrandMark from './BrandMark.jsx'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
    navigate('/login')
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <BrandMark size={26} />
          Sessions
        </Link>

        <nav>
          <NavLink to="/" end>
            Catalog
          </NavLink>
          {user && <NavLink to="/bookings">My bookings</NavLink>}
          {user?.is_creator && <NavLink to="/dashboard">Creator</NavLink>}
        </nav>

        <div className="topbar-right">
          {user ? (
            <div className="usermenu" ref={menuRef}>
              <button
                className="usermenu-trigger"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <Avatar
                  name={user.full_name}
                  email={user.email}
                  src={user.avatar_url}
                  size={32}
                />
              </button>
              {menuOpen && (
                <div className="usermenu-panel">
                  <div className="usermenu-head">
                    <strong>{user.full_name || 'Signed in'}</strong>
                    <span className="muted small">{user.email}</span>
                    <span className="tag">{user.role}</span>
                  </div>
                  <Link to="/profile" onClick={() => setMenuOpen(false)}>
                    Profile
                  </Link>
                  <Link to="/bookings" onClick={() => setMenuOpen(false)}>
                    My bookings
                  </Link>
                  {user.is_creator && (
                    <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
                      Creator dashboard
                    </Link>
                  )}
                  <button className="link-button" onClick={handleLogout}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <NavLink to="/login" className="button">
              Sign in
            </NavLink>
          )}
        </div>
      </header>

      <main className="content">{children}</main>

      <footer className="footer">Sessions · a booking marketplace</footer>
    </div>
  )
}
