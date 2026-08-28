import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../auth/AuthContext.jsx'
import { apiErrorMessage } from '../api/client.js'
import BrandMark from '../components/BrandMark.jsx'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function Login() {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <LoginView />
    </GoogleOAuthProvider>
  )
}

function LoginView() {
  const { user, loginWithGoogle, devLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)

  const [email, setEmail] = useState('reviewer@example.com')
  const [asCreator, setAsCreator] = useState(true)

  // Google Identity Services injects `window.google.accounts`. If it never shows
  // up (ad blocker / privacy browser), we quietly hide the Google option.
  useEffect(() => {
    if (!googleClientId) return
    if (window.google?.accounts?.id) {
      setGoogleReady(true)
      return
    }
    const t = setInterval(() => {
      if (window.google?.accounts?.id) {
        setGoogleReady(true)
        clearInterval(t)
      }
    }, 300)
    const stop = setTimeout(() => clearInterval(t), 4000)
    return () => {
      clearInterval(t)
      clearTimeout(stop)
    }
  }, [])

  const redirectTo = location.state?.from?.pathname || '/'
  if (user) return <Navigate to={redirectTo} replace />
  const done = () => navigate(redirectTo, { replace: true })

  const onGoogle = async (res) => {
    setError('')
    setBusy(true)
    try {
      await loginWithGoogle(res.credential)
      done()
    } catch (err) {
      setError(apiErrorMessage(err, 'Google sign-in failed.'))
    } finally {
      setBusy(false)
    }
  }

  const onEmail = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await devLogin(email.trim(), asCreator)
      done()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not sign in with that email.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-split">
      <aside className="auth-brand">
        <Link to="/" className="auth-brand-logo">
          <BrandMark size={30} />
          <span>Sessions</span>
        </Link>

        <div className="auth-brand-body">
          <h1>
            Book an hour
            <br />
            with someone
            <br />
            worth learning from.
          </h1>
          <div className="auth-rule" />
          <p>
            Coaching, lessons, mock interviews, office hours — small sessions with
            real people and a real seat count.
          </p>

          <ul className="auth-points">
            <li>Browse and book public sessions in seconds</li>
            <li>Every session has limited, honest capacity</li>
            <li>Switch to host mode and run your own</li>
          </ul>
        </div>

        <figure className="auth-preview" aria-hidden="true">
          <div className="ap-badge">
            <span>SAT</span>
            <strong>12</strong>
          </div>
          <div className="ap-body">
            <strong>Conversational Spanish · 1-on-1</strong>
            <span>Sat 9:00 AM · 45 min</span>
            <div className="ap-meter">
              <i />
            </div>
            <span className="ap-left">1 seat left</span>
          </div>
        </figure>

        <p className="auth-brand-foot">A booking marketplace</p>
      </aside>

      <main className="auth-form-wrap">
        <div className="auth-form">
          <p className="eyebrow">Get started</p>
          <h2>Sign in to continue</h2>
          <p className="muted">Pick up where you left off, or start fresh.</p>

          {error && (
            <p className="error" role="alert" style={{ marginTop: 16 }}>
              {error}
            </p>
          )}

          <form className="auth-email" onSubmit={onEmail}>
            <label>
              Email
              <input
                type="email"
                value={email}
                required
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={asCreator}
                onChange={(e) => setAsCreator(e.target.checked)}
              />
              Sign in as a host (you can change this later)
            </label>
            <button type="submit" className="block" disabled={busy}>
              {busy ? 'Signing in…' : 'Continue'}
            </button>
          </form>

          {googleClientId && googleReady && (
            <>
              <div className="auth-divider">
                <span>or</span>
              </div>
              <div className="auth-google">
                <GoogleLogin
                  onSuccess={onGoogle}
                  onError={() =>
                    setError('Google sign-in was cancelled or failed.')
                  }
                  theme="outline"
                  shape="rectangular"
                  size="large"
                  text="continue_with"
                  width="330"
                />
              </div>
            </>
          )}

          <p className="auth-fineprint">
            A demo project — sessions and bookings may reset.
          </p>
        </div>
      </main>
    </div>
  )
}
